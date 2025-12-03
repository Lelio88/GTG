/* ============================
FULL MODE - Image + Sound + Text
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
}
currentProfile = initializeProfile(currentProfile);

// === Filter already found games ===
const availableGames = getAvailableGames(games, currentProfile, 'full');

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
    const contentDiv = document.getElementById('content');

    contentDiv.innerHTML = '';

    // Main container (column)
    const hintContainer = document.createElement('div');
    hintContainer.className = 'hint-container';
    hintContainer.style.display = 'flex';
    hintContainer.style.flexDirection = 'column';
    hintContainer.style.alignItems = 'center';
    hintContainer.style.marginBottom = '30px';

    // Row container for image + text
    const topRow = document.createElement('div');
    topRow.style.display = 'flex';
    topRow.style.flexDirection = 'row';
    topRow.style.alignItems = 'center';
    topRow.style.gap = '20px';

    // Image
    if (cachedGame.image[index]) {
        const img = document.createElement('img');
        img.src = cachedGame.image[index];
        img.alt = 'Indice image';
        img.style.width = '600px';
        img.style.height = 'auto';
        topRow.appendChild(img);
    }

    // Text to the right of the image
    if (cachedGame.text[index]) {
        const text = document.createElement('p');
        text.innerText = cachedGame.text[index];
        text.style.margin = '0';
        text.style.width = '400px';
        text.style.lineHeight = '1.4';
        text.style.fontSize = '1rem';
        topRow.appendChild(text);
    }

    hintContainer.appendChild(topRow);

    // Audio below image + text, centered
    if (cachedGame.sound[index]) {
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.style.marginTop = '30px';
        audio.style.width = '300px';

        const source = document.createElement('source');
        source.src = cachedGame.sound[index];
        source.type = 'audio/mpeg';
        audio.appendChild(source);

        hintContainer.appendChild(audio);
    }

    contentDiv.appendChild(hintContainer);

    // Update arrows visibility (only if arrows have been created)
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

    updateScoreboard(currentProfile);
}

function nextQuestion() {
    nextQuestionUtil();
}

function abandonGame() {
    revealTitle(cachedTitle, { mode: 'modal', autoAdvance: true, delay: 2000 })
        .then(() => {
            abandonGameUtil(currentProfile);
        });
}

// Expose functions to global context
window.checkAnswer = checkAnswer;
window.showHint = showHint;
window.nextQuestion = nextQuestion;

// Setup Enter key handler
setupEnterKeyHandler(checkAnswer, nextQuestion, () => correctAnswerGiven);

// On load
window.onload = () => {
    launchGameFull();
    document.getElementById('user-input').focus();
    updateScoreboard(currentProfile);
};
