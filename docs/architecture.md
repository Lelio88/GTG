# GTG — Architecture

> Annexe technique de [`../CLAUDE.md`](../CLAUDE.md). Cette page décrit **l'état courant** du projet : structure, conventions, contrats internes, anti-patterns. Pour l'historique, consulter `git log`.

## 1. Vue d'ensemble

**Guess The Game** est une application web statique (vanilla JS + HTML/CSS) qui propose 8 modes de devinette de jeux vidéo. Le **mode solo** n'a aucun build step ni serveur : ouverture directe via `file://` ou n'importe quel serveur HTTP statique. Toute sa persistance (profils, scores, déblocages) vit dans le `localStorage` du navigateur.

Le **mode multijoueur** (2-8 joueurs, rooms en temps réel) est greffé par-dessus le solo via une stack `JS/multi/` qui dépend de Firebase Realtime Database (CDN ESM, pas de bundler). Le solo et le multi partagent les renderers d'indices (`JS/hint-renderers.js`) et le catalogue (`JS/gamesDatabase.js`) — pas de duplication. Voir §15 + [`./multiplayer-architecture.md`](./multiplayer-architecture.md).

Le projet est volontairement **sans framework** : pas de React, pas de Vue, pas de bundler. Les fichiers HTML sont des entry points indépendants ; chacun importe son module JS via `<script type="module">`.

## 2. Topologie des couches

```
┌──────────────────────────────────────────────────────────────┐
│  Navigateur (file:// ou HTTP statique)                       │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Pages (entry points HTML)                             │  │
│  │   index.html  → JS/index.js     (sélection profil)     │  │
│  │   HTML/hub.html → JS/hub.js     (hub des modes)        │  │
│  │   HTML/<mode>.html → JS/<mode>.js  (un par mode)       │  │
│  │   HTML/chamber.html → JS/chamber.js (déblocages clé)   │  │
│  └─────────────────────┬──────────────────────────────────┘  │
│                        │ import ES6                          │
│  ┌─────────────────────▼──────────────────────────────────┐  │
│  │  Couche partagée                                       │  │
│  │   JS/gameUtils.js     (timer, score, indices, valid.)  │  │
│  │   JS/gamesDatabase.js (catalogue + abbreviations)      │  │
│  │   JS/gameCompletion.js (fin de mode → clé + redirect)  │  │
│  │   JS/dialogue.js       (personnage guide contextuel)   │  │
│  │   JS/saveManager.js    (export/import JSON profil)     │  │
│  │   JS/profiles.js       (legacy CRUD, non-importé)      │  │
│  └─────────────────────┬──────────────────────────────────┘  │
│                        │ read/write                          │
│  ┌─────────────────────▼──────────────────────────────────┐  │
│  │  Persistance                                           │  │
│  │   window.localStorage                                  │  │
│  │    ├─ 'profiles'         (array<Profile>, JSON)        │  │
│  │    └─ 'currentProfile'   (string : pseudo du profil)   │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘

   Assets statiques (hors localStorage)
   ┌─────────────────────────────────────────────────────────┐
   │  Assets/        UI (logo, personnages dialogue)         │
   │  Medias/Image/  <Title> <1|2|3>.jpg   (Image mode)      │
   │  Medias/Sound/  <Title> <1|2|3>.mp3   (Sound mode)      │
   │  Medias/Midi/   <Title>.mid           (Midi mode)       │
   │  Medias/Shadow/ <Title>.png           (Shadow mode)     │
   │  Medias/Pixels/ <Title>.png           (Pixelated mode)  │
   └─────────────────────────────────────────────────────────┘

   Outillage hors-ligne (admin assets, exécuté en local)
   ┌─────────────────────────────────────────────────────────┐
   │  Python/  *.py  scripts Tkinter + duckduckgo_search     │
   │           pour scraper Image / Sound / Shadow / Pixels  │
   │           depuis gamesDatabase.js                       │
   └─────────────────────────────────────────────────────────┘

   Mode Multijoueur (optionnel, nécessite réseau — §15)
   ┌─────────────────────────────────────────────────────────┐
   │  HTML/multi-lobby.html + multi-room.html                │
   │   → JS/multi/*.js (lobby, host-engine, round-client,    │
   │                    scoring, scoreboard, firebase)       │
   │   ↕ Firebase Realtime Database (europe-west1)           │
   │  + Anonymous Auth, règles RTDB strictes                 │
   │  Réutilise : JS/hint-renderers.js, gamesDatabase.js,    │
   │              gameUtils.js::checkAnswerValue             │
   └─────────────────────────────────────────────────────────┘
```

