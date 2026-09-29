/**
 * JS/multi/purge.js — Efface les rooms de plus de 24 h (pseudos, scores, chat).
 *
 * Il n'y a pas de serveur : chaque joueur qui ouvre le lobby multi supprime au plus
 * LOT_MAX rooms créées avant le début de la veille (minuit UTC), donc âgées d'au
 * moins 24 h. Une room abandonnée disparaît ainsi à la visite suivante d'un joueur.
 *
 * Choix non évidents :
 * - Les règles RTDB ne savent comparer `query.endAt` que par égalité : elles
 *   n'autorisent la liste des rooms qu'avec exactement la borne `debutDeLaVeille()`,
 *   recalculée côté serveur. Une horloge locale décalée autour de minuit UTC fait
 *   refuser la requête : la purge attend alors la visite suivante, sans erreur visible.
 * - La suppression elle-même n'est permise par les règles que pour une room de plus
 *   de 24 h (ou sans meta) : même un client modifié ne peut pas effacer une partie
 *   en cours.
 *
 * Invariants : la borne et la limite doivent rester identiques à la règle `.read` de
 * `rooms` dans database.rules.json (et au cas de purge de tests/regles.test.mjs).
 *
 * Usage : purgerRoomsPerimees().catch(() => {}) une fois authentifié.
 */
import { db, ref, get, remove, query, orderByChild, endAt, limitToFirst } from './firebase.js';

const JOUR_MS = 86_400_000;
const LOT_MAX = 50;

/** Minuit UTC de la veille, en ms epoch. */
export function debutDeLaVeille(maintenant = Date.now()) {
    return maintenant - (maintenant % JOUR_MS) - JOUR_MS;
}

/** Supprime les rooms périmées ; résout le nombre de rooms visées. */
export async function purgerRoomsPerimees() {
    const perimees = query(ref(db, 'rooms'), orderByChild('meta/createdAt'),
        endAt(debutDeLaVeille()), limitToFirst(LOT_MAX));
    const snap = await get(perimees);
    const codes = [];
    snap.forEach((room) => { codes.push(room.key); });
    await Promise.allSettled(codes.map((code) => remove(ref(db, `rooms/${code}`))));
    return codes.length;
}
