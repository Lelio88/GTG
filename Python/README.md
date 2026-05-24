# Outils Python — GTG

Scripts d'administration **hors-ligne** pour générer et maintenir le catalogue d'assets de `Medias/<Type>/`. Aucun n'est exécuté côté navigateur — ils sont lancés à la main pour préparer les images, sons, silhouettes, etc.

## Installation

```bash
cd Python
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

Dépendances système supplémentaires :

- **ffmpeg** — requis par `yt-dlp`, `pygame` et `ffmpeg-normalize`. Installer via :
  - Windows : déposer `ffmpeg.exe` dans `Python/` ou ajouter au `PATH`
  - macOS : `brew install ffmpeg`
  - Linux : `sudo apt install ffmpeg`

## Scripts

| Script | Rôle |
|---|---|
| `check_assets.py` | Audit du catalogue : liste les jeux dont il manque des assets dans `Medias/<Type>/`. |
| `image.py` | UI Tkinter semi-auto pour télécharger 3 screenshots par jeu (mode Image / Full / Text). |
| `pixelated.py` | UI Tkinter semi-auto pour récupérer une jaquette par jeu (mode Pixelated). |
| `shadow.py` | UI Tkinter semi-auto pour récupérer un visuel de personnage par jeu (mode Shadow). |
| `sound.py` | UI Tkinter semi-auto pour télécharger 3 extraits audio par jeu (mode Sound). |
| `fill_midi.py` | UI Tkinter pour compléter slot par slot les fichiers `.mid` manquants. |
| `fill_sound.py` | UI Tkinter pour compléter slot par slot les `.mp3` manquants. Option `--normalize`. |
| `normalize_sounds.py` | Normalise tous les MP3 de `Medias/Sound/` en EBU R128 (-16 LUFS) via `ffmpeg-normalize`. |
| `rembg_shadow.py` | Détourage IA (U²-Net) d'un visuel pour produire la silhouette du mode Shadow. |
| `standardize_pixels.py` | Réduit en 30 px de largeur (nearest neighbor) un dossier source de jaquettes pour le mode Pixelated. |

## Convention de chemins

Tous les scripts résolvent leurs chemins via `Path(__file__).resolve().parent.parent` et lisent `JS/gamesDatabase.js` depuis la racine du dépôt. Ils peuvent donc être lancés depuis n'importe quel répertoire courant :

```bash
python Python/check_assets.py
# ou
cd Python && python check_assets.py
```

Les dossiers de sortie temporaires (`illustrations_jeux/`, `pochettes_jeux/`, `personnages_originaux/`, `sons_jeux/`) sont créés à côté du script, jamais dans le `cwd`.
