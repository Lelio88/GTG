# Guess The Game 🎮

Jeu de devinette de jeux vidéo en **vanilla JavaScript** — 8 modes, gestion de profils locaux, et mode **multijoueur en ligne** pour 2 à 8 joueurs.

🎮 **Jouer maintenant** : **[https://lelio88.github.io/GTG/](https://lelio88.github.io/GTG/)**

---

## ✨ Fonctionnalités

### 🕹️ 8 modes de jeu

| Mode de base | Mode hardcore (à débloquer) |
|---|---|
| **Full Package** — image + son + texte | **Pixelated** — image fortement pixelisée |
| **Image Only** — captures d'écran | **Shadow** — silhouette sur fond noir |
| **Sound Only** — bandes-son | **MIDI** — bande-son réduite à un MIDI |
| **Text Only** — descriptions textuelles | **Emoji** — suite d'emojis évocateurs |

### 👤 Mode Solo
- Jusqu'à **4 profils** sauvegardés (export/import JSON)
- **Système de clés** : complète un mode → débloque un mode hardcore
- **3 indices progressifs** par jeu (sur les modes de base)
- **100+ jeux** dans le catalogue
- Reconnaissance des **abréviations** (LOL, GTA, CS…)

### 🌐 Mode Multijoueur (en ligne)
- **2 à 8 joueurs** dans une room, lien partageable
- **Scoring compétitif** : 1er = max de points, bonus podium, dégressif jusqu'au dernier
- **30 secondes par manche**, fenêtre de grâce de 10s après le premier hit
- **Sidebar live** : statuts des joueurs en direct (🔍 / ✅ / 🏳️)
- L'hôte peut **prolonger la partie** à tout moment

---

## 🚀 Comment jouer

### Solo

1. Ouvre [https://lelio88.github.io/GTG/](https://lelio88.github.io/GTG/)
2. Crée un profil (clique sur une case "Vide")
3. Choisis un mode dans le hub → trouve les jeux → débloque des clés 🔑

### Multijoueur avec des amis

1. Sur la page d'accueil, clique **🎮 Multijoueur**
2. Entre ton pseudo, choisis un mode et un nombre de manches → **Créer la room**
3. Clique **Copier** pour récupérer le lien de partage
4. Envoie-le à tes amis (WhatsApp, Discord, SMS…) — ils cliquent, entrent leur pseudo, ils sont dans la room
5. Quand au moins 2 joueurs sont prêts, l'hôte clique **Démarrer la partie**

---

## 🛠️ Installer en local

Le solo fonctionne en simple ouverture de fichier ; le multi nécessite un serveur HTTP local.

```bash
git clone https://github.com/Lelio88/GTG.git
cd GTG

# Solo uniquement (ouverture directe)
start index.html        # Windows
open index.html         # macOS

# Solo + multi (serveur HTTP local nécessaire pour Firebase)
python -m http.server 8000
# Puis ouvre http://localhost:8000/
```

Les assets multimédias (`Medias/Image/`, `Medias/Sound/`, etc.) ne sont **pas inclus** dans le repo en raison de leur taille. Sans eux, l'app charge mais les jeux n'auront pas d'indices visuels/sonores.

---

## 🗺️ Roadmap

- [x] 4 modes de jeu de base
- [x] 4 modes hardcore débloquables
- [x] Système de profils + export/import
- [x] **Mode multijoueur en ligne**
- [x] Système de succès / achievements
- [ ] Leaderboards permanents
- [ ] Contenu de la chambre secrète
- [ ] Thèmes visuels alternatifs

---

## 📚 Documentation technique

Pour les contributeurs / devs :
- [`CLAUDE.md`](./CLAUDE.md) — contexte d'opération + garde-fous (8 sections concises)
- [`docs/architecture.md`](./docs/architecture.md) — architecture détaillée (modèle de données, conventions, flux d'une partie)
- [`docs/multiplayer-architecture.md`](./docs/multiplayer-architecture.md) — stack multi (Firebase RTDB, modules, règles de sécurité)

---

## 📝 Crédits

Développé par **[Lelio88](https://github.com/Lelio88)**. Assets et bandes-son issus de leurs jeux respectifs, droits aux éditeurs.
