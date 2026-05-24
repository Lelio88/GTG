/* ============================
PIXELATED MODE (HARDCORE)
============================ */
import { games } from './gamesDatabase.js';
import { handleGameCompletion } from './gameCompletion.js';
import { renderHintPixelated } from './hint-renderers.js';
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
    throw new Error('No profile selected');
}
currentProfile = initializeProfile(currentProfile);

// === Filter already found games ===
const availableGames = getAvailableGames(games, currentProfile, 'pixelated');

function launchGamePixelated() {
    // 1. Check logic
    if (availableGames.length === 0) {
        handleGameCompletion(currentProfile, 'pixelated');
        return;
    }

    cachedGame = availableGames[Math.floor(Math.random() * availableGames.length)];
    cachedTitle = cachedGame.title;

    initializeGameTitle(cachedTitle);

    const contentDiv = document.getElementById('content');

    // Conservé pour la révélation HD (utilisé par checkAnswer / abandonGame)
    gameImages = (cachedGame.pixels && cachedGame.pixels.length > 0) ? cachedGame.pixels : cachedGame.image;

    renderHintPixelated(cachedGame, 0, contentDiv);

    timerInterval = startTimerUtil();

    // Gestion du bouton (Toujours "Abandonner" dans ce mode)
    let hintButton = document.getElementById('hint-button');
    if (!hintButton) {
        // Au cas où le HTML ne l'a pas, on le crée
        hintButton = document.createElement('button');
        hintButton.id = 'hint-button';
        document.getElementById('button-container').prepend(hintButton);
    }
    
    hintButton.innerText = "Abandonner";
    hintButton.onclick = abandonGame;
}

function checkAnswer() {
    const input = document.getElementById('user-input').value;
    
    if (correctAnswerGiven) {
        return;
    }
    
    if (checkAnswerValue(input, cachedTitle)) {
        // RÉVÉLATION HD : on charge l'image originale (depuis Medias/Image/),
        // pas la pochette pré-pixellisée qui reste petite intrinsèquement.
        const imgElement = document.getElementById('game-pixels');
        if (imgElement && cachedGame.image && cachedGame.image.length > 0) {
            imgElement.src = cachedGame.image[0];
            imgElement.style.imageRendering = 'auto';
        }

        updateProfileUtil(currentProfile, cachedTitle, true, 'pixelated');
        showCorrectAnswerFeedback(cachedTitle, timerInterval);
        correctAnswerGiven = true;
    } else {
        updateProfileUtil(currentProfile, cachedTitle, false, 'pixelated');
        showIncorrectAnswerFeedback();
    }

    updateScoreboard(currentProfile, 'pixelated');
}

function nextQuestion() {
    nextQuestionUtil();
}

// Pas de fonction showHint complexe ici, car pas de navigation d'images

function abandonGame() {
    // RÉVÉLATION HD sur abandon : image originale (Medias/Image/) plutôt que
    // la pochette pré-pixellisée qui reste petite.
    const imgElement = document.getElementById('game-pixels');
    if (imgElement && cachedGame.image && cachedGame.image.length > 0) {
        imgElement.src = cachedGame.image[0];
        imgElement.style.imageRendering = 'auto';
    }

    revealTitle(cachedTitle, { mode: 'modal', autoAdvance: true, delay: 2000 })
        .then(() => {
            abandonGameUtil(currentProfile, 'pixelated');
        });
}

// Expose functions to global context
window.checkAnswer = checkAnswer;
window.nextQuestion = nextQuestion;
// window.showHint = showHint; // Pas nécessaire ici, géré directement par abandonGame

// Setup Enter key handler
setupEnterKeyHandler(checkAnswer, nextQuestion, () => correctAnswerGiven);

// On load
window.addEventListener('DOMContentLoaded', () => {
    launchGamePixelated();

    // Focus sur l'input
    const input = document.getElementById('user-input');
    if(input) input.focus();

    updateScoreboard(currentProfile, 'pixelated');
});