/* ============================
SHADOW MODE (HARDCORE)
============================ */
import { games } from './gamesDatabase.js';
import { handleGameCompletion } from './gameCompletion.js';
import { renderHintShadow } from './hint-renderers.js';
import { getInProgressGame, setInProgressGame, clearInProgressGame } from './state/gameProgress.js';
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
    resetGameUI,
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

// Delai avant la modale : laisse la transition filter (0.5s de renderHintShadow)
// se jouer -> la silhouette retrouve ses couleurs AVANT que la modale s'affiche.
const SHADOW_REVEAL_MS = 600;

// === Get current profile ===
let currentProfile = getCurrentProfile();
if (!currentProfile) {
    window.location.href = '../index.html';
    throw new Error('No profile selected');
}
currentProfile = initializeProfile(currentProfile);

// === Filter already found games (Mode SHADOW) ===
let availableGames = getAvailableGames(games, currentProfile, 'shadow');

function launchGameShadow() {
    // 1. Vérifier s'il reste des jeux
    if (availableGames.length === 0) {
        handleGameCompletion(currentProfile, 'shadow');
        return;
    }

    // 2. Sélectionner un jeu (anti-triche F5 : reprend le jeu en cours si possible)
    cachedGame = getInProgressGame('shadow', availableGames)
        || availableGames[Math.floor(Math.random() * availableGames.length)];
    cachedTitle = cachedGame.title;
    setInProgressGame('shadow', cachedTitle);
    initializeGameTitle(cachedTitle);

    const contentDiv = document.getElementById('content');

    // Conservé pour compatibilité avec l'ancienne logique de révélation (non utilisé)
    gameImages = (cachedGame.shadow && cachedGame.shadow.length > 0) ? cachedGame.shadow : cachedGame.image;

    renderHintShadow(cachedGame, 0, contentDiv);

    // 4. Timer
    timerInterval = startTimerUtil();

    // 5. Bouton Abandonner (Directement, pas de logique d'indice)
    let hintButton = document.getElementById('hint-button');
    if (!hintButton) {
        hintButton = document.createElement('button');
        hintButton.id = 'hint-button';
        document.getElementById('content').appendChild(hintButton);
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
        // Révélation de l'image (couleur) : transition filter 0.5s.
        const imgElement = document.getElementById('game-image');
        if (imgElement) imgElement.style.filter = 'none';

        updateProfileUtil(currentProfile, cachedTitle, true, 'shadow');
        correctAnswerGiven = true;
        stopTimer(timerInterval);
        // Laisse la silhouette retrouver ses couleurs AVANT d'afficher la modale.
        setTimeout(() => showCorrectAnswerFeedback(cachedTitle, timerInterval), SHADOW_REVEAL_MS);
    } else {
        updateProfileUtil(currentProfile, cachedTitle, false, 'shadow');
        showIncorrectAnswerFeedback();
    }

    updateScoreboard(currentProfile, 'shadow');
}

function nextQuestion() {
    clearInProgressGame('shadow');

    // Reset etat JS
    cachedGame = null;
    cachedTitle = '';
    correctAnswerGiven = false;
    gameImages = [];
    stopTimer(timerInterval);

    // Reset UI
    resetGameUI();

    // Recharge la liste des jeux disponibles
    availableGames = getAvailableGames(games, currentProfile, 'shadow');

    // Relance le mode (re-configure aussi le bouton Indice -> Abandonner)
    launchGameShadow();
    document.getElementById('user-input').focus();
}

function abandonGame() {
    if (correctAnswerGiven) return; // deja resolu (reponse trouvee ou abandon en cours)
    correctAnswerGiven = true;
    stopTimer(timerInterval);

    // Révélation de l'image (couleur) : transition filter 0.5s.
    const imgElement = document.getElementById('game-image');
    if (imgElement) imgElement.style.filter = 'none';

    // Applique la penalite d'abandon TOUT DE SUITE, sans avancer (nextFn no-op),
    // et affiche "Prochaine question" pour continuer quand on veut.
    abandonGameUtil(currentProfile, 'shadow', () => {});
    const nextBtn = document.getElementById('next-button');
    if (nextBtn) nextBtn.style.display = 'block';

    // Laisse les couleurs revenir AVANT la modale. dismissible : clic a cote =
    // fermer sans avancer (le bouton "Prochaine question" reste dispo).
    setTimeout(() => {
        revealTitle(cachedTitle, {
            mode: 'modal',
            autoAdvance: false,
            dismissible: true,
            onConfirm: () => { if (typeof window.nextQuestion === 'function') window.nextQuestion(); },
        });
    }, SHADOW_REVEAL_MS);
}

// Expose nextQuestion en global -- consommee par gameUtils.js
// (showHint pas utilise en shadow : le bouton declenche abandon direct)
window.nextQuestion = nextQuestion;

// Setup Enter key handler
setupEnterKeyHandler(checkAnswer, nextQuestion, () => correctAnswerGiven);

window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('check-button').addEventListener('click', checkAnswer);
    document.getElementById('next-button').addEventListener('click', nextQuestion);
    // hint-button est reconfigure en 'Abandonner' par launchGameShadow (pas d'indice)
    launchGameShadow();
    document.getElementById('user-input').focus();
    updateScoreboard(currentProfile, 'shadow');
});