/**
 * JS/multi/host-engine.js — Moteur côté hôte
 *
 * Le client qui est l'hôte d'une room exécute cette logique en plus du round-client.
 * Il est le SEUL à écrire dans `/rooms/{code}/game/currentRound` (transitions de manche)
 * et `/rooms/{code}/players/{uid}/totalScore` (résultat fin de manche).
 *
 * Les règles RTDB garantissent que seul l'hôte peut écrire dans `game/` (sauf
 * `currentRound/results/{uid}` qui est ouvert au joueur correspondant).
 *
 * Responsabilités :
 *   - Tirer le prochain jeu depuis `game.pile`
 *   - Écrire un nouveau `currentRound` avec startedAt/endsAt timestamps serveur
 *   - Surveiller les triggers de fin de manche :
 *       a) 1er joueur trouve     → écrit `firstFinisherUid` + `graceEndsAt = now+10s`
 *       b) Tous les joueurs ont status !== "searching" → fin immédiate
 *       c) `endsAt` atteint (timeout 30s) → révélation + re-push titre + fin
 *       d) `graceEndsAt` atteint → fin de manche
 *   - Calculer les rangs/points et écrire dans currentRound/results/{uid}/pointsEarned
 *   - Incrémenter players/{uid}/totalScore (transaction)
 *   - Incrémenter game.playedCount
 *   - Si playedCount >= targetGames → meta.status = "finished"
 *   - Sinon → tirer le prochain jeu
 *
 * Invariants :
 *   - Une seule instance de host-engine par partie (l'hôte). Si le host quitte,
 *     la partie passe à "cancelled" (cf. lobby.js onDisconnect).
 *   - Les transitions sont idempotentes par roundId : le round-client compare
 *     l'ancien roundId au nouveau pour savoir s'il doit re-render.
 *   - Le timer surveille les deadlines via setInterval(250ms) + comparaison
 *     `Date.now() vs endsAt` (timestamps absolus côté serveur).
 */

import {
    db, ref, set, get, onValue, off, update, runTransaction, serverTimestamp,
    push as fbPush
} from './firebase.js';
import { computeRanksFromResults } from './scoring.js';

const GRACE_MS = 10_000;        // 10s après 1er hit
const ROUND_DURATION_MS = 30_000; // 30s par manche

/**
 * Démarre le moteur hôte pour une room. Renvoie un objet avec `stop()` pour le couper.
 *
 * @param {Object} opts
 * @param {string} opts.code — Code de room
 * @param {string} opts.uid — uid de l'hôte (this client)
 * @returns {{stop: () => void}}
 */
