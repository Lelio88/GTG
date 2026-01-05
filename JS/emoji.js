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
}
currentProfile = initializeProfile(currentProfile);

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

    // Create emoji container
    const emojiContainer = document.createElement('div');
    emojiContainer.id = 'emoji-container';
    emojiContainer.style. cssText = `
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 200px;
        font-size: 80px;
        gap: 20px;
        padding: 40px;
        background:  linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 20px;
        box-shadow:  0 10px 30px rgba(0,0,0,0.3);
        flex-wrap: wrap;
        margin: 20px 0;
    `;

    // Display emojis
    const emojis = cachedGame.emoji. split(' ');
    emojis.forEach(emoji => {
        const emojiSpan = document.createElement('span');
        emojiSpan. innerText = emoji;
        emojiSpan.style.cssText = `
            animation: bounce 0.6s ease-in-out infinite alternate;
            display: inline-block;
        `;
        emojiContainer.appendChild(emojiSpan);
    });

    contentDiv.appendChild(emojiContainer);

    // Add CSS animation
    if (! document.getElementById('emoji-animation-style')) {
        const style = document.createElement('style');
        style.id = 'emoji-animation-style';
        style.innerHTML = `
            @keyframes bounce {
                from { transform: translateY(0px); }
                to { transform:  translateY(-10px); }
            }
            #emoji-container span: nth-child(1) { animation-delay: 0s; }
            #emoji-container span:nth-child(2) { animation-delay: 0.1s; }
            #emoji-container span:nth-child(3) { animation-delay: 0.2s; }
            #emoji-container span:nth-child(4) { animation-delay: 0.3s; }
            #emoji-container span:nth-child(5) { animation-delay: 0.4s; }
        `;
        document.head.appendChild(style);
    }

    timerInterval = startTimerUtil();
}

function showHint() {
    // No hints in emoji mode, button becomes abandon directly
    abandonGame();
}

function abandonGame() {
    revealTitle(cachedTitle, { mode: 'modal', autoAdvance: true, delay: 2000 })
        .then(() => {
            abandonGameUtil(currentProfile);
        });
}

function checkAnswer() {
    const input = document. getElementById('user-input').value;

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

    updateScoreboard(currentProfile);
}

function nextQuestion() {
    correctAnswerGiven = false;
    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = '';
    window.location.reload();
}

// Expose functions to global context
window.checkAnswer = checkAnswer;
window. showHint = showHint;
window.nextQuestion = nextQuestion;

// Setup Enter key handler
setupEnterKeyHandler(checkAnswer, nextQuestion, () => correctAnswerGiven);

// On load
window.onload = () => {
    // Change hint button to abandon button immediately
    const hintButton = document.getElementById('hint-button');
    if (hintButton) {
        hintButton.innerText = "Abandonner";
    }
    
    launchGameEmoji();
    updateScoreboard(currentProfile);
    document.getElementById('user-input').focus();
};
