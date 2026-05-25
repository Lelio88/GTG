/**
 * profileStore.js -- facade autour de localStorage pour la gestion des profils.
 *
 * Objectifs :
 *   - Eviter de repeter partout :
 *       const pseudo = localStorage.getItem('currentProfile');
 *       const profile = getProfiles().find(p => p.pseudo === pseudo);
 *   - Offrir un updateCurrent(updater) qui fait
 *       lire -> muter -> persister -> notifier (atomique cote API)
 *   - Notifier les observers en mode same-tab ET cross-onglet :
 *     deux onglets ouverts, une victoire dans l'un -> l'autre voit la
 *     mise a jour (cles, modes debloques, scores) au prochain render.
 *
 * Architecture :
 *   - Source de verite = localStorage (cles 'profiles' et 'currentProfile').
 *   - Lecture systematique depuis localStorage (pas de cache memoire) :
 *     2 KB lus, c'est negligeable et ca evite toute desync.
 *   - Cross-onglet via window 'storage' event (declenche automatiquement
 *     par le navigateur quand un AUTRE onglet ecrit dans le localStorage).
 *   - Same-tab via un Set d'observers : on notifie manuellement apres
 *     chaque setCurrent / clearCurrent / updateCurrent.
 *
 * Dependances : getProfiles / saveProfiles de gameUtils.js (operations
 * bas niveau avec try/catch QuotaExceededError deja en place).
 */

import { getProfiles, saveProfiles } from '../gameUtils.js';

const CURRENT_KEY = 'currentProfile';
const PROFILES_KEY = 'profiles';

const observers = new Set();
let crossTabListenerInstalled = false;

function notify() {
    for (const cb of observers) {
        try {
            cb();
        } catch (err) {
            console.error('profileStore subscriber threw :', err);
        }
    }
}

function ensureCrossTabListener() {
    if (crossTabListenerInstalled) return;
    crossTabListenerInstalled = true;
    window.addEventListener('storage', (e) => {
        // Storage event ne se declenche que pour les modifications d'AUTRES onglets.
        // On notifie si c'est une cle qui nous interesse.
        if (e.key === CURRENT_KEY || e.key === PROFILES_KEY || e.key === null) {
            notify();
        }
    });
}

export const profileStore = {
    /**
     * Retourne tous les profils (defensif : [] si storage corrompu/vide).
     * @returns {Array<Object>}
     */
    getAll() {
        return getProfiles();
    },

    /**
     * Retourne le pseudo du profil courant ou null si aucun n'est selectionne.
     * @returns {string|null}
     */
    getCurrentPseudo() {
        try {
            return localStorage.getItem(CURRENT_KEY) || null;
        } catch {
            return null;
        }
    },

    /**
     * Retourne le profil courant (objet complet) ou null.
     * Lit le pseudo dans localStorage puis cherche dans la liste.
     * @returns {Object|null}
     */
    getCurrent() {
        const pseudo = this.getCurrentPseudo();
        if (!pseudo) return null;
        return this.getAll().find(p => p.pseudo === pseudo) || null;
    },

    /**
     * Definit le profil courant par pseudo. Notifie les observers.
     * @param {string} pseudo
     * @returns {boolean} true si OK, false si echec localStorage
     */
    setCurrent(pseudo) {
        try {
            localStorage.setItem(CURRENT_KEY, pseudo);
            notify();
            return true;
        } catch (err) {
            console.error('profileStore.setCurrent failed :', err);
            return false;
        }
    },

    /**
     * Efface le profil courant (deselection). Notifie les observers.
     * @returns {boolean}
     */
    clearCurrent() {
        try {
            localStorage.removeItem(CURRENT_KEY);
            notify();
            return true;
        } catch (err) {
            console.error('profileStore.clearCurrent failed :', err);
            return false;
        }
    },

    /**
     * Met a jour le profil courant via une fonction updater(profile) -> profile.
     * L'updater peut soit muter le profil et retourner undefined, soit retourner
     * un nouvel objet. Persiste via saveProfiles puis notifie.
     * @param {(profile: Object) => Object|void} updater
     * @returns {Object|null} le profil mis a jour, ou null si echec
     */
    updateCurrent(updater) {
        const pseudo = this.getCurrentPseudo();
        if (!pseudo) return null;
        const profiles = this.getAll();
        const idx = profiles.findIndex(p => p.pseudo === pseudo);
        if (idx === -1) return null;
        const updated = updater(profiles[idx]) || profiles[idx];
        profiles[idx] = updated;
        if (!saveProfiles(profiles)) return null;
        notify();
        return updated;
    },

    /**
     * S'abonne aux changements (same-tab + cross-onglet).
     * @param {() => void} callback
     * @returns {() => void} fonction unsubscribe
     */
    subscribe(callback) {
        ensureCrossTabListener();
        observers.add(callback);
        return () => observers.delete(callback);
    },
};