export function startHostEngine({ code, uid }) {
    let stopped = false;
    let lastRoundId = null;
    let watcherInterval = null;
    let unsubRoom = null;

    /** Tire le prochain jeu et écrit un nouveau currentRound. */
    async function startNextRound() {
        if (stopped) return;

        // Lire l'état actuel (pile + meta)
        const snap = await get(ref(db, `rooms/${code}`));
        if (!snap.exists()) return;
        const room = snap.val();
        const meta = room.meta || {};
        const game = room.game || {};
        const pile = game.pile || [];
        const playedCount = game.playedCount || 0;

        if (meta.status !== 'playing') return;

        // Fin de partie ?
        if (playedCount >= (meta.targetGames || 0)) {
            await update(ref(db, `rooms/${code}/meta`), { status: 'finished' });
            return;
        }

        if (pile.length === 0) {
            // Pile vide → fin de partie même si targetGames pas atteint
            await update(ref(db, `rooms/${code}/meta`), { status: 'finished' });
            return;
        }

        // Tirage aléatoire dans la pile
        const idx = Math.floor(Math.random() * pile.length);
        const gameTitle = pile[idx];
        const newPile = pile.filter((_, i) => i !== idx);

        const roundId = `r-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const startedAt = Date.now(); // local approximation; serveur a son TS aussi

        await update(ref(db, `rooms/${code}/game`), {
            pile: newPile,
            currentRound: {
                roundId,
                gameTitle,
                startedAt: serverTimestamp(),
                endsAt: startedAt + ROUND_DURATION_MS, // ms epoch ; côté client on compare à Date.now()
                firstFinisherUid: null,
                firstFinisherAt: null,
                graceEndsAt: null,
                revealedAt: null,
                results: {},
            },
        });
        lastRoundId = roundId;
    }

    /**
     * Surveille l'état de la manche en cours et déclenche la fin si une condition est remplie.
     * Appelé à chaque event RTDB sur la room ET via setInterval pour les deadlines.
     */
    async function checkRoundEnd() {
        if (stopped) return;
        const snap = await get(ref(db, `rooms/${code}`));
        if (!snap.exists()) return;
        const room = snap.val();
        const meta = room.meta || {};
        if (meta.status !== 'playing') return;

        const current = room.game?.currentRound;
        if (!current || current.revealedAt || current.endedAt) return;

        const results = current.results || {};
        const players = room.players || {};
        const playerCount = Object.keys(players).length;
        const now = Date.now();

        // Détection du 1er finisher → écrit graceEndsAt
        if (!current.firstFinisherUid) {
            const finishers = Object.entries(results)
                .filter(([_, r]) => r.status === 'found' && r.foundAt)
                .sort((a, b) => a[1].foundAt - b[1].foundAt);
            if (finishers.length > 0) {
                const [firstUid, firstResult] = finishers[0];
                await update(ref(db, `rooms/${code}/game/currentRound`), {
                    firstFinisherUid: firstUid,
                    firstFinisherAt: firstResult.foundAt,
                    graceEndsAt: now + GRACE_MS,
                });
                return; // attend les autres
            }
        }

        // Trigger b) : tous les joueurs ont fini (found ou abandoned)
        const statuses = Object.keys(players).map(u => results[u]?.status || 'searching');
        const allDone = statuses.length > 0 && statuses.every(s => s === 'found' || s === 'abandoned');

        // Trigger c) : timeout 30s
        const timeoutReached = current.endsAt && now >= current.endsAt;

        // Trigger d) : grace 10s écoulée après 1er hit
        const graceReached = current.graceEndsAt && now >= current.graceEndsAt;

        if (allDone || timeoutReached || graceReached) {
            await finalizeRound(room);
        }
    }

    /**
     * Finalise une manche : calcule scores, met à jour totalScore, incrémente playedCount,
     * re-push le titre dans la pile si échec collectif (personne n'a trouvé), tire le suivant.
     */
    async function finalizeRound(room) {
        const current = room.game.currentRound;
        if (!current || current.endedAt) return;

        const players = room.players || {};
        const playerCount = Object.keys(players).length;
        const results = current.results || {};

        // Calcul des rangs/points
        const ranks = computeRanksFromResults(results, playerCount);

        // Mise à jour batch des résultats + totalScores
        const updates = {};
        const nobodyFound = Object.values(ranks).every(r => r.rank === 0);

        for (const [pUid, rk] of Object.entries(ranks)) {
            updates[`game/currentRound/results/${pUid}/rank`] = rk.rank;
            updates[`game/currentRound/results/${pUid}/pointsEarned`] = rk.pointsEarned;
        }

        // Si personne n'a trouvé → révéler la réponse et re-push le titre dans la pile
        if (nobodyFound) {
            updates[`game/currentRound/revealedAt`] = serverTimestamp();
            const newPile = [...(room.game.pile || []), current.gameTitle];
            updates[`game/pile`] = newPile;
        }

        updates[`game/currentRound/endedAt`] = serverTimestamp();
        updates[`game/playedCount`] = (room.game.playedCount || 0) + 1;

        await update(ref(db, `rooms/${code}`), updates);

        // Incrément des totalScores via transaction (atomique)
        for (const [pUid, rk] of Object.entries(ranks)) {
            if (rk.pointsEarned > 0) {
                await runTransaction(
                    ref(db, `rooms/${code}/players/${pUid}/totalScore`),
                    (current) => (current || 0) + rk.pointsEarned
                );
            }
        }

        // Petite pause UX (2s) pour laisser voir la modale de fin de manche,
        // puis on tire le prochain (ou termine la partie).
        setTimeout(() => { startNextRound(); }, 2200);
    }

    // Listener temps réel : déclenche checkRoundEnd à chaque event RTDB sur la room
    const roomRef = ref(db, `rooms/${code}`);
    unsubRoom = onValue(roomRef, () => { checkRoundEnd().catch(err => console.error('host-engine', err)); });

    // Polling 250ms pour les deadlines (timeout 30s, grace 10s) — les events RTDB ne se
    // déclenchent pas quand le temps passe sans écriture.
    watcherInterval = setInterval(() => {
        checkRoundEnd().catch(err => console.error('host-engine', err));
    }, 250);

    // Bootstrap : démarrer un nouveau round UNIQUEMENT si aucun round en cours
    // (cas d'un failover : un nouvel hôte reprend une partie qui avait déjà un round actif)
    bootstrapIfNeeded();

    return {
        stop() {
            stopped = true;
            if (watcherInterval) clearInterval(watcherInterval);
            if (unsubRoom) off(roomRef);
        },
    };

    /**
     * Si la room est en "playing" sans currentRound actif → démarre un round.
     * Sinon (round déjà actif), on laisse le watcher reprendre la transition.
     * Indispensable pour le failover : un nouvel hôte ne doit pas écraser un
     * round qui était déjà en cours quand l'ancien hôte s'est déconnecté.
     */
    async function bootstrapIfNeeded() {
        if (stopped) return;
        const snap = await get(ref(db, `rooms/${code}`));
        if (!snap.exists()) return;
        const room = snap.val();
        const meta = room.meta || {};
        if (meta.status !== 'playing') return;
        const current = room.game?.currentRound;
        if (!current || current.endedAt) {
            startNextRound();
        }
        // Si un round est en cours, le watcher checkRoundEnd s'en occupera
    }
}

/**
 * Bouton « +N manches » — augmente targetGames côté hôte.
 * Si la partie était déjà terminée (status === "finished"), repasse à "playing"
 * et relance le moteur (à l'appel doit suivre un nouveau startHostEngine).
 */
export async function extendTargetGames({ code, increment }) {
    const metaSnap = await get(ref(db, `rooms/${code}/meta`));
    if (!metaSnap.exists()) return;
    const meta = metaSnap.val();
    const updates = {
        targetGames: (meta.targetGames || 0) + increment,
    };
    if (meta.status === 'finished') {
        updates.status = 'playing';
    }
    await update(ref(db, `rooms/${code}/meta`), updates);
}
