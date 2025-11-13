# Guess The Game 🎮

## Description

Jeu interactif de devinettes vidéoludiques proposant 4 modes de jeu distincts avec système de progression, gestion de profils multiples et mécaniques de déblocage. Le joueur doit deviner des jeux vidéo à partir d'indices visuels, sonores ou textuels, avec un système de clés récompensant la complétion des modes.

## ✨ Fonctionnalités principales

### Système de profils
- **Gestion multi-profils** : Jusqu'à 4 profils sauvegardés simultanément
- **Statistiques personnalisées** : Suivi des bonnes/mauvaises réponses par profil
- **Système de progression** : Clés débloquées après complétion des modes
- **Sauvegarde automatique** : Toutes les données stockées en localStorage

### 4 modes de jeu uniques
- **Full Package** : Combinaison d'images, sons et textes descriptifs
- **Image Only** : Devinettes basées uniquement sur des captures d'écran
- **Sound Only** : Reconnaissance par bandes-son et musiques de jeux
- **Text Only** : Devinettes à partir de descriptions textuelles

### Mécaniques de jeu
- **Système d'indices progressifs** : Jusqu'à 3 indices par jeu
- **Navigation intuitive** : Flèches clavier et boutons pour parcourir les indices
- **Timer intégré** : Chronomètre pour chaque partie
- **Validation intelligente** : Reconnaissance des abréviations (LOL, GTA, CS, etc.)
- **Base de données étendue** : Plus de 100 jeux vidéo référencés

### Interface et UX
- **Design néon futuriste** : Thème sombre avec effets de glow personnalisés
- **Navigation au clavier** : Support complet des flèches et touches Enter/Space
- **Système de dialogue** : Personnage guide apparaissant selon la progression
- **Responsive** : Interface adaptative pour différentes résolutions

## 🎯 Technologies utilisées

- **Frontend** : HTML5, CSS3 (animations, gradients, néon effects)
- **JavaScript** : ES6+ avec modules
- **Persistance** : LocalStorage pour sauvegardes
- **Médias** : Audio HTML5, Images optimisées
- **Architecture** : Système modulaire avec imports/exports

## 📁 Structure du projet

```
GTG/
├── index.html                      # Page de sélection des profils
├── CSS/
│   ├── index-style.css            # Styles page d'accueil
│   ├── style.css                  # Styles globaux des modes de jeu
│   ├── hub.css                    # Styles du hub de sélection
│   ├── menu.css                   # Styles du menu navigation
│   └── recettes.css               # Styles additionnels
├── HTML/
│   ├── full.html                  # Mode Full Package
│   ├── image.html                 # Mode Image Only
│   ├── sound.html                 # Mode Sound Only
│   ├── text.html                  # Mode Text Only
│   └── hub.html                   # Hub de sélection des modes
├── JS/
│   ├── index.js                   # Gestion des profils
│   ├── hub.js                     # Logique du hub
│   ├── full.js                    # Logique mode Full
│   ├── image.js                   # Logique mode Image
│   ├── sound.js                   # Logique mode Sound
│   ├── text.js                    # Logique mode Text
│   ├── gamesDatabase.js           # Base de données des jeux (100+ jeux)
│   ├── gameCompletion.js          # Gestion complétion et clés
│   ├── dialogue.js                # Système de dialogues
│   └── profiles.js                # Utils gestion profils
├── Assets/                         # Images UI (non incluses)
└── Medias/                         # Assets multimédias (non incluses)
    ├── Image/                      # Captures d'écran des jeux
    └── Sound/                      # Bandes-son et musiques
```

## 🚀 Installation

1. Cloner le repository :
```bash
git clone https://github.com/Lelio88/GTG.git
cd guess-the-game
```

2. Ajouter les assets multimédias :
   - Placer les images dans `Medias/Image/`
   - Placer les sons dans `Medias/Sound/`
   - Respecter la nomenclature : `NomDuJeu 1.jpg`, `NomDuJeu 2.mp3`, etc.

3. Ouvrir `index.html` dans un navigateur moderne

**Note** : Pas de serveur requis, fonctionne en local via protocole `file://`

## 🎮 Guide d'utilisation

### Création d'un profil
1. Lancer `index.html`
2. Cliquer sur une case "Vide"
3. Entrer un pseudo (20 caractères max)
4. Sélectionner le profil créé et cliquer sur "Charger"

