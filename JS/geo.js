/* ============================
GEO MODE — Panorama 360° explorable (spawn aléatoire, devine le jeu)

Mode "one-shot" calqué sur shadow.js : une seule vue (le panorama) par jeu,
bouton "Abandonner" direct (pas d'indices progressifs). Le rendu 360 est
délégué à renderHintGeo (Photo Sphere Viewer). Le viewer WebGL est détruit
via cleanupGeo() entre deux manches et à la fermeture de page (anti-fuite GPU).

IDs DOM attendus (HTML/geo.html) : #content, #game-title, #message,
#user-input, #hint-button, #check-button, #next-button, #good-answers,
#bad-answers, #timer.
============================ */
import { games } from './gamesDatabase.js';
import { handleGameCompletion } from './gameCompletion.js';
import { renderHintGeo, cleanupGeo } from './hint-renderers.js';
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

// === Profil courant ===
let currentProfile = getCurrentProfile();
if (!currentProfile) {
    window.location.href = '../index.html';
    throw new Error('No profile selected');
}
currentProfile = initializeProfile(currentProfile);

// Seuls les jeux disposant d'un panorama 360 sont jouables en mode geo.
function geoGames() {
    return getAvailableGames(games, currentProfile, 'geo')
        .filter(g => Array.isArray(g.geo) && g.geo.length > 0);
}

// === Jeux non encore trouvés dans ce mode (et pourvus d'un panorama) ===
let availableGames = geoGames();

async function launchGameGeo() {
    if (availableGames.length === 0) {
        handleGameCompletion(currentProfile, 'geo');
        return;
    }

    // Anti-triche F5 : reprend le jeu en cours si possible (l'angle de spawn,
    // lui, sera re-tiré au hasard par renderHintGeo).
    cachedGame = getInProgressGame('geo', availableGames)
        || availableGames[Math.floor(Math.random() * availableGames.length)];
    cachedTitle = cachedGame.title;
    setInProgressGame('geo', cachedTitle);
    initializeGameTitle(cachedTitle);

    const contentDiv = document.getElementById('content');
    // Rendu 360 asynchrone (import PSV + création du viewer).
    await renderHintGeo(cachedGame, 0, contentDiv);

    // Timer démarré une fois le viewer prêt (le temps de chargement de la lib
    // au 1er passage n'est donc pas compté).
    timerInterval = startTimerUtil();

    // Bouton "Abandonner" (pas d'indice en mode geo).
    let hintButton = document.getElementById('hint-button');
    if (!hintButton) {
        hintButton = document.createElement('button');
        hintButton.id = 'hint-button';
        document.getElementById('content').appendChild(hintButton);
    }
    hintButton.innerText = 'Abandonner';
    hintButton.onclick = abandonGame;
}

function checkAnswer() {
    const input = document.getElementById('user-input').value;
    if (correctAnswerGiven) return;

    if (checkAnswerValue(input, cachedTitle)) {
        updateProfileUtil(currentProfile, cachedTitle, true, 'geo');
        correctAnswerGiven = true;
        // Le panorama reste explorable derrière la modale (dismissible).
        showCorrectAnswerFeedback(cachedTitle, timerInterval);
    } else {
        updateProfileUtil(currentProfile, cachedTitle, false, 'geo');
        showIncorrectAnswerFeedback();
    }

    updateScoreboard(currentProfile, 'geo');
}

async function nextQuestion() {
    clearInProgressGame('geo');
    // Détruit le viewer 360 courant AVANT de recréer (libère le WebGL).
    cleanupGeo();

    // Reset état JS
    cachedGame = null;
    cachedTitle = '';
    correctAnswerGiven = false;
    stopTimer(timerInterval);

    // Reset UI
    resetGameUI();

    // Recharge la liste des jeux disponibles (pourvus d'un panorama)
    availableGames = geoGames();

    // Relance le mode
    await launchGameGeo();
    document.getElementById('user-input').focus();
}

function abandonGame() {
    if (correctAnswerGiven) return; // déjà résolu
    correctAnswerGiven = true;
    stopTimer(timerInterval);

    // Pénalité d'abandon appliquée tout de suite, sans avancer, + "Prochaine question".
    abandonGameUtil(currentProfile, 'geo', () => {});
    const nextBtn = document.getElementById('next-button');
    if (nextBtn) nextBtn.style.display = 'block';

    // Révèle le titre ; clic à côté = fermer sans avancer (le panorama reste explorable).
    revealTitle(cachedTitle, {
        mode: 'modal',
        autoAdvance: false,
        dismissible: true,
        onConfirm: () => { if (typeof window.nextQuestion === 'function') window.nextQuestion(); },
    });
}

// Expose nextQuestion en global (consommée par gameUtils.js / revealTitle).
window.nextQuestion = nextQuestion;

// Setup Enter key handler
setupEnterKeyHandler(checkAnswer, nextQuestion, () => correctAnswerGiven);

// Libère le viewer WebGL si on quitte la page.
window.addEventListener('beforeunload', cleanupGeo);

window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('check-button').addEventListener('click', checkAnswer);
    document.getElementById('next-button').addEventListener('click', nextQuestion);
    launchGameGeo();
    document.getElementById('user-input').focus();
    updateScoreboard(currentProfile, 'geo');
});
