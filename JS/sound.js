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
    nextQuestion as nextQuestionUtil,
    setupEnterKeyHandler,
    showCorrectAnswerFeedback,
    showIncorrectAnswerFeedback,
    initializeGameTitle
} from './gameUtils.js';

let timerInterval;
let cachedTitle = '';
let currentHintIndex = 0;
let correctAnswerGiven = false;
let cachedGame = null;
let arrowsCreated = false;
let maxHintIndex = 1; // Start at 1 because we have the first sound

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

    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = '';

    currentHintIndex = 1;

    const audio = document.createElement('audio');
    audio.src = cachedGame.sound[0]; // First sound by default
    audio.id = 'game-audio';
    audio.autoplay = false;
    audio.loop = false;
    audio.controls = true;
    audio.style.width = '100%';
    audio.style.position = 'relative';
    audio.style.transition = 'opacity 0.5s ease';
    contentDiv.appendChild(audio);

    timerInterval = startTimerUtil();
}

function updateArrowsVisibilitySound() {
    const leftArrow = document.querySelector('.nav-arrow.left');
    const rightArrow = document.querySelector('.nav-arrow.right');

    if (leftArrow && rightArrow) {
        // Manage visibility based on current index
        leftArrow.style.display = currentHintIndex > 1 ? 'block' : 'none';
        rightArrow.style.display = currentHintIndex < maxHintIndex ? 'block' : 'none';
    }
}

function navigateAudio(direction) {
    const newIndex = currentHintIndex + direction;

    // Navigate only between 1 and max unlocked hints
    if (newIndex >= 1 && newIndex <= maxHintIndex) {
        currentHintIndex = newIndex;
        const audio = document.querySelector('audio');
        audio.src = cachedGame.sound[currentHintIndex - 1];
        audio.play();
        updateArrowsVisibilitySound();
    }
}

function showHint() {
    const hintButton = document.getElementById('hint-button');

    if (maxHintIndex < cachedGame.sound.length) {
        maxHintIndex++;
        currentHintIndex = maxHintIndex;

        const audio = document.querySelector('audio');
        audio.src = cachedGame.sound[currentHintIndex - 1];
        audio.play();

        if (maxHintIndex > 1 && !arrowsCreated) {
            createNavigationArrows(navigateAudio);
            arrowsCreated = true;
        }
        updateArrowsVisibilitySound();
    }

    if (maxHintIndex === cachedGame.sound.length) {
        hintButton.innerText = "Abandonner";
        hintButton.onclick = abandonGame;
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
