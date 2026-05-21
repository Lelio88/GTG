/**
 * JS/multi/scoring.js — Calcul des points multi (fonction pure)
 *
 * Formule décidée :
 *   - Dégressif selon le nombre de joueurs : rang r → (N − r + 1) pts
 *   - Bonus podium : +3 au 1er, +2 au 2e, +1 au 3e
 *   - Joueur qui n'a pas trouvé : 0 pt
 *
 * Exemples vérifiés :
 *   N = 8 → [11, 9, 7, 5, 4, 3, 2, 1]
 *   N = 4 → [7, 5, 4, 2]
 *   N = 2 → [5, 3]
 *
 * Invariants :
 *   - Le module ne touche pas le DOM ni Firebase. Testable isolément.
 *   - rank === 0 signifie « pas trouvé », distinct du 1er (rank === 1).
 */

/**
 * @param {number} rank — 1 pour 1er, 2 pour 2e, ..., 0 si non trouvé
 * @param {number} playerCount — nombre total de joueurs dans la room (N)
 * @returns {number} Points marqués sur cette manche
 */
export function computeRoundPoints(rank, playerCount) {
    if (rank === 0 || rank > playerCount) return 0;
    const base = playerCount - rank + 1;
    const podiumBonus = rank === 1 ? 3
        : rank === 2 ? 2
        : rank === 3 ? 1
        : 0;
    return base + podiumBonus;
}

/**
 * Calcule les rangs depuis les résultats RTDB d'une manche.
 *
 * @param {Object} results — Map {uid: {status, foundAt, ...}} depuis currentRound/results
 * @param {number} playerCount — nb total de joueurs dans la room
 * @returns {Object} Map {uid: {rank, pointsEarned}}
 */
export function computeRanksFromResults(results, playerCount) {
    if (!results) return {};

    // Trie les joueurs ayant trouvé par foundAt croissant
    const finishers = Object.entries(results)
        .filter(([_, r]) => r.status === 'found' && typeof r.foundAt === 'number')
        .sort((a, b) => a[1].foundAt - b[1].foundAt);

    const out = {};
    finishers.forEach(([uid, _], i) => {
        const rank = i + 1;
        out[uid] = { rank, pointsEarned: computeRoundPoints(rank, playerCount) };
    });

    // Ceux qui n'ont pas trouvé : rank 0, 0 pt
    Object.keys(results).forEach((uid) => {
        if (!out[uid]) out[uid] = { rank: 0, pointsEarned: 0 };
    });

    return out;
}
