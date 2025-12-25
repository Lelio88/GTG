/* ============================
SHADOW MODE (HARDCORE)
============================ */
import { games } from './gamesDatabase.js';
import { handleGameCompletion } from './gameCompletion.js';
import {
    getCurrentProfile,
    initializeProfile,
    updateProfile as updateProfileUtil,
    getAvailableGames,
    startTimer as startTimerUtil,
    abandonGame as abandonGameUtil,
    checkAnswerValue,
    updateScoreboard,
    nextQuestion as nextQuestionUtil,
    setupEnterKeyHandler,
    showCorrectAnswerFeedback,
    showIncorrectAnswerFeedback,
    initializeGameTitle,
    revealTitle
} from './gameUtils.js';

let timerInterval;
let cachedTitle = '';
let cachedGame = null;
let correctAnswerGiven = false;
let gameImages = [];

// === Get current profile ===
let currentProfile = getCurrentProfile();
if (!currentProfile) {
    window.location.href = '../index.html';
}
currentProfile = initializeProfile(currentProfile);

// === Filter already found games (Mode SHADOW) ===
const availableGames = getAvailableGames(games, currentProfile, 'shadow');

function launchGameShadow() {
    // 1. Vérifier s'il reste des jeux
    if (availableGames.length === 0) {
        handleGameCompletion(currentProfile, 'shadow');
        return;
    }

    // 2. Sélectionner un jeu
    cachedGame = availableGames[Math.floor(Math.random() * availableGames.length)];
    cachedTitle = cachedGame.title;
    initializeGameTitle(cachedTitle);

    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = '';

    // 3. Définir la source de l'image
    // On prend le tableau shadow s'il existe, sinon fallback sur image
    if (cachedGame.shadow && cachedGame.shadow.length > 0) {
        gameImages = cachedGame.shadow;
    } else {
        gameImages = cachedGame.image;
    }

    // ============================================================
    // LE CADRE FIXE
    // ============================================================
    const imageWrapper = document.createElement('div');
    
    // Style du cadre
    imageWrapper.style.width = '100%';      
    imageWrapper.style.height = '40vh';
    imageWrapper.style.border = '2px solid black'; // Ou 'white' selon votre fond
    imageWrapper.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
    imageWrapper.style.boxSizing = 'border-box';
    
    // Centrage
    imageWrapper.style.display = 'flex';
    imageWrapper.style.justifyContent = 'center';
    imageWrapper.style.alignItems = 'center';
    imageWrapper.style.marginBottom = '20px';

    // ============================================================
    // L'IMAGE
    // ============================================================
    const img = document.createElement('img');
    
    // NOTE : On prend directement l'index [0] car c'est une image unique
    img.src = gameImages[0]; 
    img.id = 'game-image';
    
    // Style de l'image
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.style.objectFit = 'contain';
    img.style.border = 'none'; 
    img.style.outline = 'none';
    img.style.boxShadow = 'none';
    
    // Effet d'ombre
    img.style.filter = 'brightness(0)'; 
    img.style.transition = 'opacity 0.5s ease, filter 0.5s ease';

    // Assemblage
    imageWrapper.appendChild(img);
    contentDiv.appendChild(imageWrapper);

    // 4. Timer
    timerInterval = startTimerUtil();

    // 5. Bouton Abandonner (Directement, pas de logique d'indice)
    let hintButton = document.getElementById('hint-button');
    if (!hintButton) {
        hintButton = document.createElement('button');
        hintButton.id = 'hint-button';
        document.getElementById('content').appendChild(hintButton);
    }
    
    hintButton.innerText = "Abandonner";
    hintButton.onclick = abandonGame;
}

function checkAnswer() {
    const input = document.getElementById('user-input').value;
    
    if (correctAnswerGiven) {
        return;
    }
    
    if (checkAnswerValue(input, cachedTitle)) {
        // Révélation de l'image (couleur)
        const imgElement = document.getElementById('game-image');
        if(imgElement) imgElement.style.filter = 'none';

        updateProfileUtil(currentProfile, cachedTitle, true, 'shadow');
        showCorrectAnswerFeedback(cachedTitle, timerInterval);
        correctAnswerGiven = true;
    } else {
        updateProfileUtil(currentProfile, cachedTitle, false, 'shadow');
        showIncorrectAnswerFeedback();
    }

    updateScoreboard(currentProfile, 'shadow');
}

function nextQuestion() {
    nextQuestionUtil();
}

function abandonGame() {
    // Révélation de l'image (couleur)
    const imgElement = document.getElementById('game-image');
    if(imgElement) {
        imgElement.style.filter = 'none';
    }

    revealTitle(cachedTitle, { mode: 'modal', autoAdvance: true, delay: 2000 })
        .then(() => {
            abandonGameUtil(currentProfile, 'shadow');
        });
}

// Expose functions
window.checkAnswer = checkAnswer;
// window.showHint = showHint; // Supprimé car inutile
window.nextQuestion = nextQuestion;

// Setup Enter key handler
setupEnterKeyHandler(checkAnswer, nextQuestion, () => correctAnswerGiven);

window.onload = () => {
    if (window.location.pathname.includes('shadow')) launchGameShadow();
    document.getElementById('user-input').focus();
    updateScoreboard(currentProfile, 'shadow');
};