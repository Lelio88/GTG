# Guess The Game — Contexte d'Opération et Garde-Fous Agentiques

Résolvez les problèmes sans introduire de régression ni de dette technique architecturale.

## I. Finalité

**Application** : `GTG` — site web statique de devinette de jeux vidéo (vanilla JS, solo + multijoueur, profils locaux), aussi empaqueté en app Android.
**Objectif métier** : 8 modes de devinette (Full/Image/Sound/Text + 4 variantes hardcore) + un mode **Geo** (panorama 360°), progression par clés, 4 profils max, persistance 100 % `localStorage` en solo.

## II. Architecture

**Modèle** : MPA vanilla JS, sans framework ni bundler. Le **solo** vit en `localStorage` ; le **multi** (`JS/multi/`) s'appuie sur Firebase Realtime Database (SDK servi par gstatic, réseau requis).

**Détails complets** (modèles `Profile`/`Game`, assets, couplage, flux d'une partie, patterns, anti-patterns) : [`docs/architecture.md`](./docs/architecture.md) ; multi (schéma RTDB, règles, consentement, purge) : [`docs/multiplayer-architecture.md`](./docs/multiplayer-architecture.md).

Topologie rapide :
- **Entrée** : `index.html`/`JS/index.js` (profils, entrée multi) ; `HTML/hub.html`/`JS/hub.js` (hub solo, déblocage hardcore)
- **Modes** : `HTML/<mode>.html` + `JS/<mode>.js` (9 modes, dont `geo`) ; indices dans `JS/hint-renderers.js` (partagé solo ⇄ multi)
- **Chambre** : `HTML/chamber.html`/`JS/chamber.js` → Trophées (`trophy.*`, `JS/achievements.js`) et mode `geo`
- **Multi** : `HTML/multi-*.html` + `JS/multi/*.js` (firebase, consentement, purge, lobby, host-engine, round-client, scoreboard, chat) ; règles `database.rules.json` + `tests/regles.test.mjs`
- **Couche partagée** : `gameUtils.js`, `state/{profileStore,gameProgress,modeReset}.js`, `ui/dialog.js` (modales), `ui/header.js` (navigation des pages de mode), `achievements.js`, `hellMode.js`, `saveManager.js`
- **Données & style** : `gamesDatabase.js`, `abbreviations.js` ; `Assets/` (UI, `fonts/`), `Medias/<Type>/` (jeu) ; `CSS/tokens.css` (tokens néon, importe `fonts.css`) ; `JS/vendor/` (bibliothèques figées)
- **Pages légales** : `privacy.html`, `mentions-legales.html` (liées depuis l'accueil, le hub et le lobby, embarquées dans l'app)
- **Outils** : `Python/*.py` (génération d'assets) ; `mobile/` (Capacitor Android, isolé, cf. `mobile/README.md`)

## III. Pile Technologique

*Web : aucun `package.json` ni build à la racine ; `mobile/` a le sien. N'introduisez aucune dépendance web sans approbation.*

- **Front** : HTML5, CSS3 (variables, néon, `prefers-reduced-motion`), JavaScript ES modules natifs
- **Bibliothèques auto-hébergées** (`JS/vendor/`, provenance dans son README) : anime.js 3.2.1, Tone 15.1.22 + @tonejs/midi 2.0.28 (MIDI), Photo Sphere Viewer 5.15.1 (Geo), canvas-confetti 1.9.3 ; polices OFL dans `Assets/fonts/`
- **Multi** : Firebase RTDB + Auth anonyme ; App Check (reCAPTCHA v3) chargé seulement après consentement
- **Persistance** : `localStorage` — `profiles`, `currentProfile` (solo) ; `gtg_multi_last_alias`, `gtg_multi_consentement` (multi)
- **Outillage** : Python 3 (`Python/requirements.txt`) ; `firebase-tools` via `npx` + Java (émulateur) ; Capacitor 8 + JBR d'Android Studio (AAB)

## IV. Garde-Fous non négociables

1. **Vanilla JS, pas de bundler ni de CDN tiers** : dépendances figées dans `JS/vendor/`, polices dans `Assets/fonts/` ; seul le SDK Firebase vient de gstatic, et seulement en multi.
2. **Persistance solo** : deux clés racine exactement (`profiles` = tableau, `currentProfile` = pseudo). Le multi n'écrit jamais dans les clés solo.
3. **Factorisation** : tout mode consomme `gameUtils.js`, `hint-renderers.js`, `state/*`, `ui/dialog.js`. **Aucun `alert/prompt/confirm` natif, aucun `onclick` inline, aucun `JSON.parse(localStorage.getItem('profiles'))`** (contrôlé par le CI).
4. **Assets** : `Medias/<Type>/<Title> <N>.<ext>` (`<Title>` = `title` de `gamesDatabase.js`) ; chemins relatifs depuis `HTML/` (`'../JS/…'`, `'../Medias/…'`).
5. **Tout champ lu en base est hostile** : texte via `innerText`/`escapeHtml()`, nombres forcés par `Number()`, jamais d'`innerHTML` brut.
6. **Multi : l'hôte est l'autorité** (seul à écrire `meta/` et `game/`) ; `database.rules.json` est versionné, testé, déployé par le CLI — jamais édité dans la console.
7. **Vie privée** : reCAPTCHA ne se charge qu'après `obtenirConsentement()` ; aucun autre traceur. Toute nouvelle donnée personnelle passe par `privacy.html` (et par `VERSION` de `consentement.js` si le texte d'accord change).
8. **Robots d'entraînement IA refusés** (décision du 2026-10-02) : chaque page porte `<meta name="tdm-reservation" content="1">` (réserve de fouille, CPI art. L122-5-3). GitHub Pages ne pose pas d'en-tête, et un `robots.txt` n'est lu qu'à la racine de `lelio88.github.io` : choix assumé de ne pas créer ce dépôt, la balise porte seule le refus. Toute nouvelle page la reprend.

## V. Flux de Travail (Explore → Plan → Code → Verify)

1. **Exploration** — lire le mode voisin le plus proche pour calquer le pattern.
2. **Planification** — soumettre l'approche pour tout changement de schéma `Profile`, d'API `gameUtils.js`, de structure d'asset ou de schéma RTDB.
3. **Test** — logique pure testable en Node (`achievements.js`…) ; règles multi par `tests/regles.test.mjs` ; le reste par un scénario manuel écrit avant d'implémenter.
4. **Implémentation** — code minimal, garde-fous IV respectés.
5. **Vérification** — `python -m http.server 8000`, parcours de bout en bout, `localStorage` inspecté ; le CI (HTML W3C, syntaxe, anti-régression) doit passer.

**Auto-documentation** : tout nouveau `JS/*.js` publie un en-tête — rôle, choix non évidents et leur motivation, invariants, IDs DOM attendus, dépendances.

## VI. Commandes de Développement

```bash
python -m http.server 8000     # solo + multi + Geo → http://localhost:8000/ (localhost : reCAPTCHA l'accepte)
# Règles multi : tester sur l'émulateur (Java), puis déployer
npx firebase-tools emulators:exec --only database "node tests/regles.test.mjs" && npx firebase-tools deploy --only database
# Assets : outils Python et mode Geo → docs/architecture.md §12 et README (« Compléter le mode Geo »)
python Python/check_assets.py                      # audit des assets manquants

# App Android : incrémenter versionCode (mobile/android/app/build.gradle) avant tout rebuild
cd mobile && npm run sync                          # assembler www/ (médias réécrits vers GitHub Pages) + cap sync
cd mobile/android && JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" ./gradlew bundleRelease
python mobile/publish_play.py --track alpha --dry-run            # puis sans --dry-run, --notes-file <f>
```

## VII. Maintenance documentaire

**Règle d'or** : le diff du code et celui de la doc correspondante vont dans **le même commit**.

| Modification | Fichier(s) à mettre à jour |
|---|---|
| Nouveau mode de jeu | `docs/architecture.md` §3-4 + `hub.js` (`modeNeonMapping`) + `ui/header.js` (`HUB_SLOTS`) + renderer + `modes` (`gameUtils`) + `achievements.js` (`MODES`) + `<option>` de `multi-lobby.html` + regex `mode` des règles |
| Nouveau champ `Profile` / API partagée | `docs/architecture.md` §4 / §7 + migration paresseuse dans `gameUtils.js::initializeProfile()` |
| Nouveau jeu / abréviation / convention d'asset | `gamesDatabase.js` (+ assets) / `abbreviations.js` / `docs/architecture.md` §6 |
| Schéma RTDB, chemin écrit par un client | `docs/multiplayer-architecture.md` §3-4 + `database.rules.json` + `tests/regles.test.mjs`, puis déploiement CLI |
| Donnée personnelle, service tiers, bibliothèque | `privacy.html` (+ `VERSION` de `consentement.js`) ; `JS/vendor/README.md` |
| Mode Geo, mode Enfer | `Python/geo_*.py`, `renderHintGeo`/`cleanupGeo`, README ; `hellMode.js` + `html.gtg-hell` de `tokens.css` |
| Responsive, orientation, tactile | `@media (max-height: 600px)` de la page + `docs/architecture.md` §10-11 ; `AndroidManifest.xml` ; référence `JS/hub.js` |
| App Android, publication, icône | `mobile/README.md` ; `publish_play.py` + `../play-store-publication-guide.md` §13 (compte de service hors dépôt, `../.play-secrets/`) |
| Nouvel anti-pattern | `docs/architecture.md` §11 (ou `multiplayer-architecture.md` §10) |

## VIII. Contexte de Session

- **Dernier focus** : mise en conformité — règles multi durcies et déployées, consentement reCAPTCHA, purge des rooms, auto-hébergement, pages légales ; app 1.0.2 publiée en test fermé, formulaire « Sécurité des données » envoyé.
- **Focus immédiat** : ajouter l'icône `store-screenshots/icon-512.png` à la fiche Play.
