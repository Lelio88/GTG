# Guess The Game — Contexte d'Opération et Garde-Fous Agentiques

Résolvez les problèmes sans introduire de régression ni de dette technique architecturale.

## I. Finalité

**Application/Package** : `GTG` — site web statique de devinette de jeux vidéo (vanilla JS, multi-mode, single-player, profils locaux).
**Objectif métier** : proposer 8 modes de devinette (Full, Image, Sound, Text + 4 variantes hardcore) avec progression par clés, gestion de 4 profils max, et persistance 100 % `localStorage`.

## II. Architecture

**Modèle** : MPA (Multi-Page Application) vanilla JS sans framework ni bundler. Le **solo** vit en `localStorage` et reste 100 % `file://`-compatible. Le **multijoueur** (`JS/multi/`) utilise Firebase Realtime Database via CDN ESM et nécessite une connexion réseau.

**Détails complets** (modèle de données `Profile`/`Game`, conventions d'assets, règles de couplage, flux d'une partie, modèle RTDB multi, patterns imposés, anti-patterns) : voir [`docs/architecture.md`](./docs/architecture.md).

Topologie rapide :
- `index.html` + `JS/index.js` — sélection de profil + entrée Multijoueur
- `HTML/hub.html` + `JS/hub.js` — hub des modes solo, déblocage hardcore
- `HTML/<mode>.html` + `JS/<mode>.js` — un duo par mode (8 modes solo)
- `HTML/multi-lobby.html` + `JS/multi/lobby-entry.js` — création / jointure de room
- `HTML/multi-room.html` + `JS/multi/room-entry.js` — room (lobby + partie + résultats)
- `JS/hint-renderers.js` — renderers des indices factorisés (partagés solo ⇄ multi)
- `JS/gameUtils.js` — timer, score, validation, abandon (couche partagée solo)
- `JS/gamesDatabase.js` — catalogue des jeux + table d'abréviations
- `JS/multi/*.js` — stack multi : firebase, scoring, lobby, host-engine, round-client, scoreboard, url-room
- `JS/gameCompletion.js`, `JS/dialogue.js`, `JS/saveManager.js` — services transverses solo
- `CSS/multi.css` — styles dédiés au mode multi
- `Assets/` — UI (logo, personnages) ; `Medias/<Type>/` — assets de jeu (hors repo)
- `Python/*.py` — outils admin hors-ligne pour scraper les assets (non runtime)

## III. Pile Technologique

*Aucun fichier de manifest (pas de `package.json`). Versions runtime déterminées par le navigateur cible. N'introduisez aucune dépendance front/back sans approbation.*

- **Front** : HTML5, CSS3 (variables custom, animations néon), JavaScript ES6+ modules natifs
- **CDN runtime** : `anime.js 3.2.1` (animation du logo sur `index.html` uniquement)
- **Persistance** : `window.localStorage` (clés racine : `profiles`, `currentProfile`)
- **Outils admin (hors web)** : Python 3 + `Pillow`, `requests`, `duckduckgo_search`, Tkinter

## IV. Garde-Fous non négociables