## 3. Catalogue des modes de jeu

Chaque mode est une triade `HTML/<mode>.html` + `JS/<mode>.js` + un set d'assets dans `Medias/<Type>/`. Le module JS importe `games` depuis `gamesDatabase.js` et factorise sa logique via `gameUtils.js`.

| Mode | Type d'indice | Source asset | Débloqué par |
|---|---|---|---|
| `full` | Image + Son + Texte | `image[]`, `sound[]`, `text[]` | (mode de base) |
| `image` | 3 captures d'écran | `image[]` | (mode de base) |
| `sound` | 3 extraits audio | `sound[]` | (mode de base) |
| `text` | 3 descriptions textuelles | `text[]` | (mode de base) |
| `pixelated` | Image pixelisée | `pixels` | Complétion de `full` |
| `shadow` | Silhouette noire | `shadow` | Complétion de `image` |
| `midi` | Bande-son réduite à un MIDI | `midi` | Complétion de `sound` |
| `emoji` | Suite d'emojis | `emoji` (string) | Complétion de `text` |

La correspondance base ↔ hardcore est codifiée dans `JS/hub.js` (`hardcoreConfig`) et le mapping couleur dans `modeNeonMapping`. Le déblocage matériel (`unlockedModes`) se fait via la chambre (`HTML/chamber.html` + `JS/chamber.js`) qui consomme les clés du profil.

## 4. Modèle de données — `Profile`

Stocké dans `localStorage['profiles']` sous la forme d'un tableau (max 4 entrées). La clé `localStorage['currentProfile']` ne contient **que le pseudo** ; l'objet complet est résolu par `profiles.find(p => p.pseudo === currentPseudo)`.

```javascript
{
  id: 1735905600000,                  // Date.now() à la création
  pseudo: 'Lelio',                    // ≤ 20 caractères, unique
  goodAnswers: 0,                     // legacy global, conservé pour rétrocompat
  badAnswers: 0,                      // legacy global, conservé pour rétrocompat
  scoresByMode: {                     // ← source de vérité par mode
    full:      { goodAnswers: 0, badAnswers: 0 },
    image:     { goodAnswers: 0, badAnswers: 0 },
    sound:     { goodAnswers: 0, badAnswers: 0 },
    text:      { goodAnswers: 0, badAnswers: 0 },
    midi:      { goodAnswers: 0, badAnswers: 0 },
    shadow:    { goodAnswers: 0, badAnswers: 0 },
    pixelated: { goodAnswers: 0, badAnswers: 0 },
    emoji:     { goodAnswers: 0, badAnswers: 0 }
  },
  guessedGamesByMode: {               // titres déjà trouvés par mode
    full: [], image: [], sound: [], text: [],
    midi: [], shadow: [], pixelated: [], emoji: []
  },
  completedModes: ['full'],           // modes 100 % terminés
  unlockedModes: ['pixelated'],       // modes hardcore débloqués via chambre
  keys: 1,                            // clés disponibles pour ouvrir la chambre
  visitCount: 12                      // visites du hub (utilisé par dialogue.js)
}
```

**Migration legacy** : `initializeProfile(profile)` dans `gameUtils.js` ajoute idempotemment les champs `scoresByMode` et `guessedGamesByMode` aux anciens profils ne possédant que `goodAnswers` / `badAnswers`. Tout nouveau champ doit suivre le même pattern d'initialisation paresseuse.

