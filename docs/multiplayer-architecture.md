# GTG — Architecture du mode Multijoueur

> Annexe thématique de [`./architecture.md`](./architecture.md). Décrit la stack multi (Firebase RTDB + JS/multi/) qui s'ajoute au solo sans le modifier. Le solo reste 100 % `file://`-compatible ; le multi nécessite une connexion réseau.

## 1. Vue d'ensemble

Le mode multijoueur permet à 2-8 joueurs de jouer en temps réel dans une **room** identifiée par un code à 6 caractères. Chaque joueur entre un **alias éphémère** (non lié à un profil solo). L'**hôte** choisit le mode (1 des 8) et le nombre de manches (10/20/30, extensible). À chaque manche, tous voient le même indice et tentent de trouver en premier. Le scoring est dégressif selon le rang + bonus podium.

Caractéristiques clés :
- **Pas de backend custom** : Firebase Realtime Database (RTDB) + Anonymous Auth.
- **Pas de bundler** : SDK Firebase importé en ESM depuis `gstatic.com/firebasejs/...` (seule ressource tierce du jeu, multi uniquement).
- **Source de vérité** : un noeud `/rooms/{code}` dans RTDB. Tous les clients écoutent en temps réel via `onValue()`.
- **Autorité** : l'hôte d'une room écrit les transitions de manche (`host-engine.js`) ; les autres clients lisent. Les règles RTDB l'imposent au niveau sécurité.

## 2. Diagramme

```
┌─────────────────────────────────────────────────────────────┐
│  Navigateur (connexion requise)                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Entry points                                         │  │
│  │   index.html         → bouton "🎮 Multijoueur"        │  │
│  │   multi-lobby.html   → JS/multi/lobby-entry.js        │  │
│  │   multi-room.html    → JS/multi/room-entry.js         │  │
│  └────────────────────┬──────────────────────────────────┘  │
│                       │                                     │
│  ┌────────────────────▼──────────────────────────────────┐  │
│  │  Stack JS/multi/                                      │  │
│  │   firebase.js       — init SDK, helpers, auth         │  │
│  │   lobby.js          — create/join/leave room          │  │
│  │   host-engine.js    — transitions de manche (hôte)    │  │
│  │   round-client.js   — saisie/feedback (tous joueurs)  │  │
│  │   scoring.js        — calcul rangs/points (pur)       │  │
│  │   scoreboard.js     — sidebar live                    │  │
│  │   url-room.js       — parsing #room=XXX               │  │
│  └────────────────────┬──────────────────────────────────┘  │
│                       │ import (réutilisé du solo)          │
│  ┌────────────────────▼──────────────────────────────────┐  │
│  │  JS/hint-renderers.js  (partagé solo ⇄ multi)         │  │
│  │  JS/gamesDatabase.js   (catalogue commun)             │  │
│  │  JS/gameUtils.js       (checkAnswerValue réutilisé)   │  │
│  └────────────────────┬──────────────────────────────────┘  │
└────────────────────────┼─────────────────────────────────────┘
                         │ WebSocket (Firebase SDK)
   ┌─────────────────────▼─────────────────────────────────┐
   │  Firebase Realtime Database (europe-west1)            │
   │   /rooms/{code}/meta                                  │
   │   /rooms/{code}/players/{uid}                         │
   │   /rooms/{code}/game/...                              │
   │  + Anonymous Auth (uid persistant via IndexedDB)      │
   │  + Security Rules (database.rules.json)               │
   └───────────────────────────────────────────────────────┘
```

## 3. Modèle de données RTDB

