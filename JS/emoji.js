/* ============================
   EMOJI MODE
   ============================ */
import { games } from './gamesDatabase.js';
import { handleGameCompletion } from './gameCompletion.js';
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
let gameImages = [];

// === Get current profile ===
let currentProfile = getCurrentProfile();
if (!currentProfile) {
    window.location.href = '../index.html';
}
currentProfile = initializeProfile(currentProfile);
}

// === Filter already found games in "emoji" mode ===
const availableGames = getAvailableGames(games, currentProfile, 'emoji');

function launchGameEmoji() {
    if (availableGames. length === 0) {
        handleGameCompletion(currentProfile, 'emoji');
        return;
    }

    cachedGame = availableGames[Math.floor(Math.random() * availableGames.length)];
    cachedTitle = cachedGame.title;

    initializeGameTitle(cachedTitle);

    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = '';

    // Create emoji display (simple, centered like text mode)
    const emojiText = document.createElement('p');
    emojiText.id = 'emoji-display';
    emojiText. innerText = cachedGame.emoji;
    emojiText.style.cssText = `
        font-size: 60px;
        text-align: center;
        padding: 40px;
        line-height: 1.5;
    `;

    contentDiv.appendChild(emojiText);

    timerInterval = startTimerUtil();
}

function checkAnswer() {
    const input = document.getElementById('user-input').value;
    
    if (correctAnswerGiven) {
        return;
    }
    
    if (checkAnswerValue(input, cachedTitle)) {
        // Révélation de l'image (couleur)
        const imgElement = document.getElementById('game-image');
        if(imgElement) imgElement.style.filter = 'none';

        updateProfileUtil(currentProfile, cachedTitle, true, 'shadow');
        showCorrectAnswerFeedback(cachedTitle, timerInterval);
        correctAnswerGiven = true;
    } else {
        updateProfileUtil(currentProfile, cachedTitle, false, 'shadow');
        showIncorrectAnswerFeedback();
    }

    updateScoreboard(currentProfile, 'shadow');
}

function nextQuestion() {
    nextQuestionUtil();
}

function abandonGame() {
    // Révélation de l'image (couleur)
    const imgElement = document.getElementById('game-image');
    if(imgElement) {
        imgElement.style.filter = 'none';
    }

    revealTitle(cachedTitle, { mode: 'modal', autoAdvance: true, delay: 2000 })
        .then(() => {
            abandonGameUtil(currentProfile, 'shadow');
        });
}

// Expose functions
window.checkAnswer = checkAnswer;
// window.showHint = showHint; // Supprimé car inutile
window.nextQuestion = nextQuestion;

// Setup Enter key handler
setupEnterKeyHandler(checkAnswer, nextQuestion, () => correctAnswerGiven);

window.onload = () => {
    if (window.location.pathname.includes('shadow')) launchGameShadow();
    document.getElementById('user-input').focus();
    updateScoreboard(currentProfile, 'shadow');
};