## 5. Modèle de données — `Game`

Une entrée du tableau `games` exporté par `JS/gamesDatabase.js` :

```javascript
{
  title:  'BioShock',
  image:  ['../Medias/Image/Bioshock 1.jpg', '...2.jpg', '...3.jpg'],  // exact = 3
  sound:  ['../Medias/Sound/Bioshock 1.mp3', '...2.mp3', '...3.mp3'],  // exact = 3
  text:   ['indice 1...', 'indice 2...', 'indice 3...'],                // exact = 3
  midi:   ['../Medias/Midi/Bioshock.mid'],                              // 1 fichier
  shadow: ['../Medias/Shadow/Bioshock.png'],                            // 1 fichier
  pixels: ['../Medias/Pixels/Bioshock.png'],                            // 1 fichier
  emoji:  '🌊 💉 ⚡ 🔧 🤖 👧 🏙️ 🎩 🎪 🩸'                                // string, 10 emojis
}
```

L'objet `abbreviations` exporté par le même module mappe un titre canonique en minuscules vers une liste d'alias acceptés (ex : `'call of duty': ['cod']`). `checkAnswerValue` consulte d'abord l'égalité stricte puis cette table.

## 6. Conventions de nommage des assets

| Type | Dossier | Format | Exemple |
|---|---|---|---|
| Image (3 indices) | `Medias/Image/` | `<Title> 1.jpg`, `<Title> 2.jpg`, `<Title> 3.jpg` | `Bioshock 1.jpg` |
| Sound (3 indices) | `Medias/Sound/` | `<Title> 1.mp3`, `<Title> 2.mp3`, `<Title> 3.mp3` | `Bioshock 1.mp3` |
| Midi | `Medias/Midi/` | `<Title>.mid` | `Bioshock.mid` |
| Shadow | `Medias/Shadow/` | `<Title>.png` | `Bioshock.png` |
| Pixels | `Medias/Pixels/` | `<Title>.png` | `Bioshock.png` |

`<Title>` est le `title` du jeu **tel qu'il apparaît dans `gamesDatabase.js`** (espaces et apostrophes inclus). Le rendu HTML pointe vers `'../Medias/<Type>/<Title> N.ext'` depuis `JS/`, donc tout chemin doit être relatif au fichier HTML (qui vit dans `HTML/`). Les scripts Python utilisent `sanitize_filename()` pour neutraliser `\/*?:"<>|` mais conservent espaces et apostrophes.

## 7. Couches partagées — `JS/gameUtils.js` et `JS/hint-renderers.js`

Deux modules forment la couche partagée. Tout module de mode (solo et multi) **doit** les consommer plutôt que de réimplémenter.

### 7.1 `JS/hint-renderers.js` — Rendu des indices (partagé solo ⇄ multi)

Module commun extrait pour éviter la duplication entre les 8 modes solo et le mode multi. Une fonction par mode, signature uniforme `(game, hintIndex, container) → void`. Pour les modes one-shot (midi, shadow, pixelated, emoji), `hintIndex` est ignoré.

| Export | Rôle |
|---|---|
| `renderHintFull` / `renderHintImage` / `renderHintSound` / `renderHintText` | Renderers à indices multiples (1-3 indices) |
| `renderHintMidi` / `renderHintShadow` / `renderHintPixelated` / `renderHintEmoji` | Renderers one-shot (1 indice) |
| `cleanupMidi()` | Stoppe Tone.Transport et dispose les synths — à appeler avant changement de manche |
| `renderers` | Dispatch table `{full: ..., image: ..., ...}` pour usage multi (mode dynamique) |
| `getHintCount(mode, game)` | Nombre d'indices disponibles pour ce mode |

Le module charge `Tone.js` en **dynamic import** (utilisé uniquement par `renderHintMidi`) → pas de pénalité pour les autres modes.

