# Contexte du Projet GTG (Guess The Game)

## 1. Vue d'ensemble
Ce projet est une application web constituée d'un "Hub" central menant à divers mini-jeux basés sur la culture vidéoludique et cinématographique.
Le but est généralement de deviner un jeu ou un film à partir d'indices visuels ou sonores.

## 2. Architecture Technique
- **Frontend :** HTML5, CSS3, JavaScript (Vanilla - sans framework).
- **Backend / Outils :** Scripts Python (`image.py`, `pixelated.py`, etc.) utilisés pour le traitement des assets (génération d'images pixellisées, ombres, etc.).
- **Données :** Les données des jeux semblent stockées dans `JS/gamesDatabase.js`.

## 3. Structure des Dossiers
- `HTML/` : Contient les pages de chaque mini-jeu (emoji, pixelated, shadow, sound, etc.) et le hub.
- `CSS/` : Feuilles de styles séparées par jeu ou thème (chamber.css, hub.css).
- `JS/` :
    - Logique spécifique par jeu (`pixelated.js`, `sound.js`).
    - Gestion globale (`index.js`, `hub.js`).
    - Base de données (`gamesDatabase.js`) et profils utilisateurs (`profiles.js`).
- `Assets/` : Images brutes et éléments d'interface.
- `Medias/` : Contenu du jeu (images de jeux vidéo triées par titre).
- `Python/` : Scripts utilitaires pour générer les médias de jeu.

## 4. Conventions de Code
- **JS :** Utilisation de modules ES6 ou scripts classiques. Préférence pour la clarté.
- **CSS :** Séparation par fonctionnalité/page.
- **Noms de fichiers :** Minuscules, anglais (ex: `pixelated.html`), correspondances directes entre HTML/JS/CSS (ex: `hub.html` <-> `hub.js` <-> `hub.css`).

## 5. Liste des Mini-Jeux identifiés
- **Image :** Deviner à partir d'une image.
- **Pixelated :** Deviner à partir d'une image pixelisée.
- **Shadow :** Deviner à partir d'une silhouette.
- **Sound / Midi :** Deviner à partir de l'audio.
- **Emoji :** Deviner à partir d'une suite d'emojis.
- **Calculator, Films, Pantone, Text, etc.**

## 6. État actuel
Le projet est en cours de développement local. Les assets sont gérés via le système de fichiers Windows.
