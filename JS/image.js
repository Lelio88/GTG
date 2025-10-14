/* ============================
IMAGE ONLY MODE
============================ */
import { games, abbreviations } from '../JS/gamesDatabase.js';
import { handleGameCompletion } from '../JS/gameCompletion.js';

let timerInterval;
let cachedTitle = '';
let correctAnswerGiven
let currentHintIndex = 0;
let maxHintIndex = 0
let gameImages = [];
let cachedGame = null;
let isInputFocused = false;
let arrowsCreated = false; // Indicateur pour savoir si les flèches sont créées

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

// === Filtrage des jeux déjà trouvés ===
const availableGames = games.filter(game => !currentProfile.guessedGamesByMode.image.includes(game.title));

function updateProfile(gameTitle, isGoodAnswer) {
    if (isGoodAnswer && !currentProfile.guessedGamesByMode.image.includes(gameTitle)) {
        currentProfile.guessedGamesByMode.image.push(gameTitle);
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

function launchGameImage() {
    if (availableGames.length === 0) {
        handleGameCompletion(currentProfile, 'image');
        return;
    }

    cachedGame = availableGames[Math.floor(Math.random() * availableGames.length)];
    cachedTitle = cachedGame.title;

    const gameTitleElement = document.getElementById('game-title');
    gameTitleElement.innerText = cachedTitle;
    gameTitleElement.style.opacity = '0';

    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = '';

    gameImages = cachedGame.image;
    currentHintIndex = 0;
    maxHintIndex = 0;

    const img = document.createElement('img');
    img.src = gameImages[currentHintIndex];
    img.id = 'game-image';
    img.style.width = '100%';
    img.style.position = 'relative';
    img.style.transition = 'opacity 0.5s ease';
    contentDiv.appendChild(img);

    startTimer();

    let hintButton = document.getElementById('hint-button');
    if (!hintButton) {
        hintButton = document.createElement('button');
        hintButton.id = 'hint-button';
        hintButton.innerText = "Indice";
        hintButton.onclick = showHint;
        document.getElementById('content').appendChild(hintButton);
    } else {
        hintButton.innerText = "Indice";
        hintButton.onclick = showHint;
    }
}

function createNavigationArrows(imageElement) {
    if (arrowsCreated) return;

    const contentDiv = document.getElementById('content');

    const leftArrow = document.createElement('div');
    leftArrow.className = 'nav-arrow left';
    leftArrow.innerHTML = '&#9664;';
    leftArrow.onclick = () => navigateImage(-1);

    const rightArrow = document.createElement('div');
    rightArrow.className = 'nav-arrow right';
    rightArrow.innerHTML = '&#9654;';
    rightArrow.onclick = () => navigateImage(1);

    contentDiv.appendChild(leftArrow);
    contentDiv.appendChild(rightArrow);

    // Écouteur de touches pour les flèches du clavier
    document.addEventListener('keydown', (e) => {
        if (!isInputFocused) {
            if (e.key === 'ArrowLeft') navigateImage(-1);
            if (e.key === 'ArrowRight') navigateImage(1);
        }
    });

    // Gestion du focus de l'input
    const userInput = document.getElementById('user-input');
    userInput.addEventListener('focus', () => {
        isInputFocused = true;
    });

    userInput.addEventListener('blur', () => {
        isInputFocused = false;
    });

    arrowsCreated = true; // On indique que les flèches sont créées
}


function navigateImage(direction) {
    const imgElement = document.getElementById('game-image');

    if (direction === -1 && currentHintIndex > 0) {
        currentHintIndex--;
    } else if (direction === 1 && currentHintIndex < maxHintIndex) {
        currentHintIndex++;
    }

    // Effet de slider
    imgElement.style.opacity = '0';
    setTimeout(() => {
        imgElement.src = gameImages[currentHintIndex];
        imgElement.style.opacity = '1';
    }, 300);
}
function checkAnswer() {
    const input = document.getElementById('user-input').value.trim().toLowerCase();
    const gameTitle = cachedTitle.trim().toLowerCase();
    // Vérification si la réponse correcte a déjà été donnée
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

function startTimer() {
    let seconds = 0;
    timerInterval = setInterval(() => {
        seconds++;
        document.getElementById('timer').innerText = new Date(seconds * 1000).toISOString().substring(14, 19);
    }, 1000);
}
// Fonction pour passer à la prochaine question
function nextQuestion() {
    window.location.reload(); // Rafraîchit la page pour commencer un nouveau jeu
}

// Expose ces fonctions au contexte global
window.checkAnswer = checkAnswer;
window.showHint = showHint;
window.nextQuestion = nextQuestion;

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

function showHint() {
    if (maxHintIndex < gameImages.length - 1) {
        maxHintIndex++;
        currentHintIndex = maxHintIndex;

        const imgElement = document.getElementById('game-image');

        // Effet de slider
        imgElement.style.opacity = '0';
        setTimeout(() => {
            imgElement.src = gameImages[currentHintIndex];
            imgElement.style.opacity = '1';
        }, 300);

        // Si on atteint la dernière image, le bouton devient "Abandonner"
        if (maxHintIndex === gameImages.length - 1) {
            const hintButton = document.getElementById('hint-button');
            hintButton.innerText = "Abandonner";
            hintButton.onclick = abandonGame;
        }
    }
    if (maxHintIndex === 1 && !arrowsCreated) {
        createNavigationArrows(); // Les flèches sont ajoutées au DOM après le premier indice
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

// Au démarrage, on initialise tout
window.onload = () => {
    // Lancement du bon mode
    if (window.location.pathname.includes('image')) launchGameImage();

    // Mettre le focus sur l'input pour permettre à l'utilisateur de commencer à taper
    document.getElementById('user-input').focus();

    // === Initialisation de l'affichage des scores ===
    document.getElementById('good-answers').innerText = currentProfile.goodAnswers;
    document.getElementById('bad-answers').innerText = currentProfile.badAnswers;
};