### 7.2 `JS/gameUtils.js` — Logique métier solo (timer, score, validation)

Tout module de mode solo (`full.js`, `image.js`, etc.) **doit** consommer ces fonctions plutôt que de les réimplémenter :

| Fonction | Rôle |
|---|---|
| `getCurrentProfile()` | Résout l'objet `Profile` depuis `localStorage['currentProfile']` |
| `initializeProfile(p)` | Migration paresseuse des champs `scoresByMode` / `guessedGamesByMode` |
| `getAvailableGames(games, profile, mode)` | Filtre les jeux déjà devinés |
| `updateProfile(p, title, isGood, mode)` | Met à jour score + jeux trouvés + persiste |
| `saveProfile(p)` | Écrit dans `localStorage['profiles']` |
| `startTimer()` / `stopTimer(id)` | Chronomètre `#timer` mm:ss |
| `abandonGame(p, mode)` | Pénalité +10 bad answers + reload |
| `checkAnswerValue(input, title)` | Compare avec normalisation + table d'abréviations |
| `updateScoreboard(p, mode)` | Synchronise `#good-answers` et `#bad-answers` |
| `createHintNavigationSystem(n)` | Machine à états pour le déblocage progressif des indices |
| `createNavigationArrows(cb)` / `updateArrowsVisibility(...)` | Flèches DOM pour parcourir les indices débloqués |
| `setupEnterKeyHandler(check, next, isDone)` | Gestion de la touche Entrée sur `#user-input` |
| `showCorrectAnswerFeedback` / `showIncorrectAnswerFeedback` | Feedback UI standardisé |
| `revealTitle(title, opts)` | Modal/inline de révélation lors d'un abandon |

Convention IDs DOM attendus par cette couche : `#user-input`, `#message`, `#game-title`, `#next-button`, `#good-answers`, `#bad-answers`, `#timer`, `#content`, `#game`, `#hint-button`. Tout `HTML/<mode>.html` doit publier ces hooks.

## 8. Flux typique d'une partie

Exemple : ouverture de `HTML/full.html` après sélection d'un profil.

1. **Boot HTML** : `<script type="module" defer src="../JS/full.js">` chargé.
2. **Récupération profil** : `getCurrentProfile()` lit `localStorage['currentProfile']` (pseudo) → résout l'objet via `profiles.find()`. Si absent → redirection vers `../index.html`.
3. **Migration** : `initializeProfile(currentProfile)` garantit que `scoresByMode.full` et `guessedGamesByMode.full` existent.
4. **Filtre** : `getAvailableGames(games, profile, 'full')` retire les jeux déjà trouvés.
5. **Fin de mode** : si liste vide → `handleGameCompletion(profile, 'full')` ajoute `'full'` dans `completedModes`, incrémente `keys`, alerte et redirige vers `hub.html`.
6. **Tirage** : sinon, sélection aléatoire d'un `Game`, init de `hintNav = createHintNavigationSystem(3)`, affichage du 1er triplet image/son/texte via `displayHint(0)`.
7. **Saisie** : `setupEnterKeyHandler(checkAnswer, nextQuestion, () => correctAnswerGiven)` ; `checkAnswer()` appelle `checkAnswerValue(input, cachedTitle)`, route vers `showCorrectAnswerFeedback` ou `showIncorrectAnswerFeedback`, puis `updateProfile(...)` persiste.
8. **Indices** : clic sur `#hint-button` → `hintNav.unlockNext()` ; à partir du 2ᵉ indice débloqué, `createNavigationArrows(navigateHint)` ajoute les flèches DOM. Au 3ᵉ, le bouton bascule en « Abandonner » → `revealTitle(...)` puis `abandonGameUtil(...)`.
9. **Bonne réponse** : `correctAnswerGiven = true`, bouton « Prochaine question » visible, Entrée recharge la page (→ retour au point 2).

## 9. Règles de couplage

