/* ============================
FULL MODE - Image + Sound + Text
============================ */
import { games } from './gamesDatabase.js';
import { handleGameCompletion } from './gameCompletion.js';
import { renderHintFull } from './hint-renderers.js';
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
let hintNav = null;
let arrowsCreated = false;

// === Get current profile ===
let currentProfile = getCurrentProfile();
if (!currentProfile) {
    window.location.href = '../index.html';
    throw new Error('No profile selected');
}
currentProfile = initializeProfile(currentProfile);

// === Filter already found games ===
let availableGames = getAvailableGames(games, currentProfile, 'full');

function launchGameFull() {
    if (availableGames.length === 0) {
        handleGameCompletion(currentProfile, 'full');
        return;
    }

    cachedGame = availableGames[Math.floor(Math.random() * availableGames.length)];
    cachedTitle = cachedGame.title;

    initializeGameTitle(cachedTitle);

    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = '';

    // Calculate total hints
    const totalHints = Math.max(
        cachedGame.image.length,
        cachedGame.sound.length,
        cachedGame.text.length
    );

    // Initialize hint navigation system
    hintNav = createHintNavigationSystem(totalHints);

    // Display first hint triplet
    displayHint(hintNav.currentIndex);

    timerInterval = startTimerUtil();
}

function displayHint(index) {
    renderHintFull(cachedGame, index, document.getElementById('content'));

    if (arrowsCreated) {
        updateArrowsVisibility(hintNav.currentIndex, hintNav.maxUnlockedIndex);
    }
}

function navigateHint(direction) {
    const newIndex = hintNav.currentIndex + direction;
    if (hintNav.navigateTo(newIndex)) {
        displayHint(hintNav.currentIndex);
    }
}

function showHint() {
    const hintButton = document.getElementById('hint-button');
    
    if (hintNav.unlockNext()) {
        displayHint(hintNav.currentIndex);

        // Create navigation arrows when unlocking the 2nd hint (maxUnlockedIndex becomes 1)
        if (hintNav.maxUnlockedIndex === 1 && !arrowsCreated) {
            createNavigationArrows(navigateHint);
            arrowsCreated = true;
        }

        // Update arrows visibility after navigation
        if (arrowsCreated) {
            updateArrowsVisibility(hintNav.currentIndex, hintNav.maxUnlockedIndex);
        }

        // If we've reached the last hint, change button to "Abandon"
        if (hintNav.isLastUnlocked()) {
            hintButton.innerText = "Abandonner";
            hintButton.onclick = abandonGame;
        }
    }
}

function checkAnswer() {
    const input = document.getElementById('user-input').value;
    
    // Check if correct answer was already given
    if (correctAnswerGiven) {
        return;
    }
    
    if (checkAnswerValue(input, cachedTitle)) {
        updateProfileUtil(currentProfile, cachedTitle, true, 'full');
        showCorrectAnswerFeedback(cachedTitle, timerInterval);
        correctAnswerGiven = true;
    } else {
        updateProfileUtil(currentProfile, cachedTitle, false, 'full');
        showIncorrectAnswerFeedback();
    }

    updateScoreboard(currentProfile, 'full');
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

    // Recharge la liste des jeux disponibles (le profil a peut-etre ete maj)
    availableGames = getAvailableGames(games, currentProfile, 'full');

    // Relance le mode
    launchGameFull();
    document.getElementById('user-input').focus();
}

function abandonGame() {
    revealTitle(cachedTitle, { mode: 'modal', autoAdvance: true, delay: 2000 })
        .then(() => {
            abandonGameUtil(currentProfile, 'full', nextQuestion);
        });
}

// Expose functions to global context
window.checkAnswer = checkAnswer;
window.showHint = showHint;
window.nextQuestion = nextQuestion;

// Setup Enter key handler
setupEnterKeyHandler(checkAnswer, nextQuestion, () => correctAnswerGiven);

// Flèches du clavier : naviguer entre indices (sauf si on tape dans l'input)
document.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const userInput = document.getElementById('user-input');
    if (document.activeElement === userInput && userInput.value.length > 0) return;
    if (!hintNav || hintNav.maxUnlockedIndex < 1) return;
    e.preventDefault();
    if (e.key === 'ArrowLeft') navigateHint(-1);
    if (e.key === 'ArrowRight') navigateHint(1);
});

// On load
window.addEventListener('DOMContentLoaded', () => {
    launchGameFull();
    document.getElementById('user-input').focus();
    updateScoreboard(currentProfile, 'full');
});
