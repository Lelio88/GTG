import { showCharacter } from './dialogue.js';
function refreshProfileData() {
    // On recharge les profils depuis le localStorage
    const profiles = JSON.parse(localStorage.getItem('profiles'));
    const currentProfilePseudo = localStorage.getItem('currentProfile');

    // On retrouve le profil actuel
    const currentProfile = profiles.find(p => p.pseudo === currentProfilePseudo);

    // On met à jour l'affichage
    const keysCounter = document.getElementById('keys-counter');
    const keysCount = document.getElementById('keys-count');
    const completedModes = document.getElementById('completed-modes');

    if (currentProfile) {
        const keys = currentProfile.keys || 0;
        const completed = currentProfile.completedModes ? currentProfile.completedModes.length : 0;

        keysCount.innerText = keys;
        keysCounter.style.display = keys > 0 ? 'block' : 'none';
        completedModes.innerText = `Modes terminés : ${completed}`;
    }
}

// === Sélection des éléments ===
const allModes = [...document.querySelectorAll('.game-mode')]; // Tous les modes de jeu
const startBtn = document.getElementById('start-game');
const backBtn = document.getElementById('back-button');
const modeNeonMapping = {
    full: "#FF4500",    // Orange
    sound: "#FFA500",   // Jaune
    image: "#FF1493",   // Rose
    text: "#9400D3" // Violet
};

let currentProfile = localStorage.getItem('currentProfile');
let currentFocusModes = 0;     // Indice de l'élément sélectionné dans les modes
let selectedIndex = -1;         // Index du mode sélectionné (-1 = aucun)
let selectedMode = null;
let focusedSection = 'modes'; // Section active (par défaut 'profiles')

// === Initialisation des couleurs de chaque mode de jeu ===
document.querySelectorAll('.game-mode').forEach((modeDiv) => {
    const mode = modeDiv.dataset.mode;
    const color = modeNeonMapping[mode];
    modeDiv.style.borderColor = color;
    modeDiv.style.boxShadow = `0 0 5px ${color}`;
    modeDiv.setAttribute('data-color', color);

    // === Gestion du clic pour appliquer l'effet néon ===
    modeDiv.onclick = () => {
        // Retirer l'effet néon et la sélection des autres modes
        document.querySelectorAll('.game-mode').forEach(div => {
            div.classList.remove('selected');
            div.style.boxShadow = `0 0 5px ${div.getAttribute('data-color')}`;  // Réinitialiser le box-shadow
            div.style.animation = 'none'; // Stopper l'animation précédente
            void div.offsetWidth; // Forcer le reflow pour redémarrer l'animation proprement
        });

        // Ajouter l'effet néon au mode sélectionné
        modeDiv.classList.add('selected');

        // Appliquer la couleur de néon en fonction de la sélection
        let glowColor;
        switch (modeDiv.getAttribute('data-color')) {
            case "#FFA500": // Jaune
                glowColor = "#FF4500"; // Orange
                break;
            case "#FF4500": // Orange
                glowColor = "#FFFF00"; // Jaune
                break;
            case "#FF1493": // Rose
                glowColor = "#0000FF"; // Bleu
                break;
            case "#9400D3": // Bleu
                glowColor = "#FF1493"; // Rose
                break;
            default:
                glowColor = "#FF4500"; // Par défaut, orange
        }

        // Appliquer la couleur de néon
        modeDiv.style.setProperty('--glow-color', glowColor);  // Appliquer la couleur de néon
        modeDiv.style.boxShadow = `0 0 10px ${glowColor}, 0 0 20px ${glowColor}`;  // Ajouter un effet de néon plus fort


        // Relancer l'animation de néon
        modeDiv.style.animation = "neon-glow 1.5s infinite alternate";  // Relancer l'animation

        // Mise à jour de la sélection du mode
        selectedMode = modeDiv.dataset.mode;
    };

    // Désactiver l'effet du clavier si la souris survole un mode
    modeDiv.addEventListener('mouseover', () => {
        document.querySelectorAll('.game-mode').forEach(div => {
            div.classList.remove('keyboard-focus'); // Retirer l'effet du focus clavier sur tous les modes
        });
    });
});


// === Navigation avec les flèches ===
document.addEventListener('keydown', (e) => {
    // Mettre à jour les tableaux de modes
    allModes.length = 0;
    allModes.push(...document.querySelectorAll('.game-mode'));
    // Si la section active est "modes"
    if (focusedSection === 'modes') {
        // Flèches gauche et droite pour naviguer entre les modes
        if (e.key === "ArrowLeft") {
            if (currentFocusModes > 0) currentFocusModes--; // Naviguer vers le mode précédent
        } else if (e.key === "ArrowRight") {
            if (currentFocusModes < allModes.length - 1) currentFocusModes++; // Naviguer vers le mode suivant
        }

        // "Space" pour sélectionner un mode
        if (e.key === " ") {
            allModes[currentFocusModes]?.click(); // Sélectionner le mode, avec un check pour undefined
        }

        // Appliquer le focus sur l'élément sélectionné (modes)
        allModes.forEach(el => el.classList.remove('keyboard-focus'));
        if (allModes[currentFocusModes]) {
            allModes[currentFocusModes].classList.add('keyboard-focus');
        }
    }
    if (e.key === "Enter") {
        if (!selectedMode) {
            alert("Veuillez sélectionner un mode de jeu !");
            return;
        }
        window.location.href = `../HTML/${selectedMode}.html`;
    }
});
// === Lancer le jeu avec le bouton ===
startBtn.onclick = () => {
    if (!selectedMode) {
        alert("Veuillez sélectionner un mode de jeu !");
        return;
    }
    window.location.href = `../HTML/${selectedMode}.html`;
};

// === Bouton retour (clic) ===
backBtn.addEventListener('click', () => {
    window.location.href = '../index.html';
});

// Fonction d'horloge
function updateTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('current-time').innerText = ` | Heure : ${hours}:${minutes}`;
}
//Affichage du bouton "Chambre" si l'utilisateur a au moins une clé ou terminé au moins un mode
const roomButton = document.getElementById('room-button');
if (roomButton) {
    const currentProfile = JSON.parse(localStorage.getItem('profiles')).find(p => p.pseudo === localStorage.getItem('currentProfile'));
    if (currentProfile && (currentProfile.keys > 0 || (currentProfile.completedModes && currentProfile.completedModes.length > 0))) {
        roomButton.style.display = 'block';
    } else {
        roomButton.style.display = 'none';
    }
}

// Initialisation
refreshProfileData();
updateTime();
setInterval(updateTime, 60000); // Mise à jour toutes les minutes
window.addEventListener('DOMContentLoaded', () => {
    // On appelle le personnage avec le dialogue associé
    showCharacter();
});