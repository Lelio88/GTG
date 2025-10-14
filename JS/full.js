import { games, abbreviations } from '../JS/gamesDatabase.js';
import { handleGameCompletion } from '../JS/gameCompletion.js';

let timerInterval;
let cachedTitle = '';
let correctAnswerGiven
let currentHintIndex = 0;
let maxHintIndex = 0
let gameImages = [];
let cachedGame = null;
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
const availableGames = games.filter(game => !currentProfile.guessedGamesByMode.full.includes(game.title));
function updateProfile(gameTitle, isGoodAnswer) {
    if (isGoodAnswer && !currentProfile.guessedGamesByMode.full.includes(gameTitle)) {
        currentProfile.guessedGamesByMode.full.push(gameTitle);
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

function launchGameFull() {
    if (availableGames.length === 0) {
        handleGameCompletion(currentProfile, 'full');
        return;
    }

    cachedGame = availableGames[Math.floor(Math.random() * availableGames.length)];
    cachedTitle = cachedGame.title;

    const gameTitleElement = document.getElementById('game-title');
    gameTitleElement.innerText = cachedTitle;
    gameTitleElement.style.opacity = '0';

    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = '';

    currentHintIndex = 0;

    // Calcule la longueur max des indices
    maxHintIndex = Math.max(
        cachedGame.image.length,
        cachedGame.sound.length,
        cachedGame.text.length
    ) - 1;

    // Affiche le premier "triplet" d’indices
    displayHint(currentHintIndex);

    startTimer();
}

function displayHint(index) {
    const contentDiv = document.getElementById('content');

    contentDiv.innerHTML = '';

    // Conteneur principal (colonne)
    const hintContainer = document.createElement('div');
    hintContainer.className = 'hint-container';
    hintContainer.style.display = 'flex';
    hintContainer.style.flexDirection = 'column';
    hintContainer.style.alignItems = 'center'; // centre horizontalement
    hintContainer.style.marginBottom = '30px';

    // Conteneur ligne pour image + texte
    const topRow = document.createElement('div');
    topRow.style.display = 'flex';
    topRow.style.flexDirection = 'row';
    topRow.style.alignItems = 'center';
    topRow.style.gap = '20px';

    // Image
    const img = document.createElement('img');
    img.src = cachedGame.image[index];
    img.alt = 'Indice image';
    img.style.width = '600px';
    img.style.height = 'auto';

    // Texte à droite de l'image
    const text = document.createElement('p');
    text.innerText = cachedGame.text[index];
    text.style.margin = '0';
    text.style.width = '400px';  // limite largeur pour texte
    text.style.lineHeight = '1.4';
    text.style.fontSize = '1rem';

    // Ajout image + texte dans la ligne
    topRow.appendChild(img);
    topRow.appendChild(text);

    // Audio sous la ligne image + texte, centré
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.style.marginTop = '30px';
    audio.style.width = '300px';

    const source = document.createElement('source');
    source.src = cachedGame.sound[index];
    source.type = 'audio/mpeg';
    audio.appendChild(source);

    // Ajout au conteneur principal
    hintContainer.appendChild(topRow);
    hintContainer.appendChild(audio);

    // Ajout dans #content
    contentDiv.appendChild(hintContainer);
}



function showHint() {
    if (currentHintIndex < cachedGame.image.length - 1) {
        currentHintIndex++;
        displayHint(currentHintIndex);
    }
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
    launchGameFull();

    // Mettre le focus sur l'input pour permettre à l'utilisateur de commencer à taper
    document.getElementById('user-input').focus();

    // === Initialisation de l'affichage des scores ===
    document.getElementById('good-answers').innerText = currentProfile.goodAnswers;
    document.getElementById('bad-answers').innerText = currentProfile.badAnswers;
};