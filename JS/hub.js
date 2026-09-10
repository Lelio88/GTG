/**
 * JS/hub.js - Hub de selection des modes solo.
 *
 * Trois entrees d'interaction convergent vers selectMode() : clavier
 * (fleches + Espace), pointeur (clic / tap) et geste tactile (swipe
 * horizontal). Ce point d'entree unique garantit que le neon, le curseur
 * clavier (currentFocusModes), l'etat ARIA et l'indice tactile ne divergent
 * jamais les uns des autres.
 *
 * Invariants :
 *  - selectedMode (nom du mode) et selectedEl (carte DOM) sont toujours
 *    ecrits ensemble : les desynchroniser casse le « appuyer deux fois ».
 *  - Le swipe est horizontal UNIQUEMENT : en portrait les cartes sont
 *    empilees, l'axe vertical appartient au scroll natif de la page
 *    (#modes-container porte touch-action: pan-y).
 *  - Le 2e appui qui lance la partie est reserve aux pointeurs grossiers
 *    (tactile) ; souris et clavier gardent Entree et « Lancer le jeu ».
 *
 * IDs DOM attendus : #modes-container, .game-mode[data-mode], #touch-hint,
 * #start-game, #back-button, #room-button, #export-save-btn, #keys-counter,
 * #keys-count, #completed-modes, #current-time.
 * Dependances : dialogue, saveManager, gameUtils, ui/dialog, achievements,
 * hellMode.
 */
import { showCharacter } from './dialogue.js';
import { exportSave } from './saveManager.js';
import { getProfiles } from './gameUtils.js';
import { showAlert } from './ui/dialog.js';
import { syncSeenAchievements, showAchievementToast } from './achievements.js';
import { applyHellMode } from './hellMode.js';

function refreshProfileData() {
    // On recharge les profils depuis le localStorage
    const profiles = getProfiles();
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
    full: "#FF4500",    
    sound: "#FFA500",   
    image: "#FF1493",   
    text: "#9400D3",

    pixelated: "#FF4500",
    midi: "#FFA500",
    shadow: "#FF1493",   
    emoji: "#9400D3"
};

let currentProfile = localStorage.getItem('currentProfile');
let currentFocusModes = 0;     // Indice du curseur clavier dans les modes
let selectedMode = null;        // Nom du mode selectionne (null = aucun)
let selectedEl = null;          // Carte DOM correspondante (jumelle de selectedMode)
let focusedSection = 'modes'; // Section active (par défaut 'profiles')

// Pointeur grossier = doigt. On interroge la MediaQueryList a chaque appel :
// brancher une souris sur une tablette bascule le mode d'interaction a chaud.
const coarsePointerQuery = window.matchMedia('(pointer: coarse)');
const isCoarsePointer = () => coarsePointerQuery.matches;

// Neon de selection : couleur complementaire de la bordure du mode.
const GLOW_BY_COLOR = {
    "#FFA500": "#FF4500", // Jaune  -> Orange
    "#FF4500": "#FFFF00", // Orange -> Jaune
    "#FF1493": "#0000FF", // Rose   -> Bleu
    "#9400D3": "#FF1493"  // Violet -> Rose
};
const DEFAULT_GLOW = "#FF4500";

if (currentProfile) {
    const profileData = getProfiles().find(p => p.pseudo === currentProfile);

    if (profileData) {
        const unlocked = profileData.unlockedModes || [];
        const completed = profileData.completedModes || [];

        // Configuration : Mode Base -> Mode Hardcore
        const hardcoreConfig = {
            full:  { target: 'pixelated', label: 'PIXELATED' },
            image: { target: 'shadow',    label: 'SHADOW' },
            sound: { target: 'midi',      label: 'MIDI' },
            text:  { target: 'emoji',     label: 'EMOJI' }
        };

        // Parcours des modes pour mise à jour
        for (const [baseMode, config] of Object.entries(hardcoreConfig)) {
            // Si le mode de base est FINI et le hardcore DÉBLOQUÉ
            if (completed.includes(baseMode) && unlocked.includes(config.target)) {
                
                const modeDiv = document.querySelector(`.game-mode[data-mode="${baseMode}"]`);
                
                if (modeDiv) {
                    // Mise à jour des données
                    modeDiv.dataset.mode = config.target;
                    // Le libellé visible vient de `label` ; `target` reste l'identifiant
                    // technique, porté par data-mode (routage vers HTML/<mode>.html).
                    modeDiv.innerText = config.label;
                    
                    // Mise à jour visuelle immédiate
                    const newColor = modeNeonMapping[config.target];
                    modeDiv.dataset.color = newColor;
                    modeDiv.style.borderColor = newColor;
                    modeDiv.style.boxShadow = `0 0 5px ${newColor}`;
                    
                    // Optionnel : Ajouter une classe CSS pour un effet supplémentaire
                    modeDiv.classList.add('hardcore-unlocked');
                }
            }
        }
    }
}

