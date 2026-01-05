/* ============================
   EMOJI MODE
   ============================ */
import { games } from './gamesDatabase.js';
import { handleGameCompletion } from './gameCompletion. js';
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
    window.location. href = '../index.html';
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

function showHint() {
    // No hints in emoji mode, button becomes abandon directly
    abandonGame();
}

function abandonGame() {
    stopTimer(timerInterval);
    
    revealTitle(cachedTitle, { mode: 'modal', autoAdvance: true, delay: 2000 })
        .then(() => {
            // Update profile for abandoned game
            updateProfileUtil(currentProfile, cachedTitle, false, 'emoji');
            updateScoreboard(currentProfile);
            
            // Call the utility function to handle abandonment
            abandonGameUtil(currentProfile);
        });
}

function checkAnswer() {
    const input = document. getElementById('user-input').value;

    if (correctAnswerGiven) {
        return;
    }

    if (checkAnswerValue(input, cachedTitle)) {
        stopTimer(timerInterval);
        updateProfileUtil(currentProfile, cachedTitle, true, 'emoji');
        updateScoreboard(currentProfile);
        showCorrectAnswerFeedback(cachedTitle, timerInterval);
        correctAnswerGiven = true;
    } else {
        updateProfileUtil(currentProfile, cachedTitle, false, 'emoji');
        updateScoreboard(currentProfile);
        showIncorrectAnswerFeedback();
    }
}

function nextQuestion() {
    correctAnswerGiven = false;
    
    // Remove old content
    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = '';
    
    // Reload available games
    const newAvailableGames = getAvailableGames(games, currentProfile, 'emoji');
    
    if (newAvailableGames. length === 0) {
        handleGameCompletion(currentProfile, 'emoji');
        return;
    }
    
    // Launch new game
    launchGameEmoji();
    
    // Reset input and button states
    const userInput = document.getElementById('user-input');
    userInput.value = '';
    userInput.disabled = false;
    userInput.focus();
    
    const nextButton = document.getElementById('next-button');
    nextButton.style.display = 'none';
    
    const hintButton = document.getElementById('hint-button');
    hintButton.style.display = 'inline-block';
    hintButton.innerText = 'Abandonner';
    
    const message = document.getElementById('message');
    message.innerText = '';
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
    const hintButton = document. getElementById('hint-button');
    if (hintButton) {
        hintButton.innerText = "Abandonner";
    }
    
    launchGameEmoji();
    updateScoreboard(currentProfile);
    document.getElementById('user-input').focus();
};
