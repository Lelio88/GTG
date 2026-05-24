/* ============================
    MIDI MODE
   ============================ */
import { games } from './gamesDatabase.js';
import { handleGameCompletion } from './gameCompletion.js';
import { renderHintMidi, cleanupMidi } from './hint-renderers.js';
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
    throw new Error('No profile selected');
}
currentProfile = initializeProfile(currentProfile);

// === Filter already found games in "midi" mode ===
const availableGames = getAvailableGames(games, currentProfile, 'midi');

async function launchGameMidi() {
    if (availableGames.length === 0) {
        handleGameCompletion(currentProfile, 'midi');
        return;
    }

    cachedGame = availableGames[Math.floor(Math.random() * availableGames.length)];
    cachedTitle = cachedGame.title;

    initializeGameTitle(cachedTitle);

    const contentDiv = document.getElementById('content');
    await renderHintMidi(cachedGame, 0, contentDiv);

    timerInterval = startTimerUtil();
}

function showHint() {
    // Since there's only one MIDI file, directly abandon
    abandonGame();
}

function abandonGame() {
    revealTitle(cachedTitle, { mode: 'modal', autoAdvance: true, delay: 2000 })
        .then(() => {
            cleanupMidi();
            abandonGameUtil(currentProfile, 'midi');
        });
}

function checkAnswer() {
    const input = document.getElementById('user-input').value;

    if (correctAnswerGiven) {
        return;
    }

    if (checkAnswerValue(input, cachedTitle)) {
        updateProfileUtil(currentProfile, cachedTitle, true, 'midi');
        showCorrectAnswerFeedback(cachedTitle, timerInterval);
        correctAnswerGiven = true;
        cleanupMidi();
    } else {
        updateProfileUtil(currentProfile, cachedTitle, false, 'midi');
        showIncorrectAnswerFeedback();
    }

    updateScoreboard(currentProfile, 'midi');
}

function nextQuestion() {
    cleanupMidi();
    correctAnswerGiven = false;

    // Remove old content
    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = '';

    // Reload page to start new question
    window.location.reload();
}

// Expose functions to global context
window.checkAnswer = checkAnswer;
window.showHint = showHint;
window.nextQuestion = nextQuestion;

// Setup Enter key handler
setupEnterKeyHandler(checkAnswer, nextQuestion, () => correctAnswerGiven);

// On load
window.onload = () => {
    launchGameMidi();
    updateScoreboard(currentProfile, 'midi');
    document.getElementById('user-input').focus();
};

// Cleanup on page unload
window.addEventListener('beforeunload', cleanupMidi);