1. **Vanilla JS, pas de bundler** : aucun npm/yarn, aucun `package.json`, aucun build step. Les dépendances externes (Firebase, Tone.js) sont importées via CDN ESM. Le **solo** doit rester 100 % `file://`-compatible (ouverture directe d'`index.html` par double-clic). Le **multijoueur** dépend de Firebase + connexion réseau — c'est l'unique exception documentée.
2. **Persistance solo unique via `localStorage`** : exactement deux clés racine (`profiles` = tableau JSON, `currentProfile` = string pseudo). Ne jamais stocker l'objet profil entier dans `currentProfile`. Le multi n'écrit **jamais** dans le `localStorage` solo (alias éphémères, pas de pollution croisée).
3. **Factorisation obligatoire via `gameUtils.js` + `hint-renderers.js`** : tout module de mode (`full.js`, `image.js`, etc., et l'équivalent multi) consomme les utilitaires de `gameUtils.js` (timer, score, validation, abandon) ET les renderers d'indices de `hint-renderers.js`. Une seule source de vérité par mode — pas de duplication entre solo et multi.
4. **Convention de nommage des assets** : `Medias/<Type>/<Title> <N>.<ext>` (`<Title>` identique au champ `title` de `gamesDatabase.js`, espaces inclus). Toute renomination doit propager dans le code ET les fichiers.
5. **Chemins relatifs depuis HTML** : un `<script type="module">` chargé par `HTML/x.html` voit les imports relatifs à la page HTML — toujours `'../JS/...'` et `'../Medias/...'`.
6. **Pas d'injection HTML utilisateur** : pseudos (solo ET multi) et texte saisi sont rendus via `innerText` ou échappés via `escapeHtml()`. Jamais `innerHTML` direct sur du contenu utilisateur.
7. **Multi : seul l'hôte écrit dans `game/`** : les règles RTDB l'imposent. Les autres clients écrivent uniquement leur propre `players/{uid}` et `currentRound/results/{uid}`. Toute transition de manche passe par `host-engine.js`.
8. **Auto-documentation des modules** : tout nouveau fichier `JS/*.js` publie en tête un commentaire d'en-tête (rôle, invariants, IDs DOM attendus, dépendances), à l'image de `gameUtils.js` et `hint-renderers.js`.

## V. Flux de Travail (Explore → Plan → Code → Verify)

1. **Exploration** — lire le mode voisin le plus proche pour calquer le pattern (timer, scoring, indices, abandon)
2. **Planification** — soumettre l'approche à l'utilisateur pour tout changement de schéma `Profile`, d'API de `gameUtils.js`, ou de structure d'asset
3. **TDD** — non outillé ; à défaut, écrire un scénario de test manuel reproductible avant d'implémenter (cf. `docs/architecture.md` §14)
4. **Implémentation** — code minimal pour faire passer le scénario ; respecter les garde-fous IV
5. **Vérification** — ouvrir `index.html` dans le navigateur, tester le flow end-to-end, inspecter `localStorage` via DevTools

## VI. Commandes de Développement

```bash
# Lancer l'application — option 1 : ouverture directe
start index.html          # Windows
open index.html            # macOS
xdg-open index.html        # Linux

# Lancer l'application — option 2 : serveur HTTP statique local
python -m http.server 8000
# → http://localhost:8000/

# Régénérer les assets (outils admin, à exécuter hors-ligne)
cd Python && python image.py      # captures de gameplay
cd Python && python pixelated.py  # jaquettes pixelisées
cd Python && python shadow.py     # silhouettes
cd Python && python sound.py      # bandes-son
```

## VII. Maintenance documentaire

**Règle d'or** : le diff du code et le diff de la doc correspondante doivent être dans **le même commit**.

| Modification | Fichier à mettre à jour |
|---|---|
| Nouveau mode de jeu (HTML + JS + entrée `modes`) | `docs/architecture.md` §3 (catalogue) + §4 (init `scoresByMode`) + `JS/hub.js` (`modeNeonMapping`, `hardcoreConfig`) + nouveau renderer dans `JS/hint-renderers.js` + entrée `<option>` dans `HTML/multi-lobby.html` |
| Nouveau champ dans l'objet `Profile` | `docs/architecture.md` §4 + migration paresseuse dans `gameUtils.js::initializeProfile()` |
| Nouveau jeu dans le catalogue | `JS/gamesDatabase.js` + assets `Medias/<Type>/<Title> N.ext` selon §6 |
| Nouvelle abréviation acceptée | Table `abbreviations` de `JS/gamesDatabase.js` |
| Modification de l'API de `gameUtils.js` ou `hint-renderers.js` | `docs/architecture.md` §7 (catalogue de fonctions) |
| Modification du schéma RTDB multi | `docs/architecture.md` §15 (multi) + règles `database.rules.json` dans la console Firebase |
| Nouvel anti-pattern découvert | `docs/architecture.md` §11 |
| Modification de la convention d'asset | `docs/architecture.md` §6 + scripts `Python/*.py` |

## VIII. Contexte de Session

- **Dernier focus** : —
- **Focus immédiat** : —
