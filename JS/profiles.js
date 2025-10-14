const profilesContainer = document.getElementById('profiles');
const maxProfiles = 4;
let profiles = JSON.parse(localStorage.getItem('profiles')) || [];
let currentProfile = localStorage.getItem('currentProfile');

// === Afficher les profils existants ===
function displayProfiles() {
    profilesContainer.innerHTML = '';
    profiles.forEach((profile, index) => {
        const profileDiv = document.createElement('div');
        profileDiv.classList.add('profile');
        profileDiv.innerText = profile.pseudo;
        profileDiv.setAttribute('data-id', profile.id); // Utilisation d'un ID unique
        profileDiv.onclick = () => selectProfile(profile.pseudo);
        profilesContainer.appendChild(profileDiv);
    });

    // Remplir les cases vides
    for (let i = profiles.length; i < maxProfiles; i++) {
        const emptyDiv = document.createElement('div');
        emptyDiv.classList.add('profile', 'empty');
        emptyDiv.innerText = 'Vide';
        emptyDiv.onclick = addNewProfile;
        profilesContainer.appendChild(emptyDiv);
    }
}

// === Ajouter un nouveau profil ===
function addNewProfile() {
    if (profiles.length >= maxProfiles) {
        alert("Le nombre maximum de profils est atteint !");
        return;
    }
    const pseudo = prompt("Entrez votre pseudo :");
    if (pseudo) {
        const newProfile = {
            id: Date.now(), // Utilisation d'un identifiant unique basé sur le temps
            pseudo,
            goodAnswers: 0,
            badAnswers: 0,
        };
        profiles.push(newProfile);
        localStorage.setItem('profiles', JSON.stringify(profiles));
        displayProfiles();
    }
}

// === Sélectionner un profil ===
function selectProfile(pseudo) {
    localStorage.setItem('currentProfile', pseudo);
    currentProfile = pseudo;
    alert(`Profil "${pseudo}" sélectionné !`);
}

// === Lancer le jeu avec le mode choisi ===
function launchGame() {
    if (!currentProfile) {
        alert("Veuillez sélectionner un profil !");
        return;
    }

    const gameMode = document.querySelector('input[name="gameMode"]:checked');
    if (!gameMode) {
        alert("Veuillez sélectionner un mode de jeu !");
        return;
    }

    switch (gameMode.value) {
        case 'full':
            window.location.href = '/HTML/full.html';
            break;
        case 'sound':
            window.location.href = '/HTML/sound.html';
            break;
        case 'image':
            window.location.href = '/HTML/image.html';
            break;
        case 'text':
            window.location.href = '/HTML/text.html';
            break;
    }
}

// === Récupérer le profil courant ===
function getCurrentProfile() {
    const profiles = JSON.parse(localStorage.getItem('profiles')) || [];
    return profiles.find(p => p.pseudo === currentProfile);
}

// === Mettre à jour le profil courant ===
function updateCurrentProfile(updatedProfile) {
    profiles = profiles.map(p => p.pseudo === currentProfile ? updatedProfile : p);
    localStorage.setItem('profiles', JSON.stringify(profiles));
}

// === Affichage initial ===
displayProfiles();