// === Referentiel des cartes de mode ===
// Le hub reecrit les cartes en place au deblocage hardcore (data-mode et
// libelle changent) : on relit le DOM avant chaque navigation.
function refreshModes() {
    allModes.length = 0;
    allModes.push(...document.querySelectorAll('.game-mode'));
    return allModes;
}

// === Indice tactile ===
// Affiche « appuyez de nouveau pour lancer » : sans lui, le 2e appui n'est pas
// devinable. Masque sur pointeur fin (souris/clavier ont Entree et le bouton).
const touchHint = document.getElementById('touch-hint');
const HINT_IDLE = 'Appuyez sur un mode pour le choisir · balayez pour naviguer';

function updateTouchHint() {
    if (!touchHint) return;

    const coarse = isCoarsePointer();
    touchHint.hidden = !coarse;
    if (!coarse) return;

    touchHint.innerText = selectedEl
        ? `Appuyez de nouveau sur « ${selectedEl.innerText} » pour lancer`
        : HINT_IDLE;
}

coarsePointerQuery.addEventListener('change', updateTouchHint);

// === Selection d'un mode (point d'entree unique) ===
function selectMode(modeDiv) {
    const modes = refreshModes();

    // Retirer l'effet neon et la selection des autres modes
    modes.forEach(div => {
        div.classList.remove('selected');
        div.style.boxShadow = `0 0 5px ${div.getAttribute('data-color')}`;  // Réinitialiser le box-shadow
        div.style.animation = 'none'; // Stopper l'animation précédente
        void div.offsetWidth; // Forcer le reflow pour redémarrer l'animation proprement
        div.setAttribute('aria-pressed', 'false');
    });

    // Ajouter l'effet neon au mode selectionne
    modeDiv.classList.add('selected');
    modeDiv.setAttribute('aria-pressed', 'true');

    const glowColor = GLOW_BY_COLOR[modeDiv.getAttribute('data-color')] || DEFAULT_GLOW;
    modeDiv.style.setProperty('--glow-color', glowColor);
    modeDiv.style.boxShadow = `0 0 10px ${glowColor}, 0 0 20px ${glowColor}`;
    modeDiv.style.animation = "neon-glow 1.5s infinite alternate";

    selectedMode = modeDiv.dataset.mode;
    selectedEl = modeDiv;

    // Un tap/clic deplace aussi le curseur clavier : sans cette synchro, une
    // fleche apres un tap ramenait le focus au premier mode de la liste.
    const index = modes.indexOf(modeDiv);
    if (index !== -1) currentFocusModes = index;

    updateTouchHint();
}

// === Lancement de la partie (bouton, touche Entree, 2e appui tactile) ===
function launchSelectedMode() {
    if (!selectedMode) {
        showAlert("Veuillez sélectionner un mode de jeu !", { title: 'Aucun mode selectionne' });
        return;
    }
    window.location.href = `../HTML/${selectedMode}.html`;
}

// === Initialisation des couleurs de chaque mode de jeu ===
document.querySelectorAll('.game-mode').forEach((modeDiv) => {
    const mode = modeDiv.dataset.mode;
    const color = modeNeonMapping[mode];
    modeDiv.style.borderColor = color;
    modeDiv.style.boxShadow = `0 0 5px ${color}`;
    modeDiv.setAttribute('data-color', color);

    // === Gestion du clic / tap ===
    modeDiv.addEventListener('click', (event) => {
        // Un swipe peut se terminer par un click de compatibilite sur la carte
        // de depart, qui annulerait la selection deplacee par le geste.
        // Mesure : Chromium n'en emet aucun au-dela de son seuil de glissement
        // (~8 px, tres en dessous de SWIPE_MIN_DISTANCE) -- la garde ne sert
        // donc que pour un moteur qui, lui, en emettrait un. Quand il existe,
        // ce click arrive dans la foulee immediate du touchend : la fenetre
        // reste courte pour ne jamais avaler un appui delibere (lever + reposer
        // le doigt prend bien davantage). Elle se purge seule -- un drapeau
        // booleen, lui, restait arme indefiniment faute de click et avalait
        // l'interaction suivante (Espace au clavier sur un appareil hybride).
        if (Date.now() - lastSwipeAt < SWIPE_CLICK_GUARD) return;

        // detail === 0 => click programmatique (touche Espace du clavier) : il
        // ne doit jamais declencher le lancement.
        const isPointerClick = event.detail !== 0;
        const wasSelected = selectedEl === modeDiv;

        selectMode(modeDiv);

        // Tactile : 2e appui sur un mode deja selectionne = lancer la partie.
        if (wasSelected && isPointerClick && isCoarsePointer()) {
            launchSelectedMode();
        }
    });

    // Désactiver l'effet du clavier si la souris survole un mode
    modeDiv.addEventListener('mouseover', () => {
        document.querySelectorAll('.game-mode').forEach(div => {
            div.classList.remove('keyboard-focus'); // Retirer l'effet du focus clavier sur tous les modes
        });
    });
});

