/**
 * modeReset.js — Réinitialise la progression d'un mode pour retenter les
 * succès de performance (Sans-faute / Éclair).
 *
 * ROLE
 *   Vide `guessedGamesByMode[mode]`, `scoresByMode[mode]`,
 *   `slowestAnswerByMode[mode]`, `inProgressGames[mode]`, et RETIRE le mode de
 *   `completedModes` (il faudra le re-terminer). Conserve `keys`,
 *   `unlockedModes` et surtout `keyedModes` -> re-terminer un mode réinitialisé
 *   ne re-donne PAS de clé (anti-farm, cf. gameCompletion.handleGameCompletion).
 *
 * INVARIANT
 *   `keyedModes` est garanti d'exister AVANT de retirer le mode de
 *   `completedModes` : sinon la migration paresseuse de handleGameCompletion
 *   (`keyedModes = [...completedModes]`) repartirait d'un `completedModes`
 *   amputé et re-donnerait une clé à la re-complétion.
 *
 * DEPENDANCES : state/profileStore.js
 */

import { profileStore } from './profileStore.js';

/**
 * Réinitialise un mode. @returns {Object|null} profil mis à jour, ou null.
 * @param {string} mode - clé de mode (full, image, ..., emoji)
 */
export function resetModeProgress(mode) {
    return profileStore.updateCurrent((p) => {
        // 1) Verrouille l'octroi de clé AVANT de toucher completedModes.
        if (!Array.isArray(p.keyedModes)) p.keyedModes = [...(p.completedModes || [])];

        // 2) Remet la progression du mode à zéro.
        if (p.guessedGamesByMode) p.guessedGamesByMode[mode] = [];
        if (p.scoresByMode) p.scoresByMode[mode] = { goodAnswers: 0, badAnswers: 0 };
        if (p.slowestAnswerByMode) delete p.slowestAnswerByMode[mode];
        if (Array.isArray(p.completedModes)) {
            p.completedModes = p.completedModes.filter((m) => m !== mode);
        }
        if (p.inProgressGames) delete p.inProgressGames[mode];

        return p;
    });
}