| Couche | Peut importer | Ne doit jamais importer |
|---|---|---|
| `JS/<mode>.js` | `gamesDatabase`, `gameUtils`, `gameCompletion` | un autre module de mode (`JS/sound.js` ↛ `JS/image.js`) |
| `JS/gameUtils.js` | `gamesDatabase` (pour `abbreviations`) | `gamesDatabase` pour les `games` (laissé au module appelant), aucun module de mode |
| `JS/gameCompletion.js` | rien (manipule directement le `localStorage`) | tout module de mode |
| `JS/hub.js`, `JS/index.js`, `JS/chamber.js` | `dialogue`, `saveManager` selon besoin | aucun module de mode (la navigation se fait par `window.location.href`) |
| `JS/dialogue.js` | rien | tout module de mode |
| `JS/saveManager.js` | rien | tout module de mode |

Les pages communiquent entre elles **uniquement** via `localStorage` et redirections `window.location.href`. Pas d'événements `postMessage`, pas de SharedWorker, pas d'iframes.

## 10. Patterns imposés

- **Chemins relatifs depuis HTML** : un module JS chargé par `HTML/x.html` voit le DOM de cette page, mais ses `import` et ses URL d'assets sont relatifs **au fichier HTML**, pas au JS. Tous les chemins media commencent donc par `../Medias/...`.
- **Mutation immuable du localStorage** : `JSON.parse(localStorage.getItem('profiles'))` → modification → `localStorage.setItem('profiles', JSON.stringify(...))`. Jamais d'écriture partielle ; la sérialisation est atomique au niveau du tableau entier.
- **Pseudo = clé fonctionnelle** : le pseudo identifie un profil dans les `find()` et `findIndex()`. La duplication est rejetée à la création (`addNewProfile`). Tout renommage doit propager dans `localStorage['currentProfile']`.
- **Validation insensible à la casse + abréviations** : `checkAnswerValue` `.trim().toLowerCase()` côté input et côté titre. Toute nouvelle abréviation passe par la table `abbreviations` dans `gamesDatabase.js`, jamais par du code in-line.
- **Ajout d'un nouveau mode** : (1) nouvelle entrée dans le tableau `modes` de `initializeProfile()`, (2) nouveau `HTML/<mode>.html` reprenant les IDs DOM attendus, (3) nouveau `JS/<mode>.js` calqué sur un mode voisin, (4) entrée dans `modeNeonMapping` de `hub.js`, (5) si hardcore, entrée dans `hardcoreConfig` et asset `Medias/<Type>/<Title>.<ext>` pour chaque jeu.
- **Auto-doc des modules** : tout nouveau fichier `JS/*.js` publie un commentaire d'en-tête (résumé + invariants + dépendances DOM attendues), à l'image de `gameUtils.js`.

## 11. Anti-patterns à éviter

- ❌ **Logger un secret ou un objet profil entier en `console.log`** — préférer `console.error` ciblé sur la branche d'erreur uniquement.
- ❌ **Mutations partielles du profil** sans appeler `saveProfile()` — les onglets ne se synchronisent pas, le rendu se désaligne du stockage.
- ❌ **Redéfinir un timer / un score / une logique d'abandon localement** dans un fichier de mode — toujours passer par `gameUtils.js`.
- ❌ **Pousser les assets multimédias dans le repo** — ils sont volontairement exclus (taille). Les scripts Python servent à les régénérer en local.
- ❌ **Renommer un titre dans `gamesDatabase.js` sans renommer les assets correspondants** — la nomenclature `<Title> N.ext` est le contrat.
- ❌ **Injecter de l'HTML utilisateur via `innerHTML`** — le pseudo est inséré via `innerText`, conserver ce pattern (pas de XSS local).
- ❌ **Ajouter une dépendance npm / un bundler** — le projet est volontairement `file://`-compatible.
- ❌ **Stocker un objet profil entier dans `currentProfile`** — la convention est : `currentProfile = pseudo` (string), résolu via `profiles.find()`.

## 12. Outillage Python (hors application web)

