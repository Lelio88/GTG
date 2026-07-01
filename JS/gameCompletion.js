import { profileStore } from './state/profileStore.js';
import { showAlert } from './ui/dialog.js';
import { watchAchievements } from './achievements.js';

// Installe l'ecoute des succes in-game des qu'une page de mode est chargee :
// les 8 modes importent gameCompletion, donc le toast + son tombent PENDANT la
// partie, au moment ou un succes est debloque (sans toucher les fichiers de mode).
watchAchievements();

export function handleGameCompletion(currentProfile, gameMode) {
    // Mise a jour atomique via le store : ajoute le mode aux completedModes et
    // incremente les cles UNIQUEMENT la 1ere fois qu'on le termine, tracee via
    // keyedModes (jamais vide, meme au reset d'un mode) -> re-terminer un mode
    // reinitialise ne re-donne pas de cle (anti-farm).
    const updated = profileStore.updateCurrent((profile) => {
        if (!profile.completedModes) profile.completedModes = [];
        // Migration : les modes deja completes ont deja octroye leur cle.
        if (!Array.isArray(profile.keyedModes)) profile.keyedModes = [...profile.completedModes];
        if (!profile.completedModes.includes(gameMode)) {
            profile.completedModes.push(gameMode);
        }
        if (!profile.keyedModes.includes(gameMode)) {
            profile.keyedModes.push(gameMode);
            profile.keys = (profile.keys || 0) + 1;
        }
        return profile;
    });

    // Utilise le profil mis a jour (ou celui passe en param en fallback)
    // pour le message de felicitations.
    const pseudo = (updated && updated.pseudo) || currentProfile.pseudo;

    // Notifie les succes de completion (Complete / Sans-faute / Eclair) au
    // moment meme, avant la redirection vers le hub.
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('gtg:profile-updated'));
    }

    // Affichage d'un message de félicitations puis redirection vers le hub
    showAlert(`Tu as trouvé tous les jeux du mode ${gameMode} !`, {
        title: `Bravo ${pseudo}`,
        okText: 'Retour au hub',
    }).then(() => {
        window.location.href = 'hub.html';
    });
}


function updateKeysDisplay() {
    const keysCounter = document.getElementById('keys-counter');
    const keysCount = document.getElementById('keys-count');

    const currentProfile = profileStore.getCurrent();
    if (!currentProfile) {
        if (keysCounter) keysCounter.style.display = 'none';
        return;
    }

    // Mettre à jour le nombre de clés
    if (currentProfile.keys > 0) {
        keysCount.innerText = currentProfile.keys;
        keysCounter.style.display = 'block'; // On affiche seulement si le joueur a au moins une clé
    } else {
        keysCounter.style.display = 'none'; // Sinon, on cache
    }
}

// Re-render des cles quand un autre onglet met a jour le profil (gain de cle
// dans une autre fenetre par exemple).
profileStore.subscribe(updateKeysDisplay);

// On appelle la mise a jour a chaque chargement (additif, ne pas ecraser les autres handlers)
window.addEventListener('DOMContentLoaded', updateKeysDisplay);