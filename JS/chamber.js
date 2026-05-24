import { getProfiles, saveProfiles } from './gameUtils.js';
import { showAlert } from './ui/dialog.js';

// === SÉLECTION DES ÉLÉMENTS ===
const zones = document.querySelectorAll('.clickable-area');
const backBtn = document.getElementById('back-hub');
const modal = document.getElementById('confirmation-modal');
const confirmBtn = document.getElementById('confirm-btn');
const cancelBtn = document.getElementById('cancel-btn');

// Variable pour stocker quel mode l'utilisateur essaie d'ouvrir (pour les modes avec clé)
let pendingMode = null; 

// === CONFIGURATION DES LIENS DIRECTS (SANS CLÉ) ===
const directLinks = {
    'trophy': '../HTML/trophy.html',
    'calculator': '../HTML/calculator.html',
    'pantone': '../HTML/pantone.html',
    'films': '../HTML/films.html',
    'gto': 'https://gto.ada.briceledanois.fr/',
    'xxx': '../HTML/xxx.html'
};

// === FONCTIONS ===

// 1. Gestion du clic pour les modes VERROUILLÉS (Ancien fonctionnement)
function handleLockedZoneClick(modeName) {
    // Récupérer le profil actuel
    const profiles = getProfiles();
    const currentPseudo = localStorage.getItem('currentProfile');
    const profile = profiles.find(p => p.pseudo === currentPseudo);

    if (!profile) return;

    // Vérifier si le mode est DÉJÀ débloqué
    if (profile.unlockedModes && profile.unlockedModes.includes(modeName)) {
        showAlert("Vous avez déjà ouvert ce tiroir !", { title: 'Tiroir deja ouvert' });
        return;
    }

    // Vérifier si l'utilisateur a une clé
    if (profile.keys > 0) {
        // A une clé : On stocke le mode et on ouvre le modal
        pendingMode = modeName;
        modal.classList.remove('hidden');
    } else {
        // Pas de clé : RIEN NE SE PASSE
        console.log("Pas de clé, action ignorée.");
    }
}

// 2. Action quand l'utilisateur confirme (OUI) pour une zone à clé
confirmBtn.addEventListener('click', () => {
    if (!pendingMode) return;

    // Récupérer et mettre à jour le profil
    const profiles = getProfiles();
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
        if (!saveProfiles(profiles)) {
            // Echec persistance : on abandonne sans afficher de victoire
            modal.classList.add('hidden');
            pendingMode = null;
            return;
        }

        // Feedback et fermeture
        const unlockedMode = pendingMode;
        modal.classList.add('hidden');
        pendingMode = null;
        showAlert(`Le tiroir s'ouvre...\nMode debloque : ${unlockedMode.toUpperCase()}`, {
            title: 'Nouveau mode debloque',
            okText: 'Super',
        });
    }
});

// 3. Action quand l'utilisateur annule (NON)
cancelBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    pendingMode = null;
});

// === INITIALISATION DES ÉCOUTEURS SUR LES ZONES ===
function activateZone(zone) {
    const modeName = zone.getAttribute('data-mode');

    // CAS 1 : C'est un lien direct (pas de clé)
    if (directLinks[modeName]) {
        const url = directLinks[modeName];

        // Si le lien commence par "http" (lien externe comme GTO), on ouvre un nouvel onglet
        if (url.startsWith('http')) {
            window.open(url, '_blank');
        } else {
            // Sinon (lien interne), on reste dans le même onglet
            window.location.href = url;
        }
        return; // On arrête ici
    }

    // CAS 2 : C'est un autre mode (Besoin de clé, modal, etc.)
    handleLockedZoneClick(modeName);
}

zones.forEach(zone => {
    zone.addEventListener('click', () => activateZone(zone));
    // Accessibilite clavier : Enter et Space declenchent l'activation
    zone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            activateZone(zone);
        }
    });
});

// Retour au Hub
backBtn.addEventListener('click', () => {
    window.location.href = '../HTML/hub.html';
});