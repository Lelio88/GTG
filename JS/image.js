/* ============================
IMAGE ONLY MODE
============================ */
import { games } from './gamesDatabase.js';
import { handleGameCompletion } from './gameCompletion.js';
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
    removeNavigationArrows,
    createHintNavigationSystem,
    nextQuestion as nextQuestionUtil,
    setupEnterKeyHandler,
    showCorrectAnswerFeedback,
    showIncorrectAnswerFeedback,
    initializeGameTitle
} from './gameUtils.js';

let timerInterval;
let cachedTitle = '';
let correctAnswerGiven = false;
let cachedGame = null;
let isInputFocused = false;
let arrowsCreated = false;
let hintNav = null;  // The navigation system

// === Get current profile ===
let currentProfile = getCurrentProfile();
if (!currentProfile) {
    window.location.href = '../index.html';
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

    // Initialize hint navigation system
    hintNav = createHintNavigationSystem(cachedGame.image.length);

    // Display first image
    displayImage(hintNav.currentIndex);

    timerInterval = startTimerUtil();

    // Setup keyboard navigation
    setupKeyboardNavigation();
}

function displayImage(index) {
    const contentDiv = document.getElementById('content');

    // Remove only non-arrow content (preserve arrows if they exist)
    const arrows = contentDiv.querySelectorAll('.nav-arrow');
    contentDiv.innerHTML = '';
    arrows.forEach(arrow => contentDiv.appendChild(arrow));

    const img = document.createElement('img');
    img.src = cachedGame.image[index];
    img.id = 'game-image';
    img.style.width = '100%';
    img.style.position = 'relative';
    img.style.transition = 'opacity 0.5s ease';
    
    // Insert image before arrows
    contentDiv.insertBefore(img, contentDiv.firstChild);

    // Update arrows visibility (only if arrows have been created)
    if (arrowsCreated) {
        updateArrowsVisibility(hintNav.currentIndex, hintNav.maxUnlockedIndex);
    }
}

function setupKeyboardNavigation() {
    // Keyboard listener for arrow keys
    document.addEventListener('keydown', (e) => {
        if (!isInputFocused) {
            if (e.key === 'ArrowLeft') navigateImage(-1);
            if (e.key === 'ArrowRight') navigateImage(1);
        }
    });

    // Input focus management
    const userInput = document.getElementById('user-input');
    userInput.addEventListener('focus', () => {
        isInputFocused = true;
    });

    userInput.addEventListener('blur', () => {
        isInputFocused = false;
    });
}

function navigateImage(direction) {
    const newIndex = hintNav.currentIndex + direction;
    if (hintNav.navigateTo(newIndex)) {
        const imgElement = document.getElementById('game-image');
        
        // Slider effect
        imgElement.style.opacity = '0';
        setTimeout(() => {
            imgElement.src = cachedGame.image[hintNav.currentIndex];
            imgElement.style.opacity = '1';
        }, 300);

        // Update arrows visibility
        if (arrowsCreated) {
            updateArrowsVisibility(hintNav.currentIndex, hintNav.maxUnlockedIndex);
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
        updateProfileUtil(currentProfile, cachedTitle, true, 'image');
        showCorrectAnswerFeedback(cachedTitle, timerInterval);
        correctAnswerGiven = true;
    } else {
        updateProfileUtil(currentProfile, cachedTitle, false, 'image');
        showIncorrectAnswerFeedback();
    }

    updateScoreboard(currentProfile);
}

function nextQuestion() {
    nextQuestionUtil();
}

function showHint() {
    const hintButton = document.getElementById('hint-button');

    if (hintNav.unlockNext()) {
        const imgElement = document.getElementById('game-image');

        // Slider effect
        imgElement.style.opacity = '0';
        setTimeout(() => {
            imgElement.src = cachedGame.image[hintNav.currentIndex];
            imgElement.style.opacity = '1';
        }, 300);

        // Create navigation arrows when unlocking the 2nd hint (index 1)
        if (hintNav.maxUnlockedIndex === 1 && !arrowsCreated) {
            createNavigationArrows(navigateImage);
            arrowsCreated = true;
            updateArrowsVisibility(hintNav.currentIndex, hintNav.maxUnlockedIndex);
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

function abandonGame() {
    abandonGameUtil(currentProfile);
}

// Expose functions to global context
window.checkAnswer = checkAnswer;
window.showHint = showHint;
window.nextQuestion = nextQuestion;

// Setup Enter key handler
setupEnterKeyHandler(checkAnswer, nextQuestion, () => correctAnswerGiven);

// On load
window.onload = () => {
    if (window.location.pathname.includes('image')) launchGameImage();
    document.getElementById('user-input').focus();
    updateScoreboard(currentProfile);
};