```
/rooms/{ROOM_CODE}                  -- code 6 chars, ex: "AB12CD"
  /meta
    hostUid:      "uid-firebase"    -- uid Anonymous Auth
    hostName:     "Alice"
    mode:         "full"            -- 1 des 8 modes
    targetGames:  20                -- extensible via "+5 manches"
    status:       "lobby" | "playing" | "finished" | "cancelled"
    maxPlayers:   8
    createdAt:    <serverTimestamp>

  /players/{uid}
    name:         "Alice"
    joinedAt:     <serverTimestamp>
    connected:    true              -- false via onDisconnect()
    totalScore:   11

  /game
    playedCount:  3                 -- TOUTES les manches (succès + échec)
    pile: [                         -- titres restants à tirer
      "BioShock",
      "Plants vs Zombies",
      ...
    ]
    currentRound:
      roundId:           "r-1735905600000-ab12cd"
      gameTitle:         "BioShock"
      startedAt:         <ts>
      endsAt:            <ts + 30000>  -- ms epoch (Date.now() base)
      firstFinisherUid:  null          -- mis par hôte au 1er hit
      firstFinisherAt:   null
      graceEndsAt:       null          -- mis à <ts+10s> au 1er hit
      revealedAt:        null          -- mis si personne n'a trouvé
      endedAt:           null          -- mis par hôte à la fin
      /results/{uid}
        status:        "searching" | "found" | "abandoned"
        foundAt:       <ts> | null
        hintsUsed:     0..3
        rank:          0 | 1..N
        pointsEarned:  0 | N+3 | N+1 | N-1 | ...
```

**Notes** :
- `pile` est shuffled au démarrage de la partie (`startGame()` dans `lobby.js`).
- Si personne ne trouve dans les 30s → `revealedAt` est posé, le titre est re-pushé dans `pile`, et le jeu peut retomber dès la manche suivante (décision actée).
- `playedCount` incrémente à CHAQUE fin de manche (succès ou échec). La partie se termine quand `playedCount >= targetGames`.

## 4. Règles de sécurité Firebase

Source de vérité : [`database.rules.json`](../database.rules.json), déployé par `npx firebase-tools deploy --only database` (projet `gtg-multi`, cf. `.firebaserc`) et éprouvé par [`tests/regles.test.mjs`](../tests/regles.test.mjs) sur l'émulateur (chaque écriture de `JS/multi/*` et son détournement). **Ne jamais éditer les règles dans la console** : le prochain déploiement les écraserait.

