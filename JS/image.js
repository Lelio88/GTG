/* ============================
IMAGE ONLY MODE
============================ */
import { games } from './gamesDatabase.js';
import { handleGameCompletion } from './gameCompletion.js';
import { renderHintImage } from './hint-renderers.js';
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
    nextQuestion as nextQuestionUtil,
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
let gameImages = [];
let isInputFocused = false;
let arrowsCreated = false;
let keyboardNavigationSetup = false;

// === Get current profile ===
let currentProfile = getCurrentProfile();
if (!currentProfile) {
    window.location.href = '../index.html';
    throw new Error('No profile selected');
}
currentProfile = initializeProfile(currentProfile);

// === Filter already found games ===
const availableGames = getAvailableGames(games, currentProfile, 'image');

function launchGameImage() {
    if (availableGames.length === 0) {
        handleGameCompletion(currentProfile, 'image');
        return;
    }

    cachedGame = availableGames[Math.floor(Math.random() * availableGames.length)];
    cachedTitle = cachedGame.title;

    initializeGameTitle(cachedTitle);

    const contentDiv = document.getElementById('content');
    gameImages = cachedGame.image;

    // Initialize hint navigation system
    hintNav = createHintNavigationSystem(gameImages.length);

    renderHintImage(cachedGame, hintNav.currentIndex, contentDiv);

    timerInterval = startTimerUtil();

    let hintButton = document.getElementById('hint-button');
    if (!hintButton) {
        hintButton = document.createElement('button');
        hintButton.id = 'hint-button';
        hintButton.innerText = "Indice";
        hintButton.onclick = showHint;
        document.getElementById('content').appendChild(hintButton);
    } else {
        hintButton.innerText = "Indice";
        hintButton.onclick = showHint;
    }
}

function setupKeyboardNavigation() {
    // Prevent adding duplicate event listeners
    if (keyboardNavigationSetup) return;
    keyboardNavigationSetup = true;

    const userInput = document.getElementById('user-input');

    // Keyboard listener for arrow keys.
    // Marche même si l'input a le focus, TANT QUE l'input est vide
    // (sinon on laisse le browser déplacer le curseur dans le texte saisi).
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        if (document.activeElement === userInput && userInput.value.length > 0) return;
        e.preventDefault();
        if (e.key === 'ArrowLeft') navigateImage(-1);
        if (e.key === 'ArrowRight') navigateImage(1);
    });
}

function navigateImage(direction) {
    const newIndex = hintNav.currentIndex + direction;

    if (hintNav.navigateTo(newIndex)) {
        renderHintImage(cachedGame, hintNav.currentIndex, document.getElementById('content'));
        updateArrowsVisibility(hintNav.currentIndex, hintNav.maxUnlockedIndex);
    }
}

function checkAnswer() {
    const input = document.getElementById('user-input').value;
    
    // Check if correct answer was already given
    if (correctAnswerGiven) {
        return;
    }
    
    if (checkAnswerValue(input, cachedTitle)) {
        updateProfileUtil(currentProfile, cachedTitle, true, 'image');
        showCorrectAnswerFeedback(cachedTitle, timerInterval);
        correctAnswerGiven = true;
    } else {
        updateProfileUtil(currentProfile, cachedTitle, false, 'image');
        showIncorrectAnswerFeedback();
    }

    updateScoreboard(currentProfile, 'image');
}

function nextQuestion() {
    nextQuestionUtil();
}

function showHint() {
    if (hintNav.unlockNext()) {
        renderHintImage(cachedGame, hintNav.currentIndex, document.getElementById('content'));

        // If we've reached the last image, change button to "Abandon"
        if (hintNav.isLastUnlocked()) {
            const hintButton = document.getElementById('hint-button');
            hintButton.innerText = "Abandonner";
            hintButton.onclick = abandonGame;
        }
    }
    
    // Create navigation arrows when unlocking the 2nd hint (maxUnlockedIndex becomes 1)
    if (hintNav.maxUnlockedIndex === 1 && !arrowsCreated) {
        createNavigationArrows(navigateImage);
        setupKeyboardNavigation();
        arrowsCreated = true;
    }

    // Update arrows visibility
    if (arrowsCreated) {
        updateArrowsVisibility(hintNav.currentIndex, hintNav.maxUnlockedIndex);
    }
}

function abandonGame() {
    revealTitle(cachedTitle, { mode: 'modal', autoAdvance: true, delay: 2000 })
        .then(() => {
            abandonGameUtil(currentProfile, 'image');
        });
}

// Expose functions to global context
window.checkAnswer = checkAnswer;
window.showHint = showHint;
window.nextQuestion = nextQuestion;

// Setup Enter key handler
setupEnterKeyHandler(checkAnswer, nextQuestion, () => correctAnswerGiven);

// On load
window.addEventListener('DOMContentLoaded', () => {
    launchGameImage();
    document.getElementById('user-input').focus();
    updateScoreboard(currentProfile, 'image');
});