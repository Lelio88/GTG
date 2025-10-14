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
    let profiles = JSON.parse(localStorage.getItem('profiles'));
    const profileIndex = profiles.findIndex(p => p.pseudo === currentProfile.pseudo);
    profiles[profileIndex] = currentProfile;
    localStorage.setItem('profiles', JSON.stringify(profiles));

    // Affichage d'un message de félicitations
    alert(`Félicitations ${currentProfile.pseudo}, tu as trouvé tous les jeux du mode ${gameMode} !`);

    // Redirection vers le hub
    window.location.href = 'hub.html';
}


function updateKeysDisplay() {
    const keysCounter = document.getElementById('keys-counter');
    const keysCount = document.getElementById('keys-count');
    
    // Récupérer le profil actuel
    const currentProfilePseudo = localStorage.getItem('currentProfile');
    const profiles = JSON.parse(localStorage.getItem('profiles'));
    const currentProfile = profiles.find(p => p.pseudo === currentProfilePseudo);

    // Mettre à jour le nombre de clés
    if (currentProfile.keys > 0) {
        keysCount.innerText = currentProfile.keys;
        keysCounter.style.display = 'block'; // On affiche seulement si le joueur a au moins une clé
    } else {
        keysCounter.style.display = 'none'; // Sinon, on cache
    }
}

// On appelle la mise à jour à chaque chargement
window.onload = updateKeysDisplay;