/* ============================
SOUND ONLY MODE
============================ */
import { games, abbreviations } from '../JS/gamesDatabase.js';
import { handleGameCompletion } from '../JS/gameCompletion.js';

let timerInterval;
let cachedTitle = '';
let currentHintIndex = 0;
let correctAnswerGiven = false;
let cachedGame = null;
let arrowsCreated = false;
let isInputFocused = false;
let maxHintIndex = 1; // ✅ On démarre à 1 car on a le premier son

// === Récupération du profil courant ===
const currentProfilePseudo = localStorage.getItem('currentProfile');
let profiles = JSON.parse(localStorage.getItem('profiles'));
let currentProfile = profiles.find(p => p.pseudo === currentProfilePseudo);

// Initialisation des jeux devinés par mode de jeu
if (!currentProfile.guessedGamesByMode) {
    currentProfile.guessedGamesByMode = {
        image: [],
        sound: [],
        text: [],
        full: []
    };
}

// Sélection des jeux non trouvés dans le mode "sound"
const availableGames = games.filter(game => !currentProfile.guessedGamesByMode.sound.includes(game.title));
function launchGameMusic() {
    if (availableGames.length === 0) {
        handleGameCompletion(currentProfile, 'sound');
        return;
    }

    cachedGame = availableGames[Math.floor(Math.random() * availableGames.length)];
    cachedTitle = cachedGame.title;

    const gameTitleElement = document.getElementById('game-title');
    gameTitleElement.innerText = cachedTitle;
    gameTitleElement.style.opacity = '0';

    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = '';

    currentHintIndex = 1;

    const audio = document.createElement('audio');
    audio.src = cachedGame.sound[0]; // ✅ Premier son par défaut
    audio.id = 'game-audio';
    audio.autoplay = false;
    audio.loop = false;
    audio.controls = true;
    audio.style.width = '100%';
    audio.style.position = 'relative';
    audio.style.transition = 'opacity 0.5s ease';
    contentDiv.appendChild(audio);

    updateArrowsVisibility(); // ✅ Mise à jour de la visibilité des flèches
    startTimer();
}

function updateProfile(gameTitle, isGoodAnswer) {
    if (isGoodAnswer && !currentProfile.guessedGamesByMode.sound.includes(gameTitle)) {
        currentProfile.guessedGamesByMode.sound.push(gameTitle);
    }

    if (isGoodAnswer) {
        currentProfile.goodAnswers++;
    } else {
        currentProfile.badAnswers++;
    }

    const profileIndex = profiles.findIndex(p => p.pseudo === currentProfilePseudo);
    profiles[profileIndex] = currentProfile;

    localStorage.setItem('profiles', JSON.stringify(profiles));
}

function createNavigationArrows() {
    if (arrowsCreated) return;

    const contentDiv = document.getElementById('content');

    const leftArrow = document.createElement('div');
    leftArrow.className = 'nav-arrow left';
    leftArrow.innerHTML = '&#9664;';
    leftArrow.onclick = () => navigateAudio(-1);

    const rightArrow = document.createElement('div');
    rightArrow.className = 'nav-arrow right';
    rightArrow.innerHTML = '&#9654;';
    rightArrow.onclick = () => navigateAudio(1);

    contentDiv.appendChild(leftArrow);
    contentDiv.appendChild(rightArrow);

    arrowsCreated = true;
}

function updateArrowsVisibility() {
    const leftArrow = document.querySelector('.nav-arrow.left');
    const rightArrow = document.querySelector('.nav-arrow.right');

    if (leftArrow && rightArrow) {
        // ✅ Gérer la visibilité selon l'index actuel
        leftArrow.style.display = currentHintIndex > 1 ? 'block' : 'none';
        rightArrow.style.display = currentHintIndex < maxHintIndex ? 'block' : 'none';
    }
}

function navigateAudio(direction) {
    const newIndex = currentHintIndex + direction;

    // ✅ On navigue seulement entre 1 et le nombre max d'indices débloqués
    if (newIndex >= 1 && newIndex <= maxHintIndex) {
        currentHintIndex = newIndex;
        const audio = document.querySelector('audio');
        audio.src = cachedGame.sound[currentHintIndex - 1];
        audio.play();
        updateArrowsVisibility(); // ✅ Mise à jour des flèches
    }
}

function startTimer() {
    let seconds = 0;
    timerInterval = setInterval(() => {
        seconds++;
        document.getElementById('timer').innerText = new Date(seconds * 1000).toISOString().substring(14, 19);
    }, 1000);
}

function showHint() {
    const hintButton = document.getElementById('hint-button');

    if (maxHintIndex < cachedGame.sound.length) {
        maxHintIndex++;
        currentHintIndex = maxHintIndex;

        const audio = document.querySelector('audio');
        audio.src = cachedGame.sound[currentHintIndex - 1];
        audio.play();

        if (maxHintIndex > 1) {
            createNavigationArrows();
        }
        updateArrowsVisibility(); // ✅ On met à jour les flèches après l'index
    }

    if (maxHintIndex === cachedGame.sound.length) {
        hintButton.innerText = "Abandonner";
        hintButton.onclick = abandonGame;
    }
}

function abandonGame() {
    currentProfile.badAnswers += 10;
    const profileIndex = profiles.findIndex(p => p.pseudo === currentProfilePseudo);
    profiles[profileIndex] = currentProfile;
    localStorage.setItem('profiles', JSON.stringify(profiles));
    document.getElementById('bad-answers').innerText = currentProfile.badAnswers;
    window.location.reload();
}

function checkAnswer() {
    const input = document.getElementById('user-input').value.trim().toLowerCase();
    const gameTitle = cachedTitle.trim().toLowerCase();

    if (correctAnswerGiven) {
        return; // Si c'est déjà validé, on ne fait rien
    }

    if (
        input === gameTitle ||
        (abbreviations[gameTitle] && abbreviations[gameTitle].includes(input))
    ) {
        updateProfile(cachedTitle, true);
        document.getElementById('message').innerText = 'Bonne réponse !';
        document.getElementById('message').style.color = 'orange';
        document.getElementById('next-button').style.display = 'block';
        clearInterval(timerInterval);
        document.getElementById('game-title').style.opacity = '1';
        correctAnswerGiven = true;
    } else {
        updateProfile(cachedTitle, false);
        document.getElementById('message').innerText = 'Mauvaise réponse !';
        document.getElementById('message').style.color = 'violet';
    }

    document.getElementById('good-answers').innerText = currentProfile.goodAnswers;
    document.getElementById('bad-answers').innerText = currentProfile.badAnswers;
}

// Fonction pour passer à la prochaine question
function nextQuestion() {
    window.location.reload(); // Rafraîchit la page pour commencer un nouveau jeu
}

document.getElementById('user-input').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        if (correctAnswerGiven) {
            nextQuestion();
        } else {
            checkAnswer();
        }
    }
});

// Expose ces fonctions au contexte global
window.checkAnswer = checkAnswer;
window.showHint = showHint;
window.nextQuestion = nextQuestion;

window.onload = () => {
    launchGameMusic();
    document.getElementById('good-answers').innerText = currentProfile.goodAnswers;
    document.getElementById('bad-answers').innerText = currentProfile.badAnswers;
    // Mettre le focus sur l'input pour permettre à l'utilisateur de commencer à taper
    document.getElementById('user-input').focus();
};
