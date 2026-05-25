/* ============================
SOUND ONLY MODE
============================ */
import { games } from './gamesDatabase.js';
import { handleGameCompletion } from './gameCompletion.js';
import { renderHintSound } from './hint-renderers.js';
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
    createNavigationArrows,
    updateArrowsVisibility,
    resetGameUI,
    setupEnterKeyHandler,
    showCorrectAnswerFeedback,
    showIncorrectAnswerFeedback,
    initializeGameTitle,
    createHintNavigationSystem,
    revealTitle
} from './gameUtils.js';

let timerInterval;
let cachedTitle = '';
let cachedGame = null;
let correctAnswerGiven = false;
let arrowsCreated = false;
let hintNav = null;

// === Get current profile ===
let currentProfile = getCurrentProfile();
if (!currentProfile) {
    window.location.href = '../index.html';
    throw new Error('No profile selected');
}
currentProfile = initializeProfile(currentProfile);

// === Filter already found games in "sound" mode ===
let availableGames = getAvailableGames(games, currentProfile, 'sound');

function launchGameMusic() {
    if (availableGames.length === 0) {
        handleGameCompletion(currentProfile, 'sound');
        return;
    }

    cachedGame = availableGames[Math.floor(Math.random() * availableGames.length)];
    cachedTitle = cachedGame.title;

    initializeGameTitle(cachedTitle);

    const contentDiv = document.getElementById('content');

    // Initialize hint navigation system with 0-based indexing
    hintNav = createHintNavigationSystem(cachedGame.sound.length);

    renderHintSound(cachedGame, hintNav.currentIndex, contentDiv);

    timerInterval = startTimerUtil();
}

function navigateAudio(direction) {
    const newIndex = hintNav.currentIndex + direction;

    if (hintNav.navigateTo(newIndex)) {
        renderHintSound(cachedGame, hintNav.currentIndex, document.getElementById('content'));
        document.getElementById('game-audio').play();
        updateArrowsVisibility(hintNav.currentIndex, hintNav.maxUnlockedIndex);
    }
}

function showHint() {
    const hintButton = document.getElementById('hint-button');

    if (hintNav.unlockNext()) {
        renderHintSound(cachedGame, hintNav.currentIndex, document.getElementById('content'));
        document.getElementById('game-audio').play();

        if (hintNav.maxUnlockedIndex === 1 && !arrowsCreated) {
            createNavigationArrows(navigateAudio);
            arrowsCreated = true;
        }
        updateArrowsVisibility(hintNav.currentIndex, hintNav.maxUnlockedIndex);
    }

    if (hintNav.isLastUnlocked()) {
        hintButton.innerText = "Abandonner";
        hintButton.onclick = abandonGame;
    }
}

function abandonGame() {
    revealTitle(cachedTitle, { mode: 'modal', autoAdvance: true, delay: 2000 })
        .then(() => {
            abandonGameUtil(currentProfile, 'sound', nextQuestion);
        });
}

function checkAnswer() {
    const input = document.getElementById('user-input').value;

    if (correctAnswerGiven) {
        return;
    }

    if (checkAnswerValue(input, cachedTitle)) {
        updateProfileUtil(currentProfile, cachedTitle, true, 'sound');
        showCorrectAnswerFeedback(cachedTitle, timerInterval);
        correctAnswerGiven = true;
    } else {
        updateProfileUtil(currentProfile, cachedTitle, false, 'sound');
        showIncorrectAnswerFeedback();
    }

    updateScoreboard(currentProfile, 'sound');
}

function nextQuestion() {
    // Reset etat JS
    cachedGame = null;
    cachedTitle = '';
    correctAnswerGiven = false;
    hintNav = null;
    arrowsCreated = false;
    stopTimer(timerInterval);

    // Reset UI
    resetGameUI();

    // Recharge la liste des jeux disponibles
    availableGames = getAvailableGames(games, currentProfile, 'sound');

    // Relance le mode
    launchGameMusic();
    document.getElementById('user-input').focus();
}

// Expose showHint et nextQuestion en global -- consommees par gameUtils.js
window.showHint = showHint;
window.nextQuestion = nextQuestion;

// Setup Enter key handler
setupEnterKeyHandler(checkAnswer, nextQuestion, () => correctAnswerGiven);

// Flèches du clavier : naviguer entre indices audio (sauf si on tape dans l'input)
document.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const userInput = document.getElementById('user-input');
    if (document.activeElement === userInput && userInput.value.length > 0) return;
    if (!hintNav || hintNav.maxUnlockedIndex < 1) return;  // pas encore débloqué d'autres
    e.preventDefault();
    if (e.key === 'ArrowLeft') navigateAudio(-1);
    if (e.key === 'ArrowRight') navigateAudio(1);
});

// On load
window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('hint-button').addEventListener('click', showHint);
    document.getElementById('check-button').addEventListener('click', checkAnswer);
    document.getElementById('next-button').addEventListener('click', nextQuestion);
    launchGameMusic();
    updateScoreboard(currentProfile, 'sound');
    document.getElementById('user-input').focus();
});
