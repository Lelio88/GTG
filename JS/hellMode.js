/**
 * hellMode.js — Thème « Enfer » : bascule visuelle à 666 mauvaises réponses.
 *
 * ROLE
 *   Pose / retire la classe `gtg-hell` sur <html> selon le total de mauvaises
 *   réponses cumulées du profil. Les overrides de tokens (palette rouge sang)
 *   vivent dans CSS/tokens.css sous `html.gtg-hell` -> tout le thème néon
 *   bascule dès que la classe est présente, sur n'importe quelle page.
 *
 * INVARIANT
 *   L'Enfer est une FENÊTRE : le thème est actif quand le total de mauvaises
 *   réponses est entre 666 (HELL_THRESHOLD) et 777 (HELL_MAX) inclus. Au-delà
 *   de 777, « rédemption » : le thème se retire. Le succès « 666 » reste, lui,
 *   acquis à jamais dès 666 (cf. achievements.js). `applyHellMode` est idempotent.
 *
 * IDS DOM
 *   - classe `gtg-hell` sur document.documentElement (<html>).
 *
 * DEPENDANCES : aucune (le profil est passé en paramètre). Volontairement sans
 *   import de profileStore -> évite un cycle avec gameUtils.js.
 */

export const HELL_THRESHOLD = 666; // début de l'Enfer + seuil du succès « 666 »
export const HELL_MAX = 777;       // fin de l'Enfer (au-delà : rédemption)
const HELL_CLASS = 'gtg-hell';

/**
 * Total des mauvaises réponses cumulées, tous modes confondus.
 * @param {Object} profile
 * @returns {number}
 */
export function totalBadAnswers(profile) {
    if (!profile || !profile.scoresByMode) return 0;
    return Object.values(profile.scoresByMode)
        .reduce((n, s) => n + ((s && s.badAnswers) || 0), 0);
}

/**
 * Applique (ou retire) le thème Enfer selon le profil.
 * @param {Object} [profile] - profil à évaluer.
 * @returns {boolean} true si l'Enfer est actif
 */
export function applyHellMode(profile) {
    const total = totalBadAnswers(profile);
    const hell = total >= HELL_THRESHOLD && total <= HELL_MAX;
    if (typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.classList.toggle(HELL_CLASS, hell);
    }
    return hell;
}
