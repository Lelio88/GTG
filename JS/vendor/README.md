# JS/vendor — bibliothèques auto-hébergées

Copies figées des bibliothèques tierces, servies avec le site : le jeu ne contacte
aucun CDN (pas d'adresse IP transmise à un tiers), et l'app Android les a hors ligne.
Ne jamais les modifier à la main : on remplace le fichier entier.

| Fichier | Bibliothèque | Source | Licence | Utilisée par |
|---|---|---|---|---|
| `anime.min.js` | anime.js 3.2.1 | cdnjs (empreinte SRI vérifiée dans `index.html`) | MIT | `index.html` |
| `tone-15.1.22.js` | Tone.js 15.1.22 | `https://esm.sh/tone@15.1.22/es2022/tone.bundle.mjs` | MIT | `hint-renderers.js` (MIDI) |
| `tonejs-midi-2.0.28.js` | @tonejs/midi 2.0.28 | `https://esm.sh/@tonejs/midi@2.0.28/es2022/midi.bundle.mjs` | MIT | `hint-renderers.js` (MIDI) |
| `photo-sphere-viewer-core-5.15.1.js` | @photo-sphere-viewer/core 5.15.1 (three.js inclus) | `https://esm.sh/@photo-sphere-viewer/core@5.15.1/es2022/core.bundle.mjs` | MIT | `hint-renderers.js` (Geo 360°) |
| `photo-sphere-viewer-core-5.15.1.css` | sa feuille de style | `https://esm.sh/@photo-sphere-viewer/core@5.15.1/index.css` | MIT | `hint-renderers.js` |
| `canvas-confetti-1.9.3.js` | canvas-confetti 1.9.3 | `https://esm.sh/canvas-confetti@1.9.3/es2022/canvas-confetti.bundle.mjs` | ISC | `multi/room-entry.js` |

Les bundles esm.sh (`?bundle`) embarquent leurs dépendances : aucun n'importe d'autre
fichier. Les polices vivent à part, dans `Assets/fonts/` (déclarées par `CSS/fonts.css`).

## Mettre à jour

1. Télécharger le nouveau bundle (`curl -s -o <nom>-<version>.js "<url esm.sh>"`) ; la
   version figure dans le nom du fichier.
2. Vérifier qu'il n'importe rien d'extérieur :
   `grep -oE "(from|import)\s*\(?\s*[\"'](/|https?:)" <fichier>` ne doit rien trouver.
3. Changer le chemin dans le module qui l'utilise, supprimer l'ancien fichier, mettre à
   jour ce tableau.
