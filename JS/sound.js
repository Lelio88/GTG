/* ============================
SOUND ONLY MODE
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
let arrowsCreated = false;
let hintNav = null;  // The navigation system

// === Get current profile ===
let currentProfile = getCurrentProfile();
if (!currentProfile) {
    window.location.href = '../index.html';
}
currentProfile = initializeProfile(currentProfile);

// === Filter already found games in "sound" mode ===
const availableGames = getAvailableGames(games, currentProfile, 'sound');

function launchGameMusic() {
    if (availableGames.length === 0) {
        handleGameCompletion(currentProfile, 'sound');
        return;
    }

    cachedGame = availableGames[Math.floor(Math.random() * availableGames.length)];
    cachedTitle = cachedGame.title;

    initializeGameTitle(cachedTitle);

    // Initialize hint navigation system
    hintNav = createHintNavigationSystem(cachedGame.sound.length);

    // Display first sound
    displaySound(hintNav.currentIndex);

    timerInterval = startTimerUtil();
}

function displaySound(index) {
    const contentDiv = document.getElementById('content');

    // Remove only non-arrow content (preserve arrows if they exist)
    const arrows = contentDiv.querySelectorAll('.nav-arrow');
    contentDiv.innerHTML = '';
    arrows.forEach(arrow => contentDiv.appendChild(arrow));

    const audio = document.createElement('audio');
    audio.src = cachedGame.sound[index];
    audio.id = 'game-audio';
    audio.autoplay = false;
    audio.loop = false;
    audio.controls = true;
    audio.style.width = '100%';
    audio.style.position = 'relative';
    audio.style.transition = 'opacity 0.5s ease';
    
    // Insert audio before arrows
    contentDiv.insertBefore(audio, contentDiv.firstChild);

    // Update arrows visibility (only if arrows have been created)
    if (arrowsCreated) {
        updateArrowsVisibility(hintNav.currentIndex, hintNav.maxUnlockedIndex);
    }
}

function navigateAudio(direction) {
    const newIndex = hintNav.currentIndex + direction;
    if (hintNav.navigateTo(newIndex)) {
        displaySound(hintNav.currentIndex);
        const audio = document.querySelector('audio');
        audio.play();
    }
}

function showHint() {
    const hintButton = document.getElementById('hint-button');

    if (hintNav.unlockNext()) {
        displaySound(hintNav.currentIndex);
        const audio = document.querySelector('audio');
        audio.play();

        // Create navigation arrows when unlocking the 2nd hint (index 1)
        if (hintNav.maxUnlockedIndex === 1 && !arrowsCreated) {
            createNavigationArrows(navigateAudio);
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

    updateScoreboard(currentProfile);
}

function nextQuestion() {
    nextQuestionUtil();
}

// Expose functions to global context
window.checkAnswer = checkAnswer;
window.showHint = showHint;
window.nextQuestion = nextQuestion;

// Setup Enter key handler
setupEnterKeyHandler(checkAnswer, nextQuestion, () => correctAnswerGiven);

// On load
window.onload = () => {
    launchGameMusic();
    updateScoreboard(currentProfile);
    document.getElementById('user-input').focus();
};
