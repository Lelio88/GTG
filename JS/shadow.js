/* ============================
SHADOW MODE (HARDCORE)
============================ */
import { games } from './gamesDatabase.js';
import { handleGameCompletion } from './gameCompletion.js';
import { renderHintShadow } from './hint-renderers.js';
import {
    getCurrentProfile,
    initializeProfile,
    updateProfile as updateProfileUtil,
    getAvailableGames,
    startTimer as startTimerUtil,
    stopTimer,
    abandonGame as abandonGameUtil,
    checkAnswerValue,
    updateScoreboard,
    resetGameUI,
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
    throw new Error('No profile selected');
}
currentProfile = initializeProfile(currentProfile);

// === Filter already found games (Mode SHADOW) ===
let availableGames = getAvailableGames(games, currentProfile, 'shadow');

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

    // Conservé pour compatibilité avec l'ancienne logique de révélation (non utilisé)
    gameImages = (cachedGame.shadow && cachedGame.shadow.length > 0) ? cachedGame.shadow : cachedGame.image;

    renderHintShadow(cachedGame, 0, contentDiv);

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
    // Reset etat JS
    cachedGame = null;
    cachedTitle = '';
    correctAnswerGiven = false;
    gameImages = [];
    stopTimer(timerInterval);

    // Reset UI
    resetGameUI();

    // Recharge la liste des jeux disponibles
    availableGames = getAvailableGames(games, currentProfile, 'shadow');

    // Relance le mode (re-configure aussi le bouton Indice -> Abandonner)
    launchGameShadow();
    document.getElementById('user-input').focus();
}

function abandonGame() {
    // Révélation de l'image (couleur)
    const imgElement = document.getElementById('game-image');
    if(imgElement) {
        imgElement.style.filter = 'none';
    }

    revealTitle(cachedTitle, { mode: 'modal', autoAdvance: true, delay: 2000 })
        .then(() => {
            abandonGameUtil(currentProfile, 'shadow', nextQuestion);
        });
}

// Expose functions
window.checkAnswer = checkAnswer;
// window.showHint = showHint; // Supprimé car inutile
window.nextQuestion = nextQuestion;

// Setup Enter key handler
setupEnterKeyHandler(checkAnswer, nextQuestion, () => correctAnswerGiven);

window.addEventListener('DOMContentLoaded', () => {
    launchGameShadow();
    document.getElementById('user-input').focus();
    updateScoreboard(currentProfile, 'shadow');
});