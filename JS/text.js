/* ============================
TEXT ONLY MODE
============================ */
import { games } from './gamesDatabase.js';
import { handleGameCompletion } from './gameCompletion.js';
import { renderHintText } from './hint-renderers.js';
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
    createHintNavigationSystem,
    revealTitle
} from './gameUtils.js';

let cachedGame = null;
let cachedTitle = '';
let hintNav = null;
let correctAnswerGiven = false;
let timerInterval;

// === Get current profile ===
let currentProfile = getCurrentProfile();
if (!currentProfile) {
    window.location.href = '../index.html';
    throw new Error('No profile selected');
}
currentProfile = initializeProfile(currentProfile);

// === Filter already found games ===
let availableGames = getAvailableGames(games, currentProfile, 'text');

function launchGameText() {
    if (availableGames.length === 0) {
        handleGameCompletion(currentProfile, 'text');
        return;
    }

    cachedGame = availableGames[Math.floor(Math.random() * availableGames.length)];
    cachedTitle = cachedGame.title;

    initializeGameTitle(cachedTitle);

    const contentDiv = document.getElementById('content');

    // Initialize hint navigation system
    hintNav = createHintNavigationSystem(cachedGame.text.length);

    renderHintText(cachedGame, hintNav.currentIndex, contentDiv);
}

function showHint() {
    if (hintNav.unlockNext()) {
        renderHintText(cachedGame, hintNav.currentIndex, document.getElementById('content'));

        // Last hint? Change the button
        if (hintNav.isLastUnlocked()) {
            const hintButton = document.getElementById('hint-button');
            hintButton.innerText = "Abandonner";
            hintButton.onclick = abandonGame;
        }
    }
}

function abandonGame() {
    revealTitle(cachedTitle, { mode: 'modal', autoAdvance: true, delay: 2000 })
        .then(() => {
            abandonGameUtil(currentProfile, 'text', nextQuestion);
        });
}

function checkAnswer() {
    const input = document.getElementById('user-input').value;

    if (correctAnswerGiven) return;

    if (checkAnswerValue(input, cachedTitle)) {
        updateProfileUtil(currentProfile, cachedTitle, true, 'text');
        showCorrectAnswerFeedback(cachedTitle, timerInterval);
        correctAnswerGiven = true;
    } else {
        updateProfileUtil(currentProfile, cachedTitle, false, 'text');
        showIncorrectAnswerFeedback();
    }

    updateScoreboard(currentProfile, 'text');
}

function nextQuestion() {
    // Reset etat JS
    cachedGame = null;
    cachedTitle = '';
    correctAnswerGiven = false;
    hintNav = null;
    stopTimer(timerInterval);

    // Reset UI
    resetGameUI();

    // Recharge la liste des jeux disponibles
    availableGames = getAvailableGames(games, currentProfile, 'text');

    // Relance le mode + restart timer (text demarre le timer au DOMContentLoaded a part)
    launchGameText();
    timerInterval = startTimerUtil();
    document.getElementById('user-input').focus();
}

// Expose functions to global context
window.checkAnswer = checkAnswer;
window.showHint = showHint;
window.nextQuestion = nextQuestion;

// Setup Enter key handler
setupEnterKeyHandler(checkAnswer, nextQuestion, () => correctAnswerGiven);

// On load
window.addEventListener('DOMContentLoaded', () => {
    launchGameText();
    timerInterval = startTimerUtil();
    updateScoreboard(currentProfile, 'text');
    document.getElementById('user-input').focus();
});
