# Publication Play Store — questionnaire & réponses (GTG)

> **Référence vivante.** Recense chaque question posée par la Google Play Console
> lors de la publication de GTG, avec la **réponse canonique** à donner. But :
> qu'une prochaine session puisse remplir le formulaire **directement**, sans
> redemander.
>
> Complété au fur et à mesure (l'utilisateur fournit les questions par parties).
> Légende : ✅ = case à cocher obligatoire pour continuer.

## Constantes du projet (rappel)

| Clé | Valeur |
|---|---|
| Nom de l'application | Guess The Game |
| Nom du package (`applicationId`) | `com.lelio88.gtg` |
| Type | Jeu, gratuit |
| Langue par défaut | Français (France) — `fr-FR` |
| Signature | clé d'upload `.gtg-secrets/upload-keystore.jks`, Play App Signing (cf. `mobile/README.md`) |
| AAB | `mobile/android/app/build/outputs/bundle/release/app-release.aab` |
| E-mail de contact (store / légal) | `heianenterpriseyt@gmail.com` |

---

## 1. Créer une application

### Informations sur l'application

| Question | Réponse GTG |
|---|---|
| Nom de l'application | **Guess The Game** |
| Nom du package | **com.lelio88.gtg** |
| Langue par défaut | **Français (France) – fr-FR** |
| Application ou Jeu | **Jeu** |
| Application gratuite ou payante | **Sans frais** (gratuit) |

> ⚠️ Le **nom du package** est **définitif** après création (jamais modifiable).
> Un jeu **gratuit** ne pourra **jamais** devenir payant ensuite (l'inverse est possible).

### Déclarations

| Case à cocher | Action |
|---|---|
| Confirmer que l'application respecte le Règlement du programme pour les développeurs | ✅ **Cocher** |
| Accepter les lois américaines sur l'exportation | ✅ **Cocher** |

---

## 2. Règles de confidentialité

| Question | Réponse GTG |
|---|---|
| URL des règles de confidentialité | **https://lelio88.github.io/GTG/privacy.html** |

> Page `privacy.html` à la racine du repo, servie par **GitHub Pages** (depuis `main`).
> Contenu : GTG ne collecte aucune donnée perso — solo 100 % local, multi = Firebase
> anonyme, aucune pub/pistage. Contact : `heianenterpriseyt@gmail.com` (modifiable dans la page).

---

## 3. Informations de connexion (App access)

| Question | Réponse GTG |
|---|---|
| Une partie de votre appli est-elle limitée ? | **Non** (aucune section limitée) |

> **Pourquoi Non** : aucune connexion à un compte requise. Le multijoueur utilise Firebase
> **Auth anonyme** (automatique, transparente) — l'utilisateur ne saisit **aucun identifiant**
> (e-mail, nom d'utilisateur, Google/SSO), il tape juste un pseudo → ne compte PAS comme
> « informations de connexion ». Aucun paiement, parrainage/QR, code 2FA, biométrie, ni action
> cross-device. → **Pas d'identifiants de test** à fournir aux examinateurs.

---

## 4. Annonces

| Question | Réponse GTG |
|---|---|
| Votre application contient-elle des annonces ? | **Non, mon application ne contient pas d'annonces** |

> GTG n'intègre aucun SDK publicitaire ni régie. Cohérent avec la politique de confidentialité
> (« aucune publicité »). Évite le libellé « Contient des annonces » sur la fiche Play.

---

## 5. Classification du contenu (questionnaire IARC)

| Question | Réponse GTG |
|---|---|
| Adresse e-mail | **heianenterpriseyt@gmail.com** |
| Catégorie | **Jeu** |
| Conditions d'utilisation IARC | ✅ **Accepter** |

> Après cet écran, l'IARC pose un **questionnaire détaillé** (voir partie 6). ⚠️ GTG montre des
> captures/sons de jeux **matures** (violence/horreur) et a un **chat** en multi → classification
> attendue **PEGI 12-16 / Teen** (PAS 3+).

---

## 6. Classification du contenu — questionnaire IARC détaillé (catégorie Jeu)

| Question | Réponse |
|---|---|
| Violence, sang ou images sanglantes | **Oui** |
| Peur (images/sons effrayants) | **Oui** |
| Sexualité / aguichage / rencontres | **Non** *(vérifié : Witcher/GTA/MK = persos habillés, aucune scène sexuelle ni nudité)* |
| Jeux d'argent (réels ou simulés) | **Non** |
| Langage grossier | **Non** *(chat = contenu utilisateur, exclu)* |
| Substances réglementées (drogue/alcool/tabac) | **Non** |
| Humour grossier (éructations/flatulences/vomi) | **Non** |
| Achats numériques / récompenses / NFT | **Non** |
| Interaction utilisateurs (voix/texte/images) | **Oui** *(chat de room en multi)* |
| Partage de la localisation précise | **Non** |
| Symboles nazis (loi allemande) | **Non** *(vérifié : CoD & Battlefield = guerre moderne, aucune croix gammée)* |
| Identité nationale (Corée) | **Non** |
| Apologie du terrorisme | **Non** |
| Actes/techniques criminels réalistes | **Non** |

> **Pourquoi violence/peur = Oui** : le catalogue (150 jeux) affiche des captures/sons de jeux
> matures (Mortal Kombat, Doom, Resident Evil, Outlast, God of War, The Last of Us, GTA…) →
> violence + horreur à l'écran (combat, armes, monstres — **pas de gore explicite** dans les
> captures). **Interaction = Oui** : le multi a un chat de groupe
> (`JS/multi/chat.js`, filtre d'insultes, pas de voix/images). → Classification attendue
> **PEGI 12** (violence sans gore). Sous-déclarer = risque de retrait.
>
> **Sous-cases « Violence »** (écran après « Oui ») : ✅ contre l'homme · ✅ contre non-humains
> (Doom, God of War, RE, Metro, Witcher) · ❌ images dérangeantes/sanglantes · ❌ sang hors acte
> — vérifié sur ~10 captures (God of War, Mortal Kombat, Doom, Outlast, RE, Last of Us) : aucun
> sang/gore explicite affiché.
>
> ⚠️ **Impact Data safety** : le chat = contenu généré par les utilisateurs (texte stocké dans
> Firebase RTDB) → à déclarer dans la section Sécurité des données + éventuelle modération.

---

### 6.1 Sous-questionnaire — Violence envers les êtres humains

| Question | Réponse |
|---|---|
| Cadre de la violence | **Réaliste** (GTA crime, CoD & Battlefield guerre) |
| Style pixellisé ou enfantin | **Non** (rendu HD réaliste) |
| Réactions face à la violence | **Réaliste** |
| Comment la violence est présentée | ☑️ Rares en plan éloigné · ☑️ Rares en plan rapproché |
| Importance du sang | **Aucune** (pas de sang sur les humains) |
| Contexte réel/historique de guerre | **Oui** (CoD moderne, Battlefield WWI) |
| Innocents/sans défense gravement blessés ou tués | **Non** (pas de gameplay violent — jeu de devinette) |
| Sons féroces / persos sinistres / tons sombres | **Oui** (Outlast, Doom, RE, esthétique sombre) |

> Vérifié sur captures : CoD (militaire réaliste, tanks), GTA (fusillade en voiture, style BD),
> Battlefield (WWI, fusil FPS), + fantasy (God of War, Doom, Mortal Kombat). Violence humaine =
> armes/combat/guerre **sans sang affiché**. ⚠️ Le sang apparaît sur des **non-humains** (zombies
> Red Dead ensanglantés) → à déclarer dans la section « Violence envers non-humains ».

---

### 6.2 Sous-questionnaire — Violence envers les êtres non humains

| Question | Réponse |
|---|---|
| Cadre de la violence | **Fantastique** (démons, zombies, monstres, créatures) |
| Style pixellisé ou enfantin | **Non** |
| Réactions face à la violence | **Irréaliste** |
| Comment la violence est présentée | ☑️ Rares en plan éloigné · ☑️ Rares en plan rapproché |
| Importance du sang | **Modéré/limité** (zombies/créatures ensanglantés, occasionnel) |
| Créatures se comportant comme des humains | **Oui** (zombies Red Dead/RE, infectés Last of Us = humains réanimés) |
| Violence impliquant des animaux réels | **Non** (créatures fantastiques uniquement) |
| Sons féroces / persos sinistres / tons sombres | **Oui** |

> Différences vs section humains : cadre **Fantastique** (pas réaliste), sang **Modéré/limité**
> (zombies gore) au lieu d'Aucune. Créatures human-like = Oui (les zombies sont d'anciens humains).

---

### 6.3 Sous-questionnaire — Peur

| Question | Réponse |
|---|---|
| Éléments inclus | ☑️ **Effrayants** + ☑️ **Horrifiants** |
| Fréquence des éléments effrayants | **Rare** |
| Fréquence des éléments horrifiants | **Rare** |

> Effrayants : ambiances sombres, mode Shadow, démons Doom, tension. Horrifiants : Outlast
> (survival horror), Resident Evil, démons grotesques, zombies ensanglantés → contenu horreur
> assumé. Cocher « horrifiants » porte probablement l'axe peur à **PEGI 16** (sinon « effrayants »
> seul ≈ 12). Choix retenu : les deux (honnête vu Outlast/RE).

---

### 6.4 Sous-questionnaire — Interaction / chat (suivi du « Oui »)

| Question | Réponse |
|---|---|
| Possibilité de **bloquer** des utilisateurs/contenu | **Non** (pas de blocage ; l'hôte peut kicker, ≠ blocage) |
| Possibilité de **signaler** des utilisateurs/contenu | **Non** (le report existant = bugs → GitHub) |
| **Modération** des conversations | **Oui** (filtre anti-grossièretés `censor()` dans `JS/multi/chat.js`, client-side) |
| Interactions limitées aux **amis invités** uniquement | **Oui** (rooms sur lien privé, pas de matchmaking public) |

> Le chat = texte uniquement (pas de voix ni d'images). Modération Oui + invité-uniquement Oui
> compensent l'absence de blocage/signalement. Impact **Data safety** : messages de chat = texte
> utilisateur stocké dans Firebase RTDB (`/rooms/{code}/chat`) → à déclarer.

---

## 7. Public cible et contenu

| Question | Réponse |
|---|---|
| Tranches d'âge cibles | **13-15 · 16-17 · 18+** (13+ ; < 13 verrouillé car ESRB Teen) |

> ESRB = **Adolescent (Teen)** confirmé. Cibler 13-17 = public réel mais déclenche des contrôles
> « public mixte » + éventuelle déclaration « normes de sécurité des enfants » (cf. `child-safety.html`
> de DewDrop). Option simplifiée : **18+ uniquement** (évite ces contrôles mais sous-représente le public).
> Décision utilisateur à confirmer.

---

## 8. Sécurité des données (Data safety)

| Question | Réponse |
|---|---|
| L'appli collecte/partage-t-elle des données utilisateur ? | **Oui** (uniquement en multijoueur) |
| Toutes les données chiffrées en transit ? | **Oui** (TLS/HTTPS Firebase) |
| Méthodes de création de compte | **Aucune** → « Mon appli ne permet pas aux utilisateurs de créer un compte » (auth anonyme ; pseudo = nom d'affichage) |
| Connexion via comptes externes | **Non** (pas de Google Sign-In / SSO) |
| Moyen de demander la suppression des données | **Non** ⚠️ — `onDisconnect()` retire la présence live, mais chat/room orphelins persistent (pas de TTL implémenté dans le repo, pas de bouton « supprimer »). Données anonymes/minimales → acceptable. *Amélioration possible : cleanup auto → option « supprimées sous 90 jours ».* |

> Solo = aucune collecte (`localStorage` local). Multi (Firebase RTDB) transmet : **pseudo** (alias),
> **messages de chat** (texte), **données de partie** (scores/statuts), + **UID anonyme** Firebase.
> Aucune PII réelle (pas de nom réel/email/tél/localisation/finance/photos/contacts). Chiffré en
> transit (HTTPS/TLS). Collecte **optionnelle** (multi only).
>
> Types à déclarer : Messages (chat) · App activity (parties) · Device/other IDs (UID anonyme).
> Tout le reste = non collecté.

### 8.1 Types de données collectées (matrice)

**À cocher (4 seulement)** :
| Catégorie | Sous-type | Source GTG |
|---|---|---|
| Messages | Autres messages via une appli | chat multi |
| Activité dans les applis | Interactions avec l'appli | scores, statuts, mode |
| Activité dans les applis | Autre contenu généré par l'utilisateur | pseudo (alias) |
| Appareil ou autres ID | Appareil ou autres ID | UID anonyme Firebase |

**Tout le reste = NON coché** : Emplacement, Informations personnelles (Nom/e-mail/ID/adresse/tél/
origines/convictions/orientation/autres), Infos financières, Santé, Photos/vidéos, Fichiers audio,
Fichiers/documents, Agenda, Contacts, (Activité : recherche/applis installées/autres actions),
Navigation Web, Infos et performance (pas de Crashlytics/Analytics).

> Pseudo classé en « contenu généré par l'utilisateur » (alias éphémère, pas une vraie identité ;
> alternative acceptable = Personal info → Nom). Rien en « partagé avec des tiers » (Firebase = infra).

### 8.2 Utilisation et traitement — pour CHAQUE type de donnée

**Collectées / Partagées ?** → **Collectées uniquement** (les 4 types). Jamais « Partagées » :
Firebase = infra/sous-traitant (exclu de « partage »), pas de SDK pub/analytics, chat = fonction
utilisateur↔utilisateur (pas un tiers).

Réponses transverses (à répéter pour chaque type) :
- Collectées ✅ / Partagées ❌
- Traitées de façon éphémère ? → **Non** (stocké dans la room Firebase, pas juste en mémoire)
- Obligatoire ou optionnelle ? → **Optionnelle** (collecte uniquement si on joue en multi)
- Finalité → **Fonctionnement de l'application** UNIQUEMENT (Google n'a PAS de finalité
  « communication »). Pas d'analyse, pub/marketing, personnalisation, gestion de comptes,
  prévention fraude ni comms développeur.

---

## 9. Applis gouvernementales

| Question | Réponse |
|---|---|
| App développée par/pour un organisme public ? | **Non** (jeu personnel) |

---

<!-- PARTIES SUIVANTES AJOUTÉES ICI AU FUR ET À MESURE
     (fiche du store, contenu de l'application, data safety, classification,
     public cible, versions/tests, etc.) -->
