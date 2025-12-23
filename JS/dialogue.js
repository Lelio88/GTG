// === dialogue.js ===
// Fonction pour récupérer le tableau de profils depuis le localStorage
function getProfiles() {
    const profilesData = localStorage.getItem('profiles');
    return profilesData ? JSON.parse(profilesData) : [];
}

// Fonction pour initialiser ou incrémenter le compteur de visites
function initializeVisitCounter() {
    const profiles = getProfiles();
    const currentProfilePseudo = localStorage.getItem('currentProfile'); // On récupère le pseudo du profil actif
    const currentProfile = profiles.find(p => p.pseudo === currentProfilePseudo);
    if (!currentProfilePseudo) {
        console.error("Aucun pseudo sélectionné.");
        return;
    }
    if (!currentProfile) {
        console.error("Le profil n'a pas été trouvé.");
        return;
    }

    // Mise à jour du compteur de visites
    if (!currentProfile.visitCount) {
        currentProfile.visitCount = 1;
    } else {
        currentProfile.visitCount++;
    }

    // Sauvegarde dans le localStorage
    localStorage.setItem('profiles', JSON.stringify(profiles));
    return currentProfile.visitCount;
}


// Dialogue en fonction du compteur de visites et des clés
const dialogues = {
    1: {
        text: "Ooh.. tu es nouveau ici ! Dis-moi, tu peux m'aider ? J'ai des gros problèmes de mémoire... je suis un peu perdu et j'aimerais retrouver mes souvenirs. Si tu veux bien m'aider, dans un premier temps tu pourrais m'aider à retrouver le nom de mes jeux préférés ! Ça te dirait ? Si oui, clique sur un mode de jeu et on commence !",
        image: "../Assets/perso 1.jpg"
    },
    5: {
        text: "On dirait que tu commences à maîtriser ! Moi aussi je travaille sur ma mémoire ! Je commence à me rappeler grâce à toi. Continues et je te serais très reconnaissant !",
        image: "../Assets/perso 2.jpg"
    },
    10: {
        text: "Wow, tu es persévérant ! Ma mémoire revient à toute vitesse et c'est grâce à toi ! Ne t'arrêtes pas tu es sur la bonne voie !",
        image: "../Assets/perso 3.jpg"
    }
};

const keyDialogues = {
    1: {
        text: "Oh tu as déjà terminé un mode entier ! Félicitations ! Tu m'aides à recouvrer la mémoire. Grâce à toi j'ai retrouvé la clefs de ma chambre, tu peux y aller si tu veux. Peut-être trouveras-tu de nouvelles choses à faire !",
        image: "../Assets/characters/key_1.png"
    },
    2: {
        text: "Deux clés déjà ? Impressionnant ! Continue comme ça ! Tu es sur la bonne voie pour m'aider à retrouver tous mes souvenirs. Ouvres donc un tiroir de mon bureau,tu trouveras sûrement quelque chose pour continuer !",
        image: "../Assets/characters/key_2.png"
    }
};

// Fonction pour récupérer le bon dialogue et l'image correspondante
function getDialogue() {
    const profile = getProfiles();
    if (!profile) return null;

    const visitCount = initializeVisitCounter();

    // Gestion des dialogues spécifiques selon les clés obtenues
    if (profile.Keys && keyDialogues && keyDialogues[profile.Keys]) {
        return keyDialogues[profile.Keys];
    }

    // Retour du dialogue selon le compteur de visite
    return dialogues[visitCount] || null;
}

// Fonction pour afficher le personnage avec l'animation
function showCharacter() {
    const dialogueData = getDialogue();
    if (!dialogueData) return;

    const characterDiv = document.createElement('div');
    characterDiv.classList.add('character-container');

    const characterImage = document.createElement('img');
    characterImage.src = dialogueData.image;
    characterImage.classList.add('character-image');

    const textBubble = document.createElement('div');
    textBubble.classList.add('character-text');
    textBubble.innerText = dialogueData.text;

    characterDiv.appendChild(characterImage);
    characterDiv.appendChild(textBubble);
    document.body.appendChild(characterDiv);

    // Animation d'entrée
    setTimeout(() => {
        characterDiv.style.transform = 'translateX(0)';
        characterDiv.style.opacity = '1';
    }, 100);
}
export { showCharacter };