| Chemin | Qui écrit | Contraintes |
|---|---|---|
| `rooms/{code}` | l'hôte (`meta/hostUid`) ; à la création, celui qui s'y inscrit comme hôte ; **n'importe qui pour effacer une room de plus de 24 h** (ou sans `meta`) | code de 6 caractères de `ROOM_CODE_ALPHABET` ; `meta` obligatoire |
| `meta/*` | l'hôte | champs et valeurs bornés (`mode`, `status`, `targetGames`, `timeBonus`…), `createdAt` immuable, aucune clé inconnue |
| `meta/hostUid` | un **joueur de la room**, quand il est vide (reprise d'hôte) | le joueur ne peut s'y inscrire que lui-même |
| `players/{uid}` | le joueur lui-même (room existante ; `totalScore` = 0 à l'arrivée, inchangé ensuite) ; l'hôte pour le reste | `name` 1-20, `totalScore` nombre, `color` hexadécimal |
| `game/*` | l'hôte | `pile` de 1000 titres au plus, horodatages numériques, aucune clé inconnue |
| `currentRound/results/{uid}` | le joueur lui-même, s'il est dans la room, tant que la manche n'est ni close ni révélée | `status` searching/found/abandoned ; `rank` et `pointsEarned` réservés à l'hôte |
| `chat/{id}` | un joueur, en création seule, sous son propre `uid` **et son propre pseudo** | `text` 1-200, `color` hexadécimal |

- **Lecture** : une room est lisible par tout compte authentifié qui en connaît le code, même sans la rejoindre ; la liste des rooms n'est lisible que pour la purge (ci-dessous).
- **Purge des rooms > 24 h** (`JS/multi/purge.js`) : à l'ouverture du lobby, le client liste au plus 50 rooms créées avant minuit UTC de la veille puis les efface. Les règles ne comparent `query.endAt` que par **égalité** : elles n'acceptent que cette borne exacte (`now - now % 86400000 - 86400000`), jamais une borne récente.
- **Cascade** : l'écriture accordée à l'hôte au niveau `rooms/{code}` couvre tout ; les autres n'ont d'écriture que sur leurs propres nœuds.
- **Compromis assumés** : (1) la requête de purge renvoie le contenu complet des rooms de plus de 24 h, pas seulement leurs codes — quiconque la reproduit peut les lire avant leur effacement (déclaré dans `privacy.html`) ; (2) les règles ne savent ni limiter un débit ni compter les messages : le chat n'a qu'un frein client de 500 ms, la taille de chaque message restant bornée ; (3) l'hôte est l'autorité de sa room et peut fausser les scores dans les bornes des règles (pas d'arbitre serveur).

## 5. Scoring

Module `JS/multi/scoring.js`. Formule :

```
points = (playerCount - rank + 1) + podiumBonus
podiumBonus = 3 si rank=1, 2 si rank=2, 1 si rank=3, 0 sinon
points = 0 si rank=0 (non trouvé)
```

Exemples vérifiés :

| N joueurs | Rang 1 | Rang 2 | Rang 3 | Rang 4 | Rang 5 | Rang 6 | Rang 7 | Rang 8 |
|-----------|--------|--------|--------|--------|--------|--------|--------|--------|
| 2         | 5      | 3      | —      | —      | —      | —      | —      | —      |
| 4         | 7      | 5      | 4      | 2      | —      | —      | —      | —      |
| 8         | 11     | 9      | 7      | 5      | 4      | 3      | 2      | 1      |

Le module est **pur** (pas d'accès DOM/RTDB) → testable isolément.

## 6. Flux d'une partie multi

```
1. Alice ouvre multi-lobby.html
   → saisit pseudo "Alice", mode "full", 20 manches
   → clic "Créer la room"
   → lobby.js::createRoom() écrit /rooms/AB12CD/meta + players/{aliceUid}
   → onDisconnect programmé pour passer status à "cancelled" si elle ferme
   → redirige vers multi-room.html#room=AB12CD (Alice devient l'hôte)

2. Bob ouvre le lien partagé → multi-room.html#room=AB12CD
   → room-entry.js détecte qu'il n'est pas dans players/{bobUid}
   → prompt pour pseudo, lobby.js::joinRoom() écrit son noeud
   → scoreboard live affiche "Alice 👑" + "Bob"
   → status reste "lobby"

3. Alice clic "Démarrer la partie" (4 joueurs présents)
   → lobby.js::startGame() shuffle gamesDatabase → pile
   → meta.status passe à "playing"
   → room-entry.js détecte status change → switch vers #game-view
   → côté hôte : host-engine.js démarre, tire 1er jeu, écrit currentRound

4. Tous reçoivent l'event currentRound
   → round-client.js appelle renderers[meta.mode](game, 0, contentDiv)
   → Bob trouve en 8s → écrit results/bobUid: {status:"found", foundAt:ts}
   → host-engine détecte → écrit firstFinisherUid + graceEndsAt = now+10s
   → scoreboard met à jour "✅ Bob" en live

5. Pendant les 10s de grace :
   → Carol trouve → results/carolUid status=found
   → David abandonne → results/davidUid status=abandoned
   → Alice ne fait rien
   → host-engine détecte "tous done OU graceEndsAt atteint"
   → finalizeRound : calcule ranks (Bob=1, Carol=2, Alice=0, David=0)
   →                 pointsEarned : Bob=11, Carol=9, Alice=0, David=0
   →                 update totalScore via transaction
   →                 playedCount++
   →                 (pause UX 2.2s)
   →                 startNextRound → nouveau currentRound

6. Si personne ne trouve dans les 30s :
   → host-engine détecte endsAt atteint, firstFinisherUid null
   → revealedAt posé → round-client affiche "Personne n'a trouvé. Réponse : BioShock"
   → titre re-pushé dans pile (peut retomber)
   → playedCount++ (l'échec compte)

7. À tout moment, Alice peut cliquer "+5 manches"
   → extendTargetGames() update meta.targetGames

8. Quand playedCount >= targetGames :
   → host-engine écrit meta.status = "finished"
   → switch vers #results-view, classement final affiché
   → Alice voit "Prolonger (+5 manches)" → relance la partie
```

## 7. Modules — responsabilités

| Module | Rôle | Qui l'exécute |
|---|---|---|
| `firebase.js` | Init SDK, auth anonymous, helpers (`ref`, `update`, `onValue`, `genRoomCode`) | Tous |
| `url-room.js` | Lecture/écriture du code dans `window.location.hash` | Tous |
| `lobby.js` | `createRoom`, `joinRoom`, `leaveRoom`, `startGame`, `listenLobby`, `programDisconnectCleanup` | Tous |
| `host-engine.js` | Boucle de transitions de manche : tirage, surveillance deadlines (30s + grace 10s), `finalizeRound`, scoring, fin de partie | Hôte uniquement |
| `round-client.js` | Render via `hint-renderers.js`, capture saisie, soumission `found`/`abandoned`, countdown affichage | Tous |
| `scoring.js` | `computeRoundPoints(rank, N)`, `computeRanksFromResults(results, N)` (pures) | Hôte (calcul) |
| `scoreboard.js` | Sidebar live : pseudo + score + statut manche (🔍 / ✅ / 🏳️) | Tous |
| `lobby-entry.js` | Entry point `HTML/multi-lobby.html` | Tous |
| `room-entry.js` | Entry point `HTML/multi-room.html`, routing entre vues lobby/game/results | Tous |

## 8. Cycle de vie d'une room

```
            ┌──────────────────┐
            │  createRoom()    │
            │  → status=lobby  │
            └─────────┬────────┘
                      │
       ┌──────────────┴────────────────┐
       │                                │
       ▼                                ▼
  joinRoom() ←──────┐         hôte clic "Démarrer"
                    │                   │
                    │                   ▼
                    │         ┌──────────────────┐
                    │         │  startGame()     │
                    │         │  → status=playing│
                    │         │  → pile shuffled │
                    │         └─────────┬────────┘
                    │                   │
                    │                   ▼
                    │         ┌──────────────────────────────┐
                    │         │  host-engine boucle :         │
                    │         │    startNextRound             │
                    │         │  → currentRound écrit         │
                    │         │  → results s'accumulent       │
                    │         │  → finalizeRound (timeout/    │
                    │         │     grace/all-done)           │
                    │         │  → playedCount++              │
                    │         └─────────┬────────────────────┘
                    │                   │
                    │       playedCount >= targetGames ?
                    │           │           │
                    │          non         oui
                    │           │           ▼
                    │           └→ tour suivant
                    │                       │
                    │                       ▼
                    │             ┌──────────────────┐
                    │             │ status=finished  │
                    │             └─────────┬────────┘
                    │                       │
                    │       hôte clic "Prolonger" → status=playing
                    │                       │
                    │                       ▼
                    │                  retour boucle
                    │
                    │   OU à tout moment :
                    │       hôte ferme onglet
                    │       → onDisconnect vide meta.hostUid
                    │       → un joueur restant reprend l'hôte (transaction)
                    └──────────────────────────────────────────────┘
```

## 9. Patterns imposés

- **Pas d'écriture client dans `/game/*` sauf hôte** : les règles RTDB le bloquent. Si tu touches au schéma de transition, ajuste **aussi** `database.rules.json`.
- **`onDisconnect()` programmé à la jointure** : nettoyage auto à la fermeture d'onglet, pas besoin de heartbeat custom.
- **Timestamps absolus pour les deadlines** : `endsAt` et `graceEndsAt` sont des `Date.now() + Δ` ; tous les clients comparent à leur `Date.now()` local. La dérive d'horloge est négligeable sur 30s.
- **Re-render complet à chaque manche** : les renderers de `JS/hint-renderers.js` vident le container — pas de mutation incrémentielle (simplicité > finesse animation).
- **Anti-XSS** : pseudo échappé via `escapeHtml()`, nombres (`totalScore`, `targetGames`, `playedCount`) forcés par `Number()` avant injection (cf. `scoreboard.js`, `room-entry.js`) : un client modifié peut écrire n'importe quel type que les règles laisseraient passer.
- **Fin de vie d'une room** : aucune n'est supprimée à la fin d'une partie ; toutes le sont par la purge des rooms de plus de 24 h (`purge.js`), déclarée dans `privacy.html`.
- **`firebaseConfig` n'est PAS un secret** : c'est l'identifiant public du projet, lisible dans n'importe quel navigateur. La sécurité passe par les rules RTDB, pas par cacher l'`apiKey`.

## 10. Anti-patterns à éviter

- ❌ **Écrire dans `players/{uid}/totalScore` côté client** sans transaction `runTransaction` — sources de races sur les écritures concurrentes.
- ❌ **Réimplémenter le tirage du jeu suivant côté round-client** — c'est le boulot exclusif de `host-engine.js`.
- ❌ **Stocker le profil solo dans une room** — `localStorage['profiles']` est intouché, les alias multi sont éphémères. Pas de pollution croisée.
- ❌ **Ajouter un mode de jeu sans entrée `<option>` dans `HTML/multi-lobby.html`** — il sera invisible des hôtes.
- ❌ **Polluer la stack solo avec des imports Firebase** — `JS/multi/*` est isolé pour garder le solo `file://`-compatible.
- ❌ **Logger l'`apiKey` ou des données joueurs** dans console — l'`apiKey` est publique mais les pseudos peuvent être sensibles.
- ❌ **Charger App Check / reCAPTCHA avant `obtenirConsentement()`** — traceurs Google soumis au consentement (cf. §13.5).
- ❌ **Comparer `query.endAt` / `startAt` avec `<`, `>`** dans les règles — seule l'égalité fonctionne, la requête serait refusée.

## 11. Coût Firebase (gratuit en pratique)

Free tier (plan Spark) : 100 connexions simultanées, 1 Go stockage, 10 Go/mois transfert.

Estimation pour une partie de 8 joueurs × 20 manches :
- 8 connexions WebSocket simultanées (~12 min).
- ~50 écritures (lobby, transitions, results) × 200 octets = 10 Ko écrits.
- ~3 Mo lus (events temps réel × 8 clients).

Une partie ≈ 0.03 % du quota mensuel. Tu peux faire ~3000 parties par mois avant de payer.

## 12. Setup initial (référence)

Console Firebase → projet `gtg-multi` :
1. **Realtime Database** activée en région `europe-west1`.
2. **Authentication → Sign-in method → Anonyme** : activé.
3. **Realtime Database → Rules** : règles posées (cf. §4).
4. **Project Settings → General → Vos applications** : app web "GTG Web" enregistrée.
5. La config (apiKey, databaseURL, etc.) est dans `JS/multi/firebase.js`.

## 13.5 App Check (anti-bot / anti-spam)

App Check protège les services Firebase (RTDB en l'occurrence) en attachant un token d'attestation à chaque requête. Sans token valide → Firebase rejette. Le provider utilisé côté web est **reCAPTCHA v3** (gratuit, invisible pour l'utilisateur — pas de "click on traffic lights").

### Activation côté Google reCAPTCHA

1. Aller sur **https://www.google.com/recaptcha/admin/create**
2. Label : `gtg-app-check`
3. Type : **reCAPTCHA v3**
4. Domaines :
   - `lelio88.github.io`
   - `localhost`
5. Accepter les termes → Submit
6. Récupérer la **Site key** (publique, va dans le code) et la **Secret key** (privée, va dans Firebase)

### Activation côté Firebase

1. Console Firebase → **App Check** (menu Build)
2. Onglet **Apps** → enregistrer l'app web `GTG Web` avec le provider **reCAPTCHA v3** + coller la **Secret key**
3. Onglet **Services** → **Realtime Database** → **NE PAS** activer Enforce immédiatement (mode monitoring d'abord pour voir si du trafic légitime est bloqué)
4. Une fois les métriques OK (quelques heures de monitoring), activer **Enforce**

### Activation côté code

Dans `JS/multi/firebase.js`, coller la **Site key** dans la constante `RECAPTCHA_SITE_KEY`. L'import du SDK App Check est dynamique → tant que la clé est vide, le SDK n'est pas chargé, l'app marche normalement (sans la protection).

### Consentement

reCAPTCHA dépose des traceurs de Google : la CNIL les soumet au consentement. `firebase.js` attend `obtenirConsentement()` (`JS/multi/consentement.js`) avant d'initialiser App Check ; un refus renvoie à l'accueil et bloque tous les modules multi (pas de multi sans accord). L'accord (date, version du texte, portée) est gardé dans `localStorage['gtg_multi_consentement']`, expire au bout de 6 mois, et se retire depuis le lobby ou `privacy.html`. Changer le texte d'accord impose d'incrémenter `VERSION`.

### Comportement

- Chaque requête RTDB embarque un token App Check signé par reCAPTCHA
- Token rafraîchi automatiquement (`isTokenAutoRefreshEnabled: true`)
- Les requêtes faites par des navigateurs réels avec un score reCAPTCHA > seuil passent
- Les bots Selenium/Puppeteer/curl sans le SDK chargé sont bloqués

### Coût / quotas

reCAPTCHA v3 est gratuit jusqu'à **1 million d'évaluations par mois**. App Check Firebase est gratuit également. À l'échelle d'un projet perso, on est largement dans le free tier.

### Troubleshooting — 403 `API_KEY_SERVICE_BLOCKED` à `exchangeRecaptchaV3Token`

**Symptôme** : la console navigateur affiche `@firebase/app-check: Requests throttled due to 403 error`, et le corps de la réponse contient `"reason": "API_KEY_SERVICE_BLOCKED"` / `"status": "PERMISSION_DENIED"`.

**Ce n'est PAS un problème reCAPTCHA** (la clé, le secret, les domaines et l'App ID peuvent être parfaits) : la **clé API Firebase « navigateur »** (`firebaseConfig.apiKey`) a une **restriction d'API** qui n'inclut pas `firebaseappcheck.googleapis.com`. L'échange du token App Check est donc bloqué au niveau de la clé GCP. C'était la cause racine de l'impasse de 2 jours documentée en issue #44.

**Fix (console GCP, projet `gtg-multi`)** :
1. Activer l'API : [console.cloud.google.com/apis/library/firebaseappcheck.googleapis.com](https://console.cloud.google.com/apis/library/firebaseappcheck.googleapis.com?project=gtg-multi).
2. APIs & Services → Credentials → clé « Browser key (auto created by Firebase) » → **Restrictions relatives aux API** → ajouter « Firebase App Check API » à la liste (sans retirer les autres APIs), ou passer à « Ne pas restreindre la clé ». La clé est publique de toute façon — la sécurité vient d'App Check + des règles RTDB, pas de cette restriction.

**Re-test** : attendre ~5 min (propagation GCP), puis tester en **navigation privée neuve** — le 403 est mémorisé en throttle **24 h** par navigateur (IndexedDB), donc un onglet déjà throttlé ne renverra plus de requête. `exchangeRecaptchaV3Token` doit alors renvoyer **200**.

## 14. Pistes d'évolution

- **Firebase Cloud Function** pour valider les réponses côté serveur (anti-triche) — actuellement le client se fie à `checkAnswerValue` local.
- **Historique des parties** : enregistrer le classement final dans un noeud `/leaderboards/` + UI dédiée.
- **Reconnexion** : un joueur qui fait F5 garde son uid (token Firebase persistant en IndexedDB) — peut techniquement rejoindre la room en cours. À tester et stabiliser.
