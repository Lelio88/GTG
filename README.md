# Guess The Game 🎮

Jeu de devinette de jeux vidéo en **vanilla JavaScript** — 8 modes classiques + un mode **Geo 360°**, gestion de profils locaux, et mode **multijoueur en ligne** pour 2 à 8 joueurs.

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

### 🌍 Mode Geo (spécial)
Accessible depuis la **chambre** : tu es lâché dans un **panorama 360° explorable** (souris/tactile) d'une scène de jeu, à identifier à partir du décor — façon *GeoGuessr*. Voir plus bas pour **[ajouter des jeux au mode Geo](#-compléter-le-mode-geo-panoramas-360)**.

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

Les assets multimédias (`Medias/Image/`, `Medias/Sound/`, etc.) **sont versionnés dans le dépôt** (~800 Mo) : c'est ce qui permet au site **GitHub Pages** de servir directement les indices visuels/sonores. Le clone les récupère donc intégralement — seul `Medias/Geo/_inbox/` (captures 360° en cours d'ingestion) est ignoré.

---

## 🌍 Compléter le mode Geo (panoramas 360°)

Un jeu devient jouable en mode **Geo** dès qu'il possède ≥ 1 **panorama equirectangulaire** (image au ratio **2:1**) dans `Medias/Geo/<Titre> N.jpg`. Le `<Titre>` doit correspondre **exactement** au champ `title` de `JS/gamesDatabase.js`.

Trois scripts Python outillent ça (prérequis : `pip install -r Python/requirements.txt` — `yt-dlp`, `ffmpeg`, `Pillow`). Deux voies au choix :

### Voie 1 — depuis une vidéo YouTube 360°
De nombreux jeux ont des vidéos 360° sur YouTube (stockées en equirectangulaire).

```bash
# 1. Trouver une vidéo (les résultats marqués "[OK ]" = ratio 2:1, exploitables)
python Python/geo_fetch.py --search "God of War 360 VR"

# 2. Extraire un ou plusieurs panoramas aux moments voulus
python Python/geo_fetch.py --url "https://youtu.be/XXXX" --title "God of War" --times 00:20 01:10

# 3. Déclarer les panoramas dans gamesDatabase.js
python Python/geo_declare.py
```
> 💡 Privilégie les jeux **FPS** (Subnautica, Portal, Metro…) : le panorama est du décor pur, sans personnage — les jeux en 3ᵉ personne montrent le héros, ce qui donne un gros indice.

### Voie 2 — depuis tes propres captures (NVIDIA Ansel)
Pour les jeux sans vidéo 360°, capture-les toi-même :

1. **En jeu** : place-toi à un bel endroit → `Alt+F2` → mode **360°** → **Snap** (Ansel produit une image equirectangulaire).
2. Range tes captures **par jeu** dans `Medias/Geo/_inbox/<Titre exact>/` (un sous-dossier par jeu).
3. Lance :
   ```bash
   python Python/geo_ingest.py
   ```
   Le script **valide** (rejette tout ce qui n'est pas du 360°), redimensionne, **nomme** `<Titre> N.jpg`, range dans `Medias/Geo/` et **déclare** automatiquement dans `gamesDatabase.js`.

### Vérifier
```bash
python -m http.server 8000
```
Puis `http://localhost:8000/` → un profil → **chambre** → zone **Geo** → le jeu apparaît, avec un angle de spawn aléatoire dans le panorama.
> ⚠️ Teste via `http://localhost:8000/` (pas en double-clic `file://` : le rendu WebGL des textures locales y est bloqué).

---

## 🗺️ Roadmap

- [x] 4 modes de jeu de base
- [x] 4 modes hardcore débloquables
- [x] Système de profils + export/import
- [x] **Mode multijoueur en ligne**
- [x] Système de succès / achievements
- [x] **Mode Geo** (panorama 360° explorable) + outils d'ajout d'assets
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
