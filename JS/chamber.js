// Sélection de la zone
const secretZone = document.getElementById('secret-zone');
const backButton = document.getElementById('back-hub');

// Fonction à déclencher
function onSecretFound() {
    alert("Vous avez trouvé l'indice caché !");
    // Ici vous pouvez lancer un dialogue, donner une clé, etc.
}

// Écouteur d'événement
secretZone.addEventListener('click', onSecretFound);

// Retour au hub
backButton.addEventListener('click', () => {
    window.location.href = '../HTML/hub.html';
});