/**
 * gameProgress.js -- gestion du jeu en cours par mode (anti-triche F5).
 *
 * Probleme resolu : avant ce module, un F5 sur une page de mode relancait
 * launchGameX() qui faisait un random sur availableGames -> l'utilisateur
 * pouvait reroll a volonte pour eviter un jeu qu'il ne connaissait pas
 * (= triche contre la penalite d'abandon).
 *
 * Solution : on persiste le titre du jeu en cours dans le profil sous
 *   profile.inProgressGames = { full: 'A Plague Tale', sound: null, ... }
 * et launchGameX() reutilise ce titre s'il est encore disponible.
 *
 * Effacement automatique :
 *   - nextQuestion() (apres bonne reponse ou abandon)
 *   - changement de profil (chaque profil a son propre etat)
 *
 * Compat retro : les profils sans inProgressGames tombent dans le cas null
 * et obtiennent un random comme avant. Premiere ecriture cree la structure.
 *
 * Place dans JS/state/ et non gameUtils.js pour eviter un cycle d'import
 * (profileStore deja importe par gameUtils.saveProfiles -> circulaire).
 */

import { profileStore } from './profileStore.js';

/**
 * Retourne le jeu en cours pour ce mode, ou null si aucun (ou si le jeu
 * sauvegarde n'est plus disponible -- deja trouve depuis une autre fenetre,
 * profil corrompu, ou tout simplement nouvelle partie).
 *
 * @param {string} mode - 'full', 'image', 'sound', 'text', 'emoji', 'midi', 'shadow', 'pixelated'
 * @param {Array} availableGames - liste des jeux encore disponibles (pas deja trouves)
 * @returns {Object|null}
 */
export function getInProgressGame(mode, availableGames) {
    const profile = profileStore.getCurrent();
    if (!profile || !profile.inProgressGames) return null;
    const title = profile.inProgressGames[mode];
    if (!title) return null;
    return availableGames.find(g => g.title === title) || null;
}

/**
 * Sauvegarde le titre du jeu en cours pour ce mode.
 * @param {string} mode
 * @param {string} title
 */
export function setInProgressGame(mode, title) {
    profileStore.updateCurrent(profile => {
        if (!profile.inProgressGames) profile.inProgressGames = {};
        profile.inProgressGames[mode] = title;
        return profile;
    });
}

/**
 * Efface le jeu en cours pour ce mode (appele depuis nextQuestion).
 * @param {string} mode
 */
export function clearInProgressGame(mode) {
    profileStore.updateCurrent(profile => {
        if (profile.inProgressGames) {
            delete profile.inProgressGames[mode];
        }
        return profile;
    });
}
