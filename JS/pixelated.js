/* ============================
PIXELATED MODE (HARDCORE)
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
    contentDiv.innerHTML = '';

    // 2. Select Image Source (Pixels folder or fallback)
    if (cachedGame.pixels && cachedGame.pixels.length > 0) {
        gameImages = cachedGame.pixels;
    } else {
        gameImages = cachedGame.image;
    }

    // ============================================================
    // CADRE FIXE
    // ============================================================
    const imageWrapper = document.createElement('div');
    imageWrapper.style.width = '100%';
    imageWrapper.style.height = '40vh'; // Grande taille verticale
    imageWrapper.style.display = 'flex';
    imageWrapper.style.justifyContent = 'center';
    imageWrapper.style.alignItems = 'center';
    imageWrapper.style.overflow = 'hidden';
    // Optionnel : fond noir pour faire ressortir l'image
    // imageWrapper.style.backgroundColor = '#000'; 

    // ============================================================
    // IMAGE & PIXELLISATION
    // ============================================================
    const img = document.createElement('img');
    img.id = 'game-pixels';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    img.style.imageRendering = 'pixelated';
    img.style.boxShadow = 'none';
    
    // Logique Canvas pour créer les gros pixels
    const tempImg = new Image();
    tempImg.src = gameImages[0];
    
    tempImg.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Facteur de réduction (0.06 = très pixellisé)
        const pixelFactor = 0.05; 

        const w = Math.floor(tempImg.width * pixelFactor);
        const h = Math.floor(tempImg.height * pixelFactor);
        
        canvas.width = w;
        canvas.height = h;

        // Dessin miniature
        ctx.drawImage(tempImg, 0, 0, w, h);

        // Injection dans l'image principale
        img.src = canvas.toDataURL();
        
        // Animation d'apparition
        img.style.opacity = '0';
        img.style.transition = 'opacity 0.5s ease';
        setTimeout(() => { img.style.opacity = '1'; }, 50);
    };

    imageWrapper.appendChild(img);
    contentDiv.appendChild(imageWrapper);

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
        // RÉVÉLATION HD
        const imgElement = document.getElementById('game-pixels');
        if(imgElement) {
            imgElement.src = gameImages[0]; // Image originale
            imgElement.style.imageRendering = 'auto'; // Lissage normal
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
    // RÉVÉLATION HD sur abandon
    const imgElement = document.getElementById('game-pixels');
    if(imgElement) {
        imgElement.src = gameImages[0];
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
window.onload = () => {
    if (window.location.pathname.includes('pixelated')) launchGamePixelated();
    
    // Focus sur l'input
    const input = document.getElementById('user-input');
    if(input) input.focus();
    
    updateScoreboard(currentProfile, 'pixelated');
};