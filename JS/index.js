import { importSave } from './saveManager.js';
import { getProfiles, saveProfiles } from './gameUtils.js';
import { profileStore } from './state/profileStore.js';
import { showAlert, showConfirm, showPrompt } from './ui/dialog.js';

// === Sélection des éléments ===
const profilesContainer = document.getElementById('profiles-container');
const loadProfileButton = document.getElementById('load-profile');
const deleteProfileButton = document.getElementById('delete-profile');
const importSaveBtn = document.getElementById('import-save-btn');

let profiles = getProfiles();
let currentProfile = profileStore.getCurrentPseudo();

// Couleurs néon pour les profils
const neonColors = ["#FFA500", "#FF4500", "#FF1493", "#9400D3"];

// Variables pour navigation clavier
let currentFocusProfiles = 0;
let allProfiles = [];

// === Fonction de rendu des profils (avec cases vides) ===
function renderProfiles() {
    profilesContainer.innerHTML = '';

    profiles.forEach((profile, index) => {
        const div = document.createElement('div');
        div.classList.add('profile');
        div.innerText = profile.pseudo;
        div.dataset.index = index;
        const color = neonColors[index % neonColors.length];
        div.style.borderColor = color;
        div.setAttribute('data-color', color);
        div.onclick = () => selectProfile(profile.pseudo);
        if (profile.pseudo === currentProfile) {
            div.classList.add('selected');
            applyNeonGlow(div, color);
            currentFocusProfiles = index;
        }
        profilesContainer.appendChild(div);
    });

    // Ajouter cases vides jusqu'à 4
    for (let i = profiles.length; i < 4; i++) {
        const emptyDiv = document.createElement('div');
        emptyDiv.classList.add('profile', 'empty');
        emptyDiv.innerText = 'Vide';
        emptyDiv.onclick = addNewProfile;
        profilesContainer.appendChild(emptyDiv);
    }

    // Mettre à jour allProfiles pour navigation clavier
    allProfiles = [...profilesContainer.querySelectorAll('.profile')];

    // Appliquer le focus clavier visuel sur currentFocusProfiles
    updateProfileFocus();
}

// Applique la couleur de glow néon sur un élément profil
function applyNeonGlow(element, baseColor) {
    let glowColor;
    switch (baseColor) {
        case "#FFA500": glowColor = "#FF4500"; break;
        case "#FF4500": glowColor = "#FFFF00"; break;
        case "#FF1493": glowColor = "#0000FF"; break;
        case "#9400D3": glowColor = "#FF1493"; break;
        default: glowColor = "#FF4500";
    }
    element.style.setProperty('--glow-color', glowColor);
    element.style.boxShadow = `0 0 10px ${glowColor}, 0 0 20px ${glowColor}`;
}
// Sélection d'un profil
function selectProfile(pseudo) {
    currentProfile = pseudo;
    profileStore.setCurrent(pseudo);

    allProfiles.forEach(p => {
        p.classList.remove('selected');
        // Enlever l'effet néon (boxShadow) sur tous
        p.style.boxShadow = 'none';
    });

    const selectedDiv = allProfiles.find(p => p.innerText === pseudo);
    if (selectedDiv) {
        selectedDiv.classList.add('selected');
        applyNeonGlow(selectedDiv, selectedDiv.getAttribute('data-color'));
        currentFocusProfiles = parseInt(selectedDiv.dataset.index) || 0;
    }
}

