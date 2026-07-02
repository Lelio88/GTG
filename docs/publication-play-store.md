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

> Après cet écran, l'IARC pose un **questionnaire détaillé** (violence, contenu sexuel, langage,
> substances, jeux d'argent, interactivité/partage) qui génère la classe d'âge. GTG = devinette
> sans violence/sexe/argent réel → classification très basse attendue (**PEGI 3 / ESRB E**).
> Réponses détaillées à compléter ici quand elles seront fournies.

---

<!-- PARTIES SUIVANTES AJOUTÉES ICI AU FUR ET À MESURE
     (fiche du store, contenu de l'application, data safety, classification,
     public cible, versions/tests, etc.) -->