Les scripts dans `Python/` sont des outils d'administration **exécutés localement** pour peupler `Medias/`. Ils partagent une architecture commune (Tkinter UI bloquante + `duckduckgo_search` + filtrage manuel par raccourci clavier) :

| Script | Output | Spécificité |
|---|---|---|
| `image.py` | `illustrations_jeux/<Title> 1\|2\|3.jpg` | 3 captures de gameplay |
| `pixelated.py` | `pochettes_jeux/<Title>.png` | 1 jaquette, recherches séquentielles `box art` → `cover` → `key art` |
| `shadow.py` | (similaire) | Silhouette pour le mode shadow |
| `sound.py` | (similaire pour audio) | Bandes-son |

Tous consomment `gamesDatabase.js` en regex (`title\s*:\s*["\'](.*?)["']`). Pas de dépendance Python figée (pas de `requirements.txt`) ; à installer manuellement : `pillow`, `requests`, `duckduckgo_search`, `urllib3`. **Ne pas exécuter ces scripts depuis le repo de prod** : ils écrivent dans un sous-dossier `output_folder` qui n'est pas le dossier `Medias/` final — étape de copie manuelle ensuite.

## 13. Dépendances externes

| Dépendance | Type | Source | Rôle |
|---|---|---|---|
| `anime.js 3.2.1` | Runtime JS | CDN `cdnjs.cloudflare.com` | Animation du logo sur `index.html` |
| Polices système (`Poppins`) | CSS | navigateur | Police par défaut |
| `duckduckgo_search`, `Pillow`, `requests`, `urllib3` | Python | pip | Scripts d'admin assets |
| Tkinter | Python stdlib | — | UI de sélection d'image |

Aucune dépendance front bundlée. Aucune dépendance back (pas de backend).

## 14. Stratégie de test

Le projet ne contient actuellement aucune suite de tests. Pour les contributions sensibles (modification de `gameUtils.js`, du schéma `Profile`, du flow de déblocage), procéder à un **test manuel** end-to-end :

1. Ouvrir `index.html` dans Chrome/Firefox.
2. Créer un profil de test (pseudo : `test_<date>`).
3. Lancer un mode, deviner correctement 1 jeu, vérifier la persistance via DevTools → Application → LocalStorage.
4. Quitter et recharger : score, jeux trouvés, et profil sélectionné doivent persister.
5. Compléter un mode entier, vérifier l'incrémentation de `keys` et la redirection vers le hub.
6. Tester l'export (hub → bouton export) puis l'import dans un autre navigateur.

Pour une refonte, envisager un harnais Playwright local (`web/testing.md` du dossier rules : visual regression + a11y).

## 15. Mode Multijoueur

Le mode multi est greffé par-dessus le solo via une stack `JS/multi/` qui dépend de **Firebase Realtime Database** (CDN ESM). 2 à 8 joueurs partagent une **room** identifiée par un code à 6 caractères, avec scoring en temps réel et timer de 30s par manche. L'identité est un **alias éphémère** — aucune écriture dans le `localStorage` solo, pas de pollution croisée.

Points clés :
- **Source de vérité** : noeud `/rooms/{code}` dans RTDB, écouté par tous les clients via `onValue()`.
- **Autorité** : l'hôte est le seul à écrire les transitions de manche (`host-engine.js`) ; les autres clients lisent. Les règles RTDB l'imposent au niveau sécurité.
- **Scoring** : dégressif `(N − rank + 1)` + bonus podium `+3 / +2 / +1` (cf. `JS/multi/scoring.js`).
- **Échec collectif** : modale de révélation + titre re-pushé dans la pile (peut retomber).
- **Hôte déco** : `onDisconnect()` Firebase passe `meta.status = "cancelled"`, tous les clients retournent au lobby.

**Détails complets** (modèle de données RTDB, règles de sécurité, flux d'une partie, modules, cycle de vie, anti-patterns, coût Firebase) : voir [`./multiplayer-architecture.md`](./multiplayer-architecture.md).
