# Guess The Game — Contexte d'Opération et Garde-Fous Agentiques

Résolvez les problèmes sans introduire de régression ni de dette technique architecturale.

## I. Finalité

**Application** : `GTG` — site web statique de devinette de jeux vidéo (vanilla JS, single-player + multijoueur, profils locaux).
**Objectif métier** : 8 modes de devinette (Full/Image/Sound/Text + 4 variantes hardcore) + un mode **Geo** (panorama 360°), progression par clés, 4 profils max, persistance 100 % `localStorage` en solo.

## II. Architecture

**Modèle** : MPA (Multi-Page Application) vanilla JS, sans framework ni bundler. Le **solo** vit en `localStorage` et reste 100 % `file://`-compatible. Le **multi** (`JS/multi/`) utilise Firebase Realtime Database via CDN ESM (réseau requis).

**Détails complets** (modèle `Profile`/`Game`, conventions d'assets, règles de couplage, flux d'une partie, RTDB multi, patterns, anti-patterns) : voir [`docs/architecture.md`](./docs/architecture.md).

Topologie rapide :
- **Entrée** : `index.html`/`JS/index.js` (profils, entrée multi) ; `HTML/hub.html`/`JS/hub.js` (hub solo, déblocage hardcore)
- **Modes solo** : `HTML/<mode>.html` + `JS/<mode>.js` (9 modes, dont `geo`) ; rendu d'indices factorisé dans `JS/hint-renderers.js` (partagé solo ⇄ multi)
- **Chambre** : `HTML/chamber.html`/`JS/chamber.js` (zones cliquables) → Trophées (`trophy.*` + `JS/achievements.js`) et mode `geo`
- **Multi** : `HTML/multi-*.html` + `JS/multi/*.js` (firebase, scoring, lobby, host-engine, round-client, scoreboard)
- **Couche partagée solo** : `gameUtils.js` (timer/score/validation/abandon/`revealTitle`), `state/{profileStore,gameProgress,modeReset}.js`, `ui/dialog.js` (modales), `achievements.js`, `hellMode.js`, `gameCompletion.js`, `saveManager.js`, `dialogue.js`
- **Données & style** : `gamesDatabase.js` + `abbreviations.js` ; `Assets/` (UI), `Medias/<Type>/` (jeu), `store-screenshots/` (fiche Play Store) ; `CSS/tokens.css` (tokens néon), `CSS/multi.css`, `CSS/coming-soon.css` (pages « à venir » `HTML/{calculator,films,pantone,xxx}.html`)
- **Outils admin** : `Python/*.py` (génération d'assets : captures, silhouettes, sons, panoramas 360)
- **App mobile** : `mobile/` — empaquetage **Android via Capacitor** (AAB), isolé du web ; voir `mobile/README.md`

## III. Pile Technologique

*Web : aucun manifest (pas de `package.json`), pas de build step. **Exception** : `mobile/` a son propre `package.json` (Capacitor), isolé du web. N'introduisez aucune dépendance web sans approbation.*

- **Front** : HTML5, CSS3 (variables custom, animations néon, `prefers-reduced-motion`), JavaScript ES6+ modules natifs
- **CDN runtime pinné** : `anime.js 3.2.1` (cdnjs, SRI) ; via **esm.sh** : `tone@15.1.22` + `@tonejs/midi@2.0.28` (MIDI), `canvas-confetti@1.9.3` (multi), `@photo-sphere-viewer/core@5` (Geo 360°)
- **Multi** : Firebase Realtime Database + Anonymous Auth via CDN ESM (App Check désactivé)
- **Persistance** : `window.localStorage` (clés racine `profiles`, `currentProfile` ; alias éphémère multi `gtg_multi_last_alias`)
- **Outils admin (hors web)** : Python 3 + `Pillow`, `yt_dlp`, `rembg`, `ffmpeg`/`ffmpeg-normalize`, Tkinter — cf. `Python/requirements.txt`

## IV. Garde-Fous non négociables

1. **Vanilla JS, pas de bundler** (côté web) : aucun npm/`package.json`/build à la racine. Deps via CDN ESM. Le **solo** reste 100 % `file://`-compatible (double-clic `index.html`). Exceptions : le **multi** (Firebase + réseau) et l'**app mobile** (`mobile/`, Capacitor + npm, isolée — le web racine reste inchangé).
2. **Persistance solo via `localStorage`** : exactement deux clés racine (`profiles` = tableau, `currentProfile` = pseudo string). Jamais l'objet profil entier dans `currentProfile`. Le multi n'écrit jamais dans le localStorage solo.
3. **Factorisation obligatoire** : tout mode consomme `gameUtils.js`, les renderers de `hint-renderers.js`, `state/profileStore.js` (profil), `state/gameProgress.js` (jeu en cours), `ui/dialog.js` (modales). **Aucun `alert/prompt/confirm` natif, aucun `onclick` inline, aucun `JSON.parse(localStorage.getItem('profiles'))` direct.**
4. **Convention d'assets** : `Medias/<Type>/<Title> <N>.<ext>` (`<Title>` = champ `title` de `gamesDatabase.js`, espaces inclus). Toute renomination propage code ET fichiers.
5. **Chemins relatifs depuis HTML** : un `<script type="module">` d'`HTML/x.html` voit `'../JS/...'` et `'../Medias/...'`.
6. **Pas d'injection HTML utilisateur** : pseudos et texte saisi via `innerText`/`escapeHtml()`, jamais `innerHTML` direct.
7. **Multi : seul l'hôte écrit dans `game/`** (règles RTDB). Les autres écrivent leur `players/{uid}` et `currentRound/results/{uid}` ; toute transition de manche passe par `host-engine.js`.
8. **Auto-documentation** : tout nouveau `JS/*.js` publie un en-tête (rôle, invariants, IDs DOM attendus, dépendances).

## V. Flux de Travail (Explore → Plan → Code → Verify)

1. **Exploration** — lire le mode voisin le plus proche pour calquer le pattern.
2. **Planification** — soumettre l'approche pour tout changement de schéma `Profile`, d'API `gameUtils.js`, ou de structure d'asset.
3. **Test** — non outillé côté navigateur ; écrire un scénario manuel reproductible avant d'implémenter (les modules à logique pure, ex. `achievements.js`, sont testables en Node).
4. **Implémentation** — code minimal, garde-fous IV respectés, en-tête de module (IV.8).
5. **Vérification** — `python -m http.server 8000`, tester le flow end-to-end, inspecter `localStorage` via DevTools.

## VI. Commandes de Développement

```bash
# Lancer l'app
start index.html               # solo, ouverture directe (file://) — Windows (open / xdg-open ailleurs)
python -m http.server 8000     # solo + multi + mode Geo → http://localhost:8000/

# Outils admin Python (prérequis : pip install -r Python/requirements.txt)
python Python/check_assets.py                       # audit des assets manquants
python Python/{image,pixelated,shadow,sound}.py     # génération d'assets par mode (Tkinter / rembg / yt-dlp)
python Python/normalize_sounds.py                   # normalisation audio EBU R128
python Python/compress_images.py                    # compression batch idempotente
# Mode Geo (panoramas 360°) :
python Python/geo_fetch.py --search "<jeu> 360 VR"                          # trouver une vidéo 360
python Python/geo_fetch.py --url "URL" --title "<Jeu>" --times 00:20 01:10  # extraire des panoramas
python Python/geo_ingest.py                                                 # ingérer des captures Ansel (Medias/Geo/_inbox/<Titre>/)
python Python/geo_declare.py                                                # déclarer les champs geo dans gamesDatabase
python Python/geo_undeclare.py                                              # retirer les geo: orphelins (panoramas supprimés)

# App mobile Android (Capacitor — détails dans mobile/README.md)
cd mobile && npm run sync          # assembler www/ (médias réécrits vers le CDN) + cap sync
cd mobile/android && JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" ./gradlew bundleRelease   # AAB signé

# Publication Play Store (prérequis : 1ʳᵉ version envoyée à la main dans la console)
python mobile/publish_play.py --show-config                    # config détectée, sans réseau
python mobile/publish_play.py --track alpha --dry-run          # valide sans rien publier
python mobile/publish_play.py --track alpha --notes-file <f>   # publie en test fermé
```

## VII. Maintenance documentaire

**Règle d'or** : le diff du code et celui de la doc correspondante doivent être dans **le même commit**.

| Modification | Fichier(s) à mettre à jour |
|---|---|
| Nouveau mode de jeu | `docs/architecture.md` §3-4 + `JS/hub.js` (`modeNeonMapping`) + renderer dans `hint-renderers.js` + entrée `modes` (`gameUtils`) + succès (`achievements.js` `MODES`) |
| Nouveau champ `Profile` | `docs/architecture.md` §4 + migration paresseuse dans `gameUtils.js::initializeProfile()` |
| Nouveau jeu / abréviation | `JS/gamesDatabase.js` (+ assets IV.4) / table `JS/abbreviations.js` |
| API `gameUtils.js` / `hint-renderers.js` | `docs/architecture.md` §7 |
| Schéma RTDB multi | `docs/architecture.md` §15 + règles `database.rules.json` (console Firebase) |
| Convention d'asset / nouvel anti-pattern | `docs/architecture.md` §6 (+ `Python/*.py`) / §11 |
| Mode Geo (assets, viewer) | `Python/geo_*.py` (dont `geo_undeclare.py`), `hint-renderers.js` (`renderHintGeo`/`cleanupGeo`), `README.md` (guide) |
| Mode Enfer (fenêtre 666–777) | `JS/hellMode.js` (`HELL_THRESHOLD`/`HELL_MAX`) + `CSS/tokens.css` (`html.gtg-hell`) |
| App mobile (Capacitor) | `mobile/README.md` ; relancer `npm run sync` avant tout rebuild AAB |
| Procédure de publication Play | `mobile/publish_play.py` + `../play-store-publication-guide.md` §13. Service account JSON dans `../.gtg-secrets/play-sa.json` — **hors dépôt** |
| Responsive / orientation d'une page | bloc `@media (max-height: 600px)` dans le CSS de page concerné + `docs/architecture.md` §10-11 (doctrine « viewport court ») ; orientation dans `mobile/android/app/src/main/AndroidManifest.xml` (`screenOrientation`) |
| Icône de l'app Android | régénérer via `mobile/` (mipmap-*/`ic_launcher*.png` toutes densités) + `res/values/ic_launcher_background.xml` + icône Play Store canonique `store-screenshots/icon-512.png` |

## VIII. Contexte de Session

- **État courant** : app packagée **Android** (Capacitor, `versionName 1.0.1`) tournant en **portrait ET paysage** (`screenOrientation="fullUser"`) ; solo + multi + Geo opérationnels. Doctrine responsive « viewport court » : `docs/architecture.md` §10-11 ; build/signature AAB : `mobile/README.md`.
- **État Play Store** : **versionCode 2 diffusé en test fermé** (track `alpha`). Les envois suivants passent par `mobile/publish_play.py` (incrémenter `versionCode` dans `mobile/android/app/build.gradle` avant tout rebuild — un versionCode n'est jamais réutilisable).
- **Prochaines étapes** : ajouter l'icône `store-screenshots/icon-512.png` à la fiche Play ; enrichir le catalogue **Geo** via captures Ansel ; repositionner `#zone-geo` dans la chambre.
