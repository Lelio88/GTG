// === SÉLECTION DES ÉLÉMENTS ===
const zones = document.querySelectorAll('.clickable-area');
const backBtn = document.getElementById('back-hub');
const modal = document.getElementById('confirmation-modal');
const confirmBtn = document.getElementById('confirm-btn');
const cancelBtn = document.getElementById('cancel-btn');

// Variable pour stocker quel mode l'utilisateur essaie d'ouvrir
let pendingMode = null; 

// === FONCTIONS ===

// 1. Gestion du clic sur une zone
function handleZoneClick(modeName) {
    // Récupérer le profil actuel
    const profiles = JSON.parse(localStorage.getItem('profiles'));
    const currentPseudo = localStorage.getItem('currentProfile');
    const profile = profiles.find(p => p.pseudo === currentPseudo);

    if (!profile) return;

    // Vérifier si le mode est DÉJÀ débloqué
    if (profile.unlockedModes && profile.unlockedModes.includes(modeName)) {
        alert("Vous avez déjà ouvert ce tiroir !");
        return;
    }

    // Vérifier si l'utilisateur a une clé
    if (profile.keys > 0) {
        // A une clé : On stocke le mode et on ouvre le modal
        pendingMode = modeName;
        modal.classList.remove('hidden');
    } else {
        // Pas de clé : RIEN NE SE PASSE (selon votre demande)
        console.log("Pas de clé, action ignorée.");
    }
}

// 2. Action quand l'utilisateur confirme (OUI)
confirmBtn.addEventListener('click', () => {
    if (!pendingMode) return;

    // Récupérer et mettre à jour le profil
    const profiles = JSON.parse(localStorage.getItem('profiles'));
    const currentPseudo = localStorage.getItem('currentProfile');
    const profileIndex = profiles.findIndex(p => p.pseudo === currentPseudo);

    if (profileIndex !== -1) {
        const profile = profiles[profileIndex];

        // A. Utiliser la clé (Remise à 0)
        if (profile.keys > 0) {
            profile.keys -= 1; 
        }

        // B. Débloquer le mode
        if (!profile.unlockedModes) {
            profile.unlockedModes = [];
        }
        profile.unlockedModes.push(pendingMode);

        // C. Sauvegarder dans localStorage
        profiles[profileIndex] = profile;
        localStorage.setItem('profiles', JSON.stringify(profiles));

        // Feedback et fermeture
        alert(`Le tiroir s'ouvre... Vous avez débloqué le mode : ${pendingMode.toUpperCase()} !`);
        modal.classList.add('hidden');
        pendingMode = null;
    }
});

// 3. Action quand l'utilisateur annule (NON)
cancelBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    pendingMode = null; // On oublie le clic
});

// === INITIALISATION DES ÉCOUTEURS SUR LES ZONES ===
zones.forEach(zone => {
    zone.addEventListener('click', () => {
        const modeName = zone.getAttribute('data-mode');
        handleZoneClick(modeName);
    });
});

// Retour au Hub
backBtn.addEventListener('click', () => {
    window.location.href = '../HTML/hub.html';
});