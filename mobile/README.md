# GTG — App Android (Capacitor)

Empaquetage **Android** de Guess The Game via [Capacitor](https://capacitorjs.com/), pour
produire un **AAB signé** publiable sur le Play Store.

Le code web vanilla de GTG (racine du repo) est **copié tel quel** dans `www/` — **aucun
bundler**, le code source à la racine reste inchangé → le solo `file://` du repo continue de
fonctionner exactement pareil.

> iOS est hors scope (nécessite un Mac + Xcode). Ce dossier ne gère qu'Android.

---

## 📁 Contenu

```
mobile/
├── package.json            # deps Capacitor (npm) — ISOLÉ ici, ne pollue pas la racine
├── capacitor.config.json   # appId=com.lelio88.gtg, appName, webDir=www
├── build-www.mjs           # copie le web (racine → www/) + réécrit les médias vers le CDN
├── www/                    # (généré) dossier embarqué — gitignored
└── android/                # (généré) projet natif — versionné (sauf secrets & build/)
    ├── gtg-upload-key.jks   # (gitignored) clé de signature — À SAUVEGARDER
    ├── keystore.properties  # (gitignored) mots de passe de la clé — À SAUVEGARDER
    └── local.properties     # (gitignored) chemin du SDK Android
```

## 🎯 Stratégie médias : CDN (implémentée)

`Medias/` pèse ~940 Mo → **impossible** à embarquer dans un AAB publiable (limite Play ≈ 200 Mo).
Solution retenue : les 1153 médias sont **déjà servis par GitHub Pages**, donc `build-www.mjs`
**réécrit** tous les chemins `../Medias/…` → `https://lelio88.github.io/GTG/Medias/…`
**uniquement dans `www/`** (le code source à la racine n'est pas modifié).

→ AAB **léger (~9 Mo)** et **fonctionnel**, mais **réseau requis** pour les indices (images,
sons, panoramas 360°). C'est cohérent : l'app a déjà besoin du réseau (Firebase multi + libs CDN
anime.js / Tone.js / Photo Sphere Viewer). GitHub Pages renvoie `Access-Control-Allow-Origin: *`
→ le WebGL du mode Geo fonctionne en cross-origin.

Variante full-offline (sideload uniquement, non publiable) : `GTG_EMBED_MEDIA=1 npm run sync`
embarque les 940 Mo et **garde les chemins relatifs** (pas de réécriture CDN).

---

## 🔨 Builder l'AAB (ligne de commande)

Le build se fait **sans ouvrir Android Studio**, en utilisant le JDK (JBR) et le SDK
qu'Android Studio a installés.

```bash
cd mobile
npm install                       # (une fois) deps Capacitor

# 1. (re)assembler www/ depuis la racine + copier dans le projet natif
npm run sync                      # = node build-www.mjs && cap sync

# 2. builder l'AAB signé
cd android
JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" ./gradlew bundleRelease
```

**AAB produit** : `mobile/android/app/build/outputs/bundle/release/app-release.aab`

> À chaque modif du code web à la racine : relance `npm run sync` avant de rebuilder.
> Pour une nouvelle version sur le store, incrémente `versionCode` (et `versionName`) dans
> `android/app/build.gradle`.

## 🔑 Signature (upload key)

L'AAB est signé par la **clé d'upload** (alias `upload`) stockée dans le dossier caché sibling du
repo **`../.gtg-secrets/upload-keystore.jks`** (hors git). Les identifiants (chemin du `.jks`,
mots de passe, alias) sont lus depuis **`android/key.properties`** (gitignoré) par
`android/app/build.gradle`. La convention (`key.properties` + `.<projet>-secrets/upload-keystore.jks`)
est partagée avec les autres apps du parent (DewDrop, LLMarmite).

> ⚠️ **Sauvegarde le dossier `.gtg-secrets/` + `android/key.properties` hors du repo** (gestionnaire de
> mots de passe, cloud privé…). Avec **Play App Signing** (activé par défaut pour les nouvelles
> apps), Google gère la clé de signature finale ; cette clé d'upload est **réinitialisable** via
> le support si tu la perds — mais autant ne pas avoir à le faire.

## 📤 Uploader en test sur le Play Console

1. [Play Console](https://play.google.com/console) → crée l'application (nom, langue, catégorie).
2. **Tests → Tests internes** → **Créer une version**.
3. Laisse **Play App Signing** activé (recommandé).
4. Dépose `app-release.aab`.
5. Ajoute des testeurs (emails / liste), enregistre, **Envoyer pour examen**.
6. Partage le lien d'inscription au test aux testeurs.

> Premier upload : Google demande de compléter la fiche (politique de confidentialité, contenu,
> classification…) avant publication même en test interne.

---

## 🔄 Orientation & 🎨 Icône

- **Orientation** : l'app se lance en **portrait ET paysage** — `android:screenOrientation="fullUser"` dans
  `android/app/src/main/AndroidManifest.xml` (respecte le verrou d'auto-rotation du téléphone). Le web est
  responsive dans les deux sens via un régime « viewport court » (`@media (max-height: 600px)`) — voir
  `docs/architecture.md` §10-11. (Ancienne valeur `sensorLandscape` = paysage forcé, abandonnée.)
- **Icône du lanceur** : icône adaptative « soleil synthwave » dans `android/app/src/main/res/mipmap-*/`
  (`ic_launcher.png`, `ic_launcher_round.png`, `ic_launcher_foreground.png`, toutes densités) + fond
  `res/values/ic_launcher_background.xml` = `#0A0510`. **Régénération** : script Pillow (soleil radial +
  grille + densités). L'icône **512×512 pour la fiche Play Store** est fournie : `mobile/gtg-play-store-icon-512.png`.
- **Rappel** : toute modif du web (racine) ou de l'icône exige `npm run sync` puis un rebuild `bundleRelease`,
  et un **bump de `versionCode`** dans `android/app/build.gradle` pour ré-uploader sur le Play Store.

## ⚠️ Limites connues (améliorations ultérieures)

- **Réseau requis** : médias (CDN GitHub Pages) + libs (esm.sh/jsdelivr) + multi (Firebase). Pour
  un vrai offline, il faudrait *vendorer* libs + médias (ou Play Asset Delivery).
- **Firebase multi dans la WebView** : Capacitor sert depuis `https://localhost`. Vérifier que
  `localhost` est dans Firebase → Authentication → Settings → Authorized domains.
- **iOS** : nécessite un Mac.
