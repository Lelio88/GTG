import { profileStore } from './state/profileStore.js';
import { showAlert, showConfirm } from './ui/dialog.js';
import { applyHellMode } from './hellMode.js';

// === SÉLECTION DES ÉLÉMENTS ===
const zones = document.querySelectorAll('.clickable-area');
const backBtn = document.getElementById('back-hub');

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

// 1. Gestion du clic pour les modes VERROUILLÉS (cle requise)
async function handleLockedZoneClick(modeName) {
    const profile = profileStore.getCurrent();
    if (!profile) return;

    // Vérifier si le mode est DÉJÀ débloqué
    if (profile.unlockedModes && profile.unlockedModes.includes(modeName)) {
        showAlert("Vous avez déjà ouvert ce tiroir !", { title: 'Tiroir deja ouvert' });
        return;
    }

    // Pas de cle : rien ne se passe (l'utilisateur a clique par curiosite)
    if (!profile.keys || profile.keys <= 0) {
        console.log("Pas de cle, action ignoree.");
        return;
    }

    // Demande de confirmation via la modale neon partagee
    const confirmed = await showConfirm(
        `Utiliser une cle pour debloquer le mode ${modeName.toUpperCase()} ?`,
        { title: 'Ouvrir ce tiroir ?', okText: 'Oui, utiliser la cle', cancelText: 'Non' }
    );
    if (!confirmed) return;

    // Defense en profondeur : on relit + verifie via updateCurrent (le storage
    // a pu changer pendant que la modale etait ouverte -- autre onglet, etc.)
    const updated = profileStore.updateCurrent((freshProfile) => {
        if (!freshProfile.keys || freshProfile.keys <= 0) return freshProfile;
        if (freshProfile.unlockedModes && freshProfile.unlockedModes.includes(modeName)) return freshProfile;
        freshProfile.keys -= 1;
        if (!freshProfile.unlockedModes) freshProfile.unlockedModes = [];
        freshProfile.unlockedModes.push(modeName);
        return freshProfile;
    });

    // Si la mise a jour n'a pas eu lieu (etat plus a jour, plus de cle, ou
    // saveProfiles a echoue) on n'affiche pas le succes.
    if (!updated || (updated.unlockedModes && !updated.unlockedModes.includes(modeName))) return;

    showAlert(`Le tiroir s'ouvre...\nMode debloque : ${modeName.toUpperCase()}`, {
        title: 'Nouveau mode debloque',
        okText: 'Super',
    });
}

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

// Theme Enfer si le profil courant a franchi 666 mauvaises reponses.
applyHellMode(profileStore.getCurrent());