// === Gestes tactiles : swipe horizontal = mode precedent / suivant ===
// Horizontal uniquement : l'axe vertical appartient au scroll de la page
// (les cartes sont empilees en portrait).
const SWIPE_MIN_DISTANCE = 48;   // px minimum pour parler de swipe
const SWIPE_AXIS_RATIO = 1.5;    // dominance horizontale exigee face au vertical
const SWIPE_MAX_DURATION = 800;  // ms au-dela desquels c'est un drag, pas un swipe

const SWIPE_CLICK_GUARD = 100;   // ms pendant lesquelles un click suivant un swipe est ignore

const modesContainer = document.getElementById('modes-container');
let touchOrigin = null;   // { x, y, time } du doigt au touchstart
let lastSwipeAt = 0;      // horodatage du dernier swipe reconnu (0 = jamais)

function moveSelection(delta) {
    const modes = refreshModes();
    if (modes.length === 0) return;

    // Premier geste sans selection : on amorce sur le curseur courant plutot
    // que de sauter un mode.
    if (!selectedEl) {
        selectMode(modes[Math.min(currentFocusModes, modes.length - 1)]);
        return;
    }

    const next = Math.min(Math.max(currentFocusModes + delta, 0), modes.length - 1);
    selectMode(modes[next]);
}

if (modesContainer) {
    modesContainer.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) {   // pinch / multi-touch : pas un swipe
            touchOrigin = null;
            return;
        }
        const touch = e.touches[0];
        touchOrigin = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    }, { passive: true });

    modesContainer.addEventListener('touchend', (e) => {
        if (!touchOrigin) return;

        const touch = e.changedTouches[0];
        const dx = touch.clientX - touchOrigin.x;
        const dy = touch.clientY - touchOrigin.y;
        const elapsed = Date.now() - touchOrigin.time;
        touchOrigin = null;

        if (elapsed > SWIPE_MAX_DURATION) return;
        if (Math.abs(dx) < SWIPE_MIN_DISTANCE) return;
        if (Math.abs(dx) < Math.abs(dy) * SWIPE_AXIS_RATIO) return; // geste vertical -> scroll

        lastSwipeAt = Date.now();
        moveSelection(dx < 0 ? 1 : -1);   // vers la gauche = mode suivant
    }, { passive: true });

    modesContainer.addEventListener('touchcancel', () => {
        touchOrigin = null;
    }, { passive: true });
}


// === Navigation avec les flèches ===
document.addEventListener('keydown', (e) => {
    // Mettre à jour les tableaux de modes
    const modes = refreshModes();
    // Si la section active est "modes"
    if (focusedSection === 'modes') {
        // Flèches gauche et droite pour naviguer entre les modes
        if (e.key === "ArrowLeft") {
            if (currentFocusModes > 0) currentFocusModes--; // Naviguer vers le mode précédent
        } else if (e.key === "ArrowRight") {
            if (currentFocusModes < modes.length - 1) currentFocusModes++; // Naviguer vers le mode suivant
        }

        // "Space" pour sélectionner un mode
        if (e.key === " ") {
            modes[currentFocusModes]?.click(); // Sélectionner le mode, avec un check pour undefined
        }

        // Appliquer le focus sur l'élément sélectionné (modes)
        modes.forEach(el => el.classList.remove('keyboard-focus'));
        if (modes[currentFocusModes]) {
            modes[currentFocusModes].classList.add('keyboard-focus');
        }
    }
    if (e.key === "Enter") {
        launchSelectedMode();
    }
});
// === Lancer le jeu avec le bouton ===
startBtn.onclick = launchSelectedMode;

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
    const currentProfile = getProfiles().find(p => p.pseudo === localStorage.getItem('currentProfile'));
    if (currentProfile && (currentProfile.keys > 0 || (currentProfile.completedModes && currentProfile.completedModes.length > 0))) {
        roomButton.style.display = 'block';
    } else {
        roomButton.style.display = 'none';
    }
    roomButton.addEventListener('click', () => {
        window.location.href = '../HTML/chamber.html';
    });
}

// Bouton export de sauvegarde
const exportSaveBtn = document.getElementById('export-save-btn');
if (exportSaveBtn) {
    exportSaveBtn.addEventListener('click', exportSave);
}

// Initialisation
refreshProfileData();
updateTouchHint();
updateTime();
setInterval(updateTime, 60000); // Mise à jour toutes les minutes
window.addEventListener('DOMContentLoaded', () => {
    // On appelle le personnage avec le dialogue associé.
    // showCharacter() incremente visitCount -> l'appeler AVANT la detection
    // des succes pour que "Habitué" (10 visites) tombe des la 10e visite.
    showCharacter();

    // Detection des succes fraichement debloques (jeux devines, cles, modes
    // hardcore, visites...) -> toast neon non-bloquant pour chacun.
    // Baseline silencieuse au tout premier passage (pas de spam retroactif).
    const { newly } = syncSeenAchievements();
    newly.forEach((def, i) => {
        setTimeout(() => showAchievementToast(def), i * 250);
    });

    // Theme Enfer si le profil a franchi 666 mauvaises reponses.
    applyHellMode(getProfiles().find(p => p.pseudo === localStorage.getItem('currentProfile')));
});