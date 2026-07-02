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

<!-- PARTIES SUIVANTES AJOUTÉES ICI AU FUR ET À MESURE
     (fiche du store, contenu de l'application, data safety, classification,
     public cible, versions/tests, etc.) -->
