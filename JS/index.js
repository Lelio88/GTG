// === Sélection des éléments ===
const profilesContainer = document.getElementById('profiles-container');
const loadProfileButton = document.getElementById('load-profile');
const deleteProfileButton = document.getElementById('delete-profile');

let profiles = JSON.parse(localStorage.getItem('profiles')) || [];
let currentProfile = localStorage.getItem('currentProfile') || null;

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
function refreshProfileData() {
    const currentProfilePseudo = localStorage.getItem('currentProfile');
    const profiles = JSON.parse(localStorage.getItem('profiles'));
    const currentProfile = profiles.find(p => p.pseudo === currentProfilePseudo);

    if (currentProfile) {
        // On initialise les valeurs si elles n'existent pas encore
        localStorage.setItem('keysCount', currentProfile.keys || 0);
        localStorage.setItem('completedModesCount', (currentProfile.completedModes ? currentProfile.completedModes.length : 0));
    } else {
        // Si le profil n'existe pas, on remet à zéro
        localStorage.setItem('keysCount', 0);
        localStorage.setItem('completedModesCount', 0);
    }
}
// Sélection d'un profil
function selectProfile(pseudo) {
    currentProfile = pseudo;
    localStorage.setItem('currentProfile', pseudo);

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
function addNewProfile() {
    let pseudo = prompt("Entrez votre pseudo (20 caractères max) :");
    if (!pseudo) return;
    pseudo = pseudo.slice(0, 20);
    if (profiles.some(p => p.pseudo === pseudo)) {
        alert("Ce pseudo existe déjà !");
        return;
    }
    profiles.push({
        id: Date.now(),
        pseudo,
        goodAnswers: 0,
        badAnswers: 0,
    });
    localStorage.setItem('profiles', JSON.stringify(profiles));
    renderProfiles();
}

// Suppression d'un profil
function deleteProfile() {
    // Demander confirmation
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce profil ?")) {
        return;
    }
    // Vérification si un profil est sélectionné
    if (!currentProfile) {
        alert("Aucun profil sélectionné.");
        return;
    }
    const index = profiles.findIndex(p => p.pseudo === currentProfile);
    if (index >= 0) {
        profiles.splice(index, 1);
        localStorage.setItem('profiles', JSON.stringify(profiles));
        localStorage.removeItem('currentProfile');
        currentProfile = null;
        renderProfiles();
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
            alert("Veuillez sélectionner un profil !");
            return;
        }
        window.location.href = '/HTML/hub.html';  // Ou la page de ton choix
    }
});

// Assignation des boutons
deleteProfileButton.onclick = deleteProfile;
loadProfileButton.onclick = () => {
    if (!currentProfile) {
        alert("Veuillez sélectionner un profil !");
        return;
    }
    window.location.href = '/HTML/hub.html';  // Ou la page de ton choix
};

// Initialisation
renderProfiles();
