import { getProfiles, saveProfiles } from './gameUtils.js';
import { showAlert } from './ui/dialog.js';

export function handleGameCompletion(currentProfile, gameMode) {
    // === 1. Sauvegarde du mode terminé ===
    if (!currentProfile.completedModes) {
        currentProfile.completedModes = [];
    }

    // Vérification : le mode est-il déjà terminé ?
    const alreadyCompleted = currentProfile.completedModes.includes(gameMode);

    // === 2. Ajout d'une clef uniquement si le mode n'a jamais été terminé ===
    if (!alreadyCompleted) {
        currentProfile.completedModes.push(gameMode);

        if (!currentProfile.keys) {
            currentProfile.keys = 0;
        }
        currentProfile.keys++;
    }

    // === 3. Sauvegarder les modifications dans le localStorage ===
    const profiles = getProfiles();
    const profileIndex = profiles.findIndex(p => p.pseudo === currentProfile.pseudo);
    if (profileIndex !== -1) {
        profiles[profileIndex] = currentProfile;
        saveProfiles(profiles);
    }

    // Affichage d'un message de félicitations puis redirection vers le hub
    showAlert(`Tu as trouvé tous les jeux du mode ${gameMode} !`, {
        title: `Bravo ${currentProfile.pseudo}`,
        okText: 'Retour au hub',
    }).then(() => {
        window.location.href = 'hub.html';
    });
}


function updateKeysDisplay() {
    const keysCounter = document.getElementById('keys-counter');
    const keysCount = document.getElementById('keys-count');
    
    // Récupérer le profil actuel
    const currentProfilePseudo = localStorage.getItem('currentProfile');
    const profiles = getProfiles();
    const currentProfile = profiles.find(p => p.pseudo === currentProfilePseudo);
    if (!currentProfile) {
        keysCounter.style.display = 'none';
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

// On appelle la mise a jour a chaque chargement (additif, ne pas ecraser les autres handlers)
window.addEventListener('DOMContentLoaded', updateKeysDisplay);