### Jouer à un mode
1. Dans le hub, sélectionner un mode avec les flèches ← → ou la souris
2. Appuyer sur **Entrée** ou cliquer sur "Lancer le jeu"
3. Utiliser les indices (bouton "Indice") si nécessaire
4. Taper la réponse et valider avec **Entrée**
5. Compléter tous les jeux du mode pour débloquer une clé 🔑

### Navigation
- **Flèches gauche/droite** : Navigation entre profils/modes
- **Espace** : Sélectionner un élément
- **Entrée** : Valider/Passer à la question suivante
- **Flèches** : Naviguer entre indices (modes Image/Sound)

## 🏆 Système de progression

### Clés et déblocages
- **1 clé** = Complétion d'un mode de jeu
- **4 clés maximum** (une par mode)
- Les clés persistent par profil
- Nouveau contenu débloqué avec les clés (chambre secrète)

### Dialogues évolutifs
Le personnage guide apparaît selon :
- Nombre de visites sur le hub
- Nombre de clés obtenues
- Progression globale du joueur

## 🎨 Personnalisation

### Ajouter un jeu
Éditer `JS/gamesDatabase.js` :

```javascript
{
    title: 'Nom du Jeu',
    image: [
        '../Medias/Image/NomDuJeu 1.jpg',
        '../Medias/Image/NomDuJeu 2.jpg',
        '../Medias/Image/NomDuJeu 3.jpg'
    ],
    sound: [
        '../Medias/Sound/NomDuJeu 1.mp3',
        '../Medias/Sound/NomDuJeu 2.mp3',
        '../Medias/Sound/NomDuJeu 3.mp3'
    ],
    text: [
        "Premier indice textuel...",
        "Deuxième indice...",
        "Troisième indice..."
    ]
}
```

### Ajouter une abréviation
Dans `gamesDatabase.js`, section `abbreviations` :

```javascript
'nom complet du jeu': ['abbr1', 'abbr2']
```

### Modifier les couleurs néon
Dans `CSS/hub.css` ou `CSS/index-style.css` :

```css
:root {
  --accent1: #ffb86b;  /* Orange */
  --accent2: #ff6b9f;  /* Rose */
}
```

## 🔧 Architecture technique

### Gestion des données
- **LocalStorage** : Profils, progression, statistiques
- **Structure JSON** : Organisation modulaire des données
- **Synchronisation** : Mise à jour temps réel entre modules

### Modules principaux
- **gamesDatabase.js** : 100+ jeux avec indices multimédias
- **gameCompletion.js** : Logique de fin de mode et attribution de clés
- **dialogue.js** : Système de dialogues contextuels
- **profiles.js** : CRUD des profils utilisateurs

### Points techniques notables
- Import/Export ES6 pour modularité
- Système d'événements clavier avancé
- Gestion d'état complexe (progression par mode)
- Animations CSS avec transitions fluides
- Navigation accessible (keyboard-first)

## 🎯 Roadmap / Améliorations futures

- [ ] Mode multijoueur local
- [ ] Système de succès/achievements
- [ ] Leaderboards avec temps
- [ ] Contenu de la chambre secrète
- [ ] Mode difficile avec moins d'indices
- [ ] Ajout de nouveaux jeux régulièrement
- [ ] Export/Import de profils
- [ ] Thèmes visuels alternatifs

## 📊 Statistiques du projet

- **100+ jeux** référencés
- **4 modes de jeu** complets
- **300+ fichiers média** (images + sons)
- **3000+ lignes de code** JavaScript
- **Système de profils** multi-utilisateurs
- **Navigation 100% clavier** supportée

## 🐛 Problèmes connus

- Les assets multimédias ne sont pas inclus dans le repository (taille)
- LocalStorage limité à ~5-10MB selon navigateur
- Pas de sauvegarde cloud (données locales uniquement)

## 📝 Crédits

- **Développement** : Lelio88
- **Design** : Interface néon custom
- **Assets** : Images et sons de jeux (droits respectifs des éditeurs)
- **Base de données** : Descriptions de jeux compilées

---

*Projet personnel le plus ambitieux - Système de jeu complet avec progression, multiples modes et gestion avancée de profils*

## 🔗 Liens utiles

- Repository : `https://github.com/Lelio88/GTG`
- Autres projets : [GitHub Profile](https://github.com/Lelio88)

**Note importante** : Les assets multimédias (images et sons) ne sont pas inclus dans le repository en raison de leur taille. Le jeu nécessite ces fichiers pour fonctionner correctement.