// Ajout d'un nouveau profil
async function addNewProfile() {
    const input = await showPrompt("Entrez votre pseudo (20 caractères max) :", {
        title: 'Nouveau profil',
        okText: 'Creer',
        maxLength: 20,
        placeholder: 'Pseudo',
    });
    if (!input) return;
    const pseudo = input.slice(0, 20).trim();
    if (!pseudo) return;
    if (profiles.some(p => p.pseudo === pseudo)) {
        showAlert("Ce pseudo existe déjà !", { title: 'Pseudo deja pris' });
        return;
    }
    profiles.push({
        id: Date.now(),
        pseudo,
        goodAnswers: 0,
        badAnswers: 0,
    });
    if (!saveProfiles(profiles)) {
        // Echec persistance : on enleve le profil ajoute pour rester coherent avec le storage
        profiles.pop();
        return;
    }
    renderProfiles();
    if (importSaveBtn) {
        if (profiles.length >= 4) {
            importSaveBtn.style.display = 'none';
        } else {
            importSaveBtn.style.display = 'inline-block';
        }
    }
}

// Suppression d'un profil
async function deleteProfile() {
    // Vérification si un profil est sélectionné AVANT de demander confirmation
    if (!currentProfile) {
        showAlert("Aucun profil sélectionné.", { title: 'Suppression impossible' });
        return;
    }
    const confirmed = await showConfirm(`Supprimer definitivement le profil "${currentProfile}" ?\n\nCette action est irreversible.`, {
        title: 'Confirmer la suppression',
        okText: 'Supprimer',
        cancelText: 'Annuler',
    });
    if (!confirmed) return;

    const index = profiles.findIndex(p => p.pseudo === currentProfile);
    if (index >= 0) {
        const removed = profiles.splice(index, 1)[0];
        if (!saveProfiles(profiles)) {
            // Echec persistance : on remet le profil pour rester coherent avec le storage
            profiles.splice(index, 0, removed);
            return;
        }
        profileStore.clearCurrent();
        currentProfile = null;
        renderProfiles();
        if (importSaveBtn) {
            if (profiles.length >= 4) {
                importSaveBtn.style.display = 'none';
            } else {
                importSaveBtn.style.display = 'inline-block';
            }
        }
    }
}

// Mise à jour du focus clavier visuel sur profils
function updateProfileFocus() {
    allProfiles.forEach(p => p.classList.remove('keyboard-focus'));
    if (allProfiles[currentFocusProfiles]) {
        allProfiles[currentFocusProfiles].classList.add('keyboard-focus');
        allProfiles[currentFocusProfiles].scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
}

// Navigation clavier uniquement sur profils
document.addEventListener('keydown', (e) => {
    if (e.key === "ArrowLeft") {
        if (currentFocusProfiles > 0) currentFocusProfiles--;
        updateProfileFocus();
    }
    else if (e.key === "ArrowRight") {
        if (currentFocusProfiles < allProfiles.length - 1) currentFocusProfiles++;
        updateProfileFocus();
    }
    else if (e.key === " ") {
        allProfiles[currentFocusProfiles]?.click();
    }
    else if (e.key === "Enter") {
        if (!currentProfile) {
            showAlert("Veuillez sélectionner un profil !", { title: 'Aucun profil selectionne' });
            return;
        }
        window.location.href = 'HTML/hub.html';  // Ou la page de ton choix
    }
});

// Assignation des boutons
deleteProfileButton.onclick = deleteProfile;
loadProfileButton.onclick = () => {
    if (!currentProfile) {
        showAlert("Veuillez sélectionner un profil !", { title: 'Aucun profil selectionne' });
        return;
    }
    window.location.href = 'HTML/hub.html';  // Ou la page de ton choix
};

// Bouton Multijoueur (remplace l'ancien onclick inline)
const multiplayerBtn = document.getElementById('multiplayer-btn');
if (multiplayerBtn) {
    multiplayerBtn.addEventListener('click', () => {
        window.location.href = 'HTML/multi-lobby.html';
    });
}

// Initialisation
renderProfiles();

// Gestion du bouton d'import (visible seulement si places disponibles)
if (importSaveBtn) {
    function updateImportButtonVisibility() {
        if (profiles.length >= 4) {
            importSaveBtn.style.display = 'none';
        } else {
            importSaveBtn.style.display = 'inline-block';
        }
    }
    
    updateImportButtonVisibility();
    
    importSaveBtn.addEventListener('click', importSave);
}
