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
import { games } from '../gamesDatabase.js';

const GRACE_MS = 10_000;        // défaut historique du mode 'grace' (#53)
const ROUND_DURATION_MS = 30_000; // 30s par manche (défaut, surchargé par meta.roundDurationMs)

// Config par défaut "quand quelqu'un trouve" si meta.timeBonus absent (#53).
// Doit rester cohérent avec DEFAULT_TIME_BONUS côté room-entry.js.
const DEFAULT_TIME_BONUS = { mode: 'bonus', seconds: 5, frequency: 'each' };

/** Convertit des secondes (number) en ms, borné pour éviter les valeurs aberrantes
 *  d'un client modifié (1s..120s). */
function secondsToMs(s) {
    const n = Number(s);
    if (!Number.isFinite(n)) return GRACE_MS;
    return Math.max(1, Math.min(120, Math.round(n))) * 1000;
}

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
    // uids déjà crédités du bonus de temps pour la manche en cours (#53).
    // Réinitialisé à chaque nouvelle manche. Évite de re-créditer un même
    // trouveur à chaque tick du watcher.
    let creditedFinishers = new Set();

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
        // Durée choisie par l'hôte dans le lobby (#52), défaut 30s.
        const roundDurationMs = meta.roundDurationMs || ROUND_DURATION_MS;

        await update(ref(db, `rooms/${code}/game`), {
            pile: newPile,
            currentRound: {
                roundId,
                gameTitle,
                startedAt: serverTimestamp(),
                endsAt: startedAt + roundDurationMs, // ms epoch ; côté client on compare à Date.now()
                firstFinisherUid: null,
                firstFinisherAt: null,
                graceEndsAt: null,
                revealedAt: null,
                results: {},
            },
        });
        lastRoundId = roundId;
        creditedFinishers = new Set(); // reset du bonus de temps pour la nouvelle manche (#53)
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

        // Config "quand quelqu'un trouve" choisie par l'hôte dans le lobby (#53).
        // mode 'off'   : rien (la manche se termine au timeout ou quand tout le monde a répondu)
        // mode 'bonus' : ajoute `seconds` à endsAt à chaque (ou au 1er) trouveur
        // mode 'grace' : termine la manche `seconds` après le 1er trouveur (ancien comportement, configurable)
        const bonus = meta.timeBonus || DEFAULT_TIME_BONUS;
        const finishers = Object.entries(results)
            .filter(([_, r]) => r.status === 'found' && r.foundAt)
            .sort((a, b) => a[1].foundAt - b[1].foundAt);

        // Mode 'grace' : fin auto N secondes après le 1er trouveur
        if (bonus.mode === 'grace' && !current.firstFinisherUid && finishers.length > 0) {
            const [firstUid, firstResult] = finishers[0];
            await update(ref(db, `rooms/${code}/game/currentRound`), {
                firstFinisherUid: firstUid,
                firstFinisherAt: firstResult.foundAt,
                graceEndsAt: now + secondsToMs(bonus.seconds),
            });
            return; // attend les autres
        }

        // Mode 'bonus' : prolonge endsAt pour chaque trouveur pas encore crédité
        // (frequency 'once' = seulement le 1er ; 'each' = tous). Le Set est
        // synchrone avant l'await -> pas de double-crédit même si le watcher
        // ré-entre pendant l'écriture.
        if (bonus.mode === 'bonus' && finishers.length > 0) {
            const candidates = bonus.frequency === 'once' ? finishers.slice(0, 1) : finishers;
            let addedMs = 0;
            for (const [fUid] of candidates) {
                if (!creditedFinishers.has(fUid)) {
                    creditedFinishers.add(fUid);
                    addedMs += secondsToMs(bonus.seconds);
                }
            }
            if (addedMs > 0 && current.endsAt) {
                await update(ref(db, `rooms/${code}/game/currentRound`), {
                    endsAt: current.endsAt + addedMs,
                });
                // pas de return : on continue d'évaluer allDone / timeout
            }
        }

        // Trigger b) : tous les joueurs ont fini (found ou abandoned)
        const statuses = Object.keys(players).map(u => results[u]?.status || 'searching');
        const allDone = statuses.length > 0 && statuses.every(s => s === 'found' || s === 'abandoned');

        // Trigger c) : timeout (durée de manche, éventuellement prolongée par le bonus)
        const timeoutReached = current.endsAt && now >= current.endsAt;

        // Trigger d) : grace écoulée après 1er hit (mode 'grace' uniquement)
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

        // Pause UX (3.5s) pour laisser voir la révélation du nom du jeu
        // sur tous les clients avant de tirer le prochain (ou terminer la partie).
        setTimeout(() => { startNextRound(); }, 3500);
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
 * Si la partie était déjà terminée (status === "finished"), repasse à "playing".
 * Si la pile est vide (cas typique en fin de partie où tout a été tiré), on
 * re-shuffle l'ensemble du catalogue pour avoir de quoi continuer, en excluant
 * les titres déjà tirés dans cette session (via currentRound.gameTitle).
 */
export async function extendTargetGames({ code, increment }) {
    const snap = await get(ref(db, `rooms/${code}`));
    if (!snap.exists()) return;
    const room = snap.val();
    const meta = room.meta || {};
    const game = room.game || {};
    const isFinished = meta.status === 'finished';
    const pileEmpty = !game.pile || game.pile.length === 0;

    const updates = {
        'meta/targetGames': (meta.targetGames || 0) + increment,
    };
    if (isFinished) {
        updates['meta/status'] = 'playing';
    }
    // Re-remplit la pile si vide (catalogue complet shuffled)
    if (pileEmpty) {
        const titles = games.map(g => g.title);
        updates['game/pile'] = [...titles].sort(() => Math.random() - 0.5);
    }

    await update(ref(db, `rooms/${code}`), updates);
}
