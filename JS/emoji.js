/* ============================
   EMOJI MODE
   ============================ */
import { games } from './gamesDatabase.js';
import { handleGameCompletion } from './gameCompletion.js';
import { renderHintEmoji } from './hint-renderers.js';
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

// === Get current profile ===
let currentProfile = getCurrentProfile();
if (!currentProfile) {
    window.location.href = '../index.html';
    throw new Error('No profile selected');
}
currentProfile = initializeProfile(currentProfile);

// === Filter already found games in "emoji" mode ===
let availableGames = getAvailableGames(games, currentProfile, 'emoji');

function launchGameEmoji() {
    if (availableGames.length === 0) {
        handleGameCompletion(currentProfile, 'emoji');
        return;
    }

    cachedGame = availableGames[Math.floor(Math.random() * availableGames.length)];
    cachedTitle = cachedGame.title;

    initializeGameTitle(cachedTitle);

    const contentDiv = document.getElementById('content');
    renderHintEmoji(cachedGame, 0, contentDiv);
}

function checkAnswer() {
    const input = document.getElementById('user-input').value;
    
    if (correctAnswerGiven) {
        return;
    }
    
    if (checkAnswerValue(input, cachedTitle)) {
        updateProfileUtil(currentProfile, cachedTitle, true, 'emoji');
        showCorrectAnswerFeedback(cachedTitle, timerInterval);
        correctAnswerGiven = true;
    } else {
        updateProfileUtil(currentProfile, cachedTitle, false, 'emoji');
        showIncorrectAnswerFeedback();
    }

    updateScoreboard(currentProfile, 'emoji');
}

function nextQuestion() {
    // Reset etat JS
    cachedGame = null;
    cachedTitle = '';
    correctAnswerGiven = false;
    stopTimer(timerInterval);

    // Reset UI (le mode emoji utilise le bouton Indice comme Abandonner direct)
    resetGameUI();

    // Recharge la liste des jeux disponibles
    availableGames = getAvailableGames(games, currentProfile, 'emoji');

    // Relance le mode
    launchGameEmoji();
    timerInterval = startTimerUtil();
    document.getElementById('user-input').focus();

    // Reconfigure le bouton Indice en Abandonner (specificite emoji)
    const hintButton = document.getElementById('hint-button');
    if (hintButton) {
        hintButton.innerText = "Abandonner";
        hintButton.onclick = abandonGame;
    }
}

function abandonGame() {
    revealTitle(cachedTitle, { mode: 'modal', autoAdvance: true, delay: 2000 })
        .then(() => {
            abandonGameUtil(currentProfile, 'emoji', nextQuestion);
        });
}

// Expose functions
window.checkAnswer = checkAnswer;
window.nextQuestion = nextQuestion;

// Setup Enter key handler
setupEnterKeyHandler(checkAnswer, nextQuestion, () => correctAnswerGiven);

window.addEventListener('DOMContentLoaded', () => {
    launchGameEmoji();
    timerInterval = startTimerUtil();
    updateScoreboard(currentProfile, 'emoji');
    document.getElementById('user-input').focus();

    // Configure abandon button
    const hintButton = document.getElementById('hint-button');
    if (hintButton) {
        hintButton.innerText = "Abandonner";
        hintButton.onclick = abandonGame;
    }
});
