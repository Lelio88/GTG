// Sélection des éléments
const zones = document.querySelectorAll('.clickable-area');
const backBtn = document.getElementById('back-hub');

// Fonction pour débloquer un mode
function unlockMode(modeName) {
    // 1. Récupérer les données du localStorage
    const profiles = JSON.parse(localStorage.getItem('profiles')) || [];
    const currentPseudo = localStorage.getItem('currentProfile');
    
    // 2. Trouver le profil actuel dans le tableau
    const profileIndex = profiles.findIndex(p => p.pseudo === currentPseudo);
    
    if (profileIndex !== -1) {
        const profile = profiles[profileIndex];

        // Initialiser le tableau unlockedModes s'il n'existe pas encore
        if (!profile.unlockedModes) {
            profile.unlockedModes = [];
        }

        // 3. Vérifier si le mode est déjà débloqué
        if (!profile.unlockedModes.includes(modeName)) {
            // Ajouter le mode
            profile.unlockedModes.push(modeName);
            
            // Sauvegarder dans le localStorage
            profiles[profileIndex] = profile;
            localStorage.setItem('profiles', JSON.stringify(profiles));

            alert(`Bravo ! Vous avez débloqué le mode : ${modeName.toUpperCase()}`);
            
            // Optionnel : Masquer la zone ou changer son style une fois trouvée
            // document.querySelector(`[data-mode="${modeName}"]`).style.display = 'none';
        } else {
            alert(`Vous avez déjà trouvé le mode ${modeName}.`);
        }
    } else {
        console.error("Profil non trouvé !");
    }
}

// Ajouter l'écouteur d'événement sur chaque zone
zones.forEach(zone => {
    zone.addEventListener('click', () => {
        const modeToUnlock = zone.getAttribute('data-mode');
        unlockMode(modeToUnlock);
    });
});

// Bouton retour
backBtn.addEventListener('click', () => {
    window.location.href = '../HTML/hub.html';
});