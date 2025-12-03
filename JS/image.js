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
    nextQuestion as nextQuestionUtil,
    setupEnterKeyHandler,
    showCorrectAnswerFeedback,
    showIncorrectAnswerFeedback,
    initializeGameTitle
} from './gameUtils.js';

let timerInterval;
let cachedTitle = '';
let correctAnswerGiven = false;
let currentHintIndex = 0;
let maxHintIndex = 0;
let gameImages = [];
let cachedGame = null;
let isInputFocused = false;
let arrowsCreated = false;

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

    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = '';

    gameImages = cachedGame.image;
    currentHintIndex = 0;
    maxHintIndex = 0;

    const img = document.createElement('img');
    img.src = gameImages[currentHintIndex];
    img.id = 'game-image';
    img.style.width = '100%';
    img.style.position = 'relative';
    img.style.transition = 'opacity 0.5s ease';
    contentDiv.appendChild(img);

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

function createNavigationArrowsForImage() {
    if (arrowsCreated) return;

    createNavigationArrows(navigateImage);

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

    arrowsCreated = true;
}

function navigateImage(direction) {
    const imgElement = document.getElementById('game-image');

    if (direction === -1 && currentHintIndex > 0) {
        currentHintIndex--;
    } else if (direction === 1 && currentHintIndex < maxHintIndex) {
        currentHintIndex++;
    }

    // Slider effect
    imgElement.style.opacity = '0';
    setTimeout(() => {
        imgElement.src = gameImages[currentHintIndex];
        imgElement.style.opacity = '1';
    }, 300);
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
    if (maxHintIndex < gameImages.length - 1) {
        maxHintIndex++;
        currentHintIndex = maxHintIndex;

        const imgElement = document.getElementById('game-image');

        // Slider effect
        imgElement.style.opacity = '0';
        setTimeout(() => {
            imgElement.src = gameImages[currentHintIndex];
            imgElement.style.opacity = '1';
        }, 300);

        // If we've reached the last image, change button to "Abandon"
        if (maxHintIndex === gameImages.length - 1) {
            const hintButton = document.getElementById('hint-button');
            hintButton.innerText = "Abandonner";
            hintButton.onclick = abandonGame;
        }
    }
    if (maxHintIndex === 1 && !arrowsCreated) {
        createNavigationArrowsForImage();
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
