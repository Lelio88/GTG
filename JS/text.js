import { games, abbreviations } from './gamesDatabase.js';
import { handleGameCompletion } from './gameCompletion.js';

let cachedGame = null;
let cachedTitle = '';
let currentHintIndex = 0;
let correctAnswerGiven = false;

const currentProfilePseudo = localStorage.getItem('currentProfile');
let profiles = JSON.parse(localStorage.getItem('profiles'));
let currentProfile = profiles.find(p => p.pseudo === currentProfilePseudo);

// Initialisation si besoin
if (!currentProfile.guessedGamesByMode) {
    currentProfile.guessedGamesByMode = { image: [], sound: [], text: [], full: [] };
}

// Filtrage
const availableGames = games.filter(game => !currentProfile.guessedGamesByMode.text.includes(game.title));

function updateProfile(gameTitle, isGoodAnswer) {
    if (isGoodAnswer && !currentProfile.guessedGamesByMode.text.includes(gameTitle)) {
        currentProfile.guessedGamesByMode.text.push(gameTitle);
    }

    if (isGoodAnswer) currentProfile.goodAnswers++;
    else currentProfile.badAnswers++;

    const profileIndex = profiles.findIndex(p => p.pseudo === currentProfilePseudo);
    profiles[profileIndex] = currentProfile;
    localStorage.setItem('profiles', JSON.stringify(profiles));
}

function launchGameText() {
    if (availableGames.length === 0) {
        handleGameCompletion(currentProfile, 'text');
        return;
    }

    cachedGame = availableGames[Math.floor(Math.random() * availableGames.length)];
    cachedTitle = cachedGame.title;

    const gameTitleElement = document.getElementById('game-title');
    gameTitleElement.innerText = cachedTitle;
    gameTitleElement.style.opacity = '0'; // caché au début

    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = ''; // reset
    currentHintIndex = 0;

    // Afficher le premier paragraphe
    const p = document.createElement('p');
    p.textContent = cachedGame.text[currentHintIndex];
    contentDiv.appendChild(p);
}

function showHint() {
    const contentDiv = document.getElementById('content');

    if (currentHintIndex < cachedGame.text.length - 1) {
        currentHintIndex++;
        const p = document.createElement('p');
        p.textContent = cachedGame.text[currentHintIndex];
        contentDiv.appendChild(p);

        // Dernier indice ? on change le bouton
        if (currentHintIndex === cachedGame.text.length - 1) {
            const hintButton = document.getElementById('hint-button');
            hintButton.innerText = "Abandonner";
            hintButton.onclick = abandonGame;
        }
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

    if (correctAnswerGiven) return;

    if (
        input === gameTitle ||
        (abbreviations[gameTitle] && abbreviations[gameTitle].includes(input))
    ) {
        updateProfile(cachedTitle, true);
        document.getElementById('message').innerText = 'Bonne réponse !';
        document.getElementById('message').style.color = 'orange';
        document.getElementById('next-button').style.display = 'block';
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

function nextQuestion() {
    window.location.reload();
}

// Timer
let timerInterval;
function startTimer() {
    let seconds = 0;
    timerInterval = setInterval(() => {
        seconds++;
        document.getElementById('timer').innerText = new Date(seconds * 1000).toISOString().substring(14, 19);
    }, 1000);
}

// Initialisation
window.onload = () => {
    launchGameText();
    startTimer();
    document.getElementById('good-answers').innerText = currentProfile.goodAnswers;
    document.getElementById('bad-answers').innerText = currentProfile.badAnswers;
    // Mettre le focus sur l'input pour permettre à l'utilisateur de commencer à taper
    document.getElementById('user-input').focus();
};

// Gestion des touches
document.getElementById('user-input').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        if (correctAnswerGiven) nextQuestion();
        else checkAnswer();
    }
});

// Fonctions globales pour les boutons HTML
window.checkAnswer = checkAnswer;
window.showHint = showHint;
window.nextQuestion = nextQuestion;
