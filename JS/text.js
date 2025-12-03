/* ============================
TEXT ONLY MODE
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
    nextQuestion as nextQuestionUtil,
    setupEnterKeyHandler,
    showCorrectAnswerFeedback,
    showIncorrectAnswerFeedback,
    initializeGameTitle
} from './gameUtils.js';

let cachedGame = null;
let cachedTitle = '';
let currentHintIndex = 0;
let correctAnswerGiven = false;
let timerInterval;

// === Get current profile ===
let currentProfile = getCurrentProfile();
currentProfile = initializeProfile(currentProfile);

// === Filter already found games ===
const availableGames = getAvailableGames(games, currentProfile, 'text');

function launchGameText() {
    if (availableGames.length === 0) {
        handleGameCompletion(currentProfile, 'text');
        return;
    }

    cachedGame = availableGames[Math.floor(Math.random() * availableGames.length)];
    cachedTitle = cachedGame.title;

    initializeGameTitle(cachedTitle);

    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = ''; // reset
    currentHintIndex = 0;

    // Display first paragraph
    const p = document.createElement('p');
    p.textContent = cachedGame.text[currentHintIndex];
    contentDiv.appendChild(p);
}

function showHint() {
    const contentDiv = document.getElementById('content');

    if (currentHintIndex < cachedGame.text.length - 1) {
        currentHintIndex++;
        const p = document.createElement('p');
        p.textContent = cachedGame.text[currentHintIndex];
        contentDiv.appendChild(p);

        // Last hint? Change the button
        if (currentHintIndex === cachedGame.text.length - 1) {
            const hintButton = document.getElementById('hint-button');
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

    if (correctAnswerGiven) return;

    if (checkAnswerValue(input, cachedTitle)) {
        updateProfileUtil(currentProfile, cachedTitle, true, 'text');
        showCorrectAnswerFeedback(cachedTitle, timerInterval);
        correctAnswerGiven = true;
    } else {
        updateProfileUtil(currentProfile, cachedTitle, false, 'text');
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
    launchGameText();
    timerInterval = startTimerUtil();
    updateScoreboard(currentProfile);
    document.getElementById('user-input').focus();
};
