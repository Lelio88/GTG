/**
 * JS/multi/lobby.js — Logique du lobby : création, jointure, attente
 *
 * Expose `createRoom(...)`, `joinRoom(...)`, `leaveRoom(...)`, `listenLobby(...)`.
 *
 * Schéma RTDB écrit :
 *   /rooms/{code}/meta
 *     hostUid, hostName, mode, targetGames, status, maxPlayers, createdAt
 *   /rooms/{code}/players/{uid}
 *     name, joinedAt, connected, totalScore
 *
 * Invariants :
 *   - À la création, l'hôte est aussi le 1er joueur (auto-joint).
 *   - `onDisconnect()` programme la suppression du noeud players/{uid} et le passage
 *     de meta.status à "cancelled" si l'hôte se déconnecte (selon décision : partie tuée).
 *   - La jointure refuse si maxPlayers atteint ou si status !== "lobby".
 */

import {
    db, ref, set, get, onValue, off, onDisconnect, update, serverTimestamp,
    whenAuthenticated, findFreeRoomCode, remove
} from './firebase.js';

const MAX_PLAYERS = 8;
const MIN_PLAYERS = 2;

/**
 * Crée une nouvelle room et y ajoute l'utilisateur comme hôte.
 *
 * @param {Object} opts
 * @param {string} opts.hostName — Pseudo de l'hôte (alias éphémère)
 * @param {string} opts.mode — Un des 8 modes (full, image, sound, text, midi, shadow, pixelated, emoji)
 * @param {number} opts.targetGames — Nombre de manches visées (10/20/30)
 * @returns {Promise<{code: string, uid: string}>}
 */
export async function createRoom({ hostName, mode, targetGames }) {
    const user = await whenAuthenticated();
    const code = await findFreeRoomCode();

    const now = serverTimestamp();
    const roomRef = ref(db, `rooms/${code}`);

    await set(roomRef, {
        meta: {
            hostUid: user.uid,
            hostName,
            mode,
            targetGames,
            status: 'lobby',
            maxPlayers: MAX_PLAYERS,
            createdAt: now,
        },
        players: {
            [user.uid]: {
                name: hostName,
                joinedAt: now,
                connected: true,
                totalScore: 0,
            },
        },
    });

    // NB: onDisconnect cleanup est armé depuis room-entry.js, pas ici.
    // Sinon la navigation lobby → room déclenche le cleanup avant d'arriver.

    return { code, uid: user.uid };
}

/**
 * Rejoint une room existante en tant que joueur.
 *
 * @returns {Promise<{code: string, uid: string}>}
 * @throws Error si la room n'existe pas, est pleine, ou n'est plus en lobby.
 */
export async function joinRoom({ code, name }) {
    const user = await whenAuthenticated();
    const metaSnap = await get(ref(db, `rooms/${code}/meta`));

    if (!metaSnap.exists()) {
        throw new Error('Cette room n\'existe pas');
    }
    const meta = metaSnap.val();
    if (meta.status === 'cancelled' || meta.status === 'finished') {
        throw new Error('Cette partie est terminée');
    }
    if (meta.status === 'playing') {
        throw new Error('Cette partie a déjà démarré');
    }

    const playersSnap = await get(ref(db, `rooms/${code}/players`));
    const players = playersSnap.val() || {};
    const playerCount = Object.keys(players).length;

    // Si l'utilisateur est déjà dans la room (cas F5), on autorise.
    const alreadyIn = !!players[user.uid];
    if (!alreadyIn && playerCount >= (meta.maxPlayers || MAX_PLAYERS)) {
        throw new Error('Cette room est pleine');
    }

    await set(ref(db, `rooms/${code}/players/${user.uid}`), {
        name,
        joinedAt: serverTimestamp(),
        connected: true,
        totalScore: alreadyIn ? (players[user.uid].totalScore || 0) : 0,
    });

    // NB: onDisconnect cleanup est armé depuis room-entry.js, pas ici.

    return { code, uid: user.uid };
}

/**
 * Quitte une room volontairement. Si l'hôte quitte, la partie est cancelled.
 */
export async function leaveRoom({ code, uid }) {
    const metaSnap = await get(ref(db, `rooms/${code}/meta`));
    if (!metaSnap.exists()) return;
    const meta = metaSnap.val();

    if (uid === meta.hostUid) {
        // Hôte → on tue la room pour tout le monde
        await update(ref(db, `rooms/${code}/meta`), { status: 'cancelled' });
    } else {
        await remove(ref(db, `rooms/${code}/players/${uid}`));
    }
}

/**
 * Programme le cleanup automatique quand l'onglet se ferme (via Firebase onDisconnect()).
 * - Joueur non-hôte : son noeud players/{uid} est supprimé
 * - Hôte : son noeud players/{uid} est supprimé ET meta.hostUid passe à null.
 *   → Les autres clients pourront alors promouvoir un nouveau hôte via transaction
 *   (failover). Si tous les joueurs partent, la room reste "playing" mais sans hôte
 *   actif → elle sera nettoyée par le TTL ou un cleanup manuel.
 *
 * À appeler UNIQUEMENT depuis room-entry.js (la "vraie" page de session), pas
 * depuis le lobby — sinon la navigation lobby → room déclenche le onDisconnect
 * avant qu'on arrive sur la room.
 */
export async function programDisconnectCleanup(code, uid, isHost) {
    const playerRef = ref(db, `rooms/${code}/players/${uid}`);
    await onDisconnect(playerRef).remove();

    if (isHost) {
        // FAILOVER : on libère juste le rôle d'hôte au lieu de tuer la partie.
        // Un autre joueur se réclamera via transaction.
        const hostUidRef = ref(db, `rooms/${code}/meta/hostUid`);
        await onDisconnect(hostUidRef).set(null);
    }
}

/**
 * Écoute le lobby (meta + players) et appelle `onUpdate({meta, players})` à chaque
 * changement. Renvoie une fonction d'unsubscribe.
 */
export function listenLobby(code, onUpdate) {
    const roomRef = ref(db, `rooms/${code}`);
    const handler = onValue(roomRef, (snap) => {
        const data = snap.val() || {};
        onUpdate({
            meta: data.meta || null,
            players: data.players || {},
            game: data.game || null,
        });
    });
    return () => off(roomRef, 'value', handler);
}

/**
 * Démarre la partie (hôte uniquement). Initialise game.pile (shuffle des titres
 * disponibles) et passe meta.status à "playing".
 */
export async function startGame({ code, gameTitles }) {
    const shuffled = [...gameTitles].sort(() => Math.random() - 0.5);
    await update(ref(db, `rooms/${code}`), {
        'meta/status': 'playing',
        'game/playedCount': 0,
        'game/pile': shuffled,
    });
}

export { MAX_PLAYERS, MIN_PLAYERS };
