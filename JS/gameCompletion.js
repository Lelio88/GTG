import { profileStore } from './state/profileStore.js';
import { showAlert } from './ui/dialog.js';

export function handleGameCompletion(currentProfile, gameMode) {
    // Mise a jour atomique via le store : ajoute le mode aux completedModes
    // et incremente les cles si c'est la 1ere fois qu'on termine ce mode.
    const updated = profileStore.updateCurrent((profile) => {
        if (!profile.completedModes) profile.completedModes = [];
        if (!profile.completedModes.includes(gameMode)) {
            profile.completedModes.push(gameMode);
            profile.keys = (profile.keys || 0) + 1;
        }
        return profile;
    });

    // Utilise le profil mis a jour (ou celui passe en param en fallback)
    // pour le message de felicitations.
    const pseudo = (updated && updated.pseudo) || currentProfile.pseudo;

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