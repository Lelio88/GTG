/* ============================
   EMOJI MODE
   ============================ */
import { games } from './gamesDatabase.js';
import { handleGameCompletion } from './gameCompletion.js';
import { renderHintEmoji } from './hint-renderers.js';
import {
    getCurrentProfile,
    initializeProfile,
    updateProfile as updateProfileUtil,
    getAvailableGames,
    startTimer as startTimerUtil,
    abandonGame as abandonGameUtil,
    checkAnswerValue,
    updateScoreboard,
    nextQuestion as nextQuestionUtil,
    setupEnterKeyHandler,
    showCorrectAnswerFeedback,
    showIncorrectAnswerFeedback,
    initializeGameTitle,
    revealTitle
} from './gameUtils.js';

let timerInterval;
let cachedTitle = '';
let cachedGame = null;
let correctAnswerGiven = false;

// === Get current profile ===
let currentProfile = getCurrentProfile();
if (!currentProfile) {
    window.location.href = '../index.html';
}
currentProfile = initializeProfile(currentProfile);

// === Filter already found games in "emoji" mode ===
const availableGames = getAvailableGames(games, currentProfile, 'emoji');

function launchGameEmoji() {
    if (availableGames.length === 0) {
        handleGameCompletion(currentProfile, 'emoji');
        return;
    }

    cachedGame = availableGames[Math.floor(Math.random() * availableGames.length)];
    cachedTitle = cachedGame.title;

    initializeGameTitle(cachedTitle);

    const contentDiv = document.getElementById('content');
    renderHintEmoji(cachedGame, 0, contentDiv);
}

function checkAnswer() {
    const input = document.getElementById('user-input').value;
    
    if (correctAnswerGiven) {
        return;
    }
    
    if (checkAnswerValue(input, cachedTitle)) {
        updateProfileUtil(currentProfile, cachedTitle, true, 'emoji');
        showCorrectAnswerFeedback(cachedTitle, timerInterval);
        correctAnswerGiven = true;
    } else {
        updateProfileUtil(currentProfile, cachedTitle, false, 'emoji');
        showIncorrectAnswerFeedback();
    }

    updateScoreboard(currentProfile, 'emoji');
}

function nextQuestion() {
    nextQuestionUtil();
}

function abandonGame() {
    revealTitle(cachedTitle, { mode: 'modal', autoAdvance: true, delay: 2000 })
        .then(() => {
            abandonGameUtil(currentProfile, 'emoji');
        });
}

// Expose functions
window.checkAnswer = checkAnswer;
window.nextQuestion = nextQuestion;

// Setup Enter key handler
setupEnterKeyHandler(checkAnswer, nextQuestion, () => correctAnswerGiven);

window.onload = () => {
    launchGameEmoji();
    timerInterval = startTimerUtil();
    updateScoreboard(currentProfile, 'emoji');
    document.getElementById('user-input').focus();
    
    // Configure abandon button
    const hintButton = document.getElementById('hint-button');
    if (hintButton) {
        hintButton.innerText = "Abandonner";
        hintButton.onclick = abandonGame;
    }
};
