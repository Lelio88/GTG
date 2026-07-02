/**
 * build-www.mjs — Assemble le dossier `www/` embarqué par Capacitor à partir
 * du code vanilla de GTG (racine du repo), SANS bundler ni transformation.
 *
 * POURQUOI : Capacitor copie le `webDir` tel quel dans l'app Android. On ne
 * peut pas pointer `webDir` sur la racine du repo (elle contient node_modules/,
 * Python/, .git/, docs/...). On recopie donc uniquement les fichiers web dans
 * `mobile/www/`. Le code source à la racine reste INCHANGÉ → le solo `file://`
 * du repo continue de marcher exactement pareil.
 *
 * MÉDIAS : `Medias/` pèse ~940 Mo → non embarqué par défaut (APK non
 * publiable au-delà de ~200 Mo). Pose GTG_EMBED_MEDIA=1 pour un build
 * full-offline destiné au sideload/test.
 *
 * Usage :
 *   node build-www.mjs                 # code + UI (léger)
 *   GTG_EMBED_MEDIA=1 node build-www.mjs   # + Medias (940 Mo, sideload)
 */
import { existsSync, rmSync, mkdirSync, cpSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, extname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const WWW = join(HERE, 'www');

// Fichiers/dossiers web strictement nécessaires à l'app (pas de docs/Python/git).
const WEB_ENTRIES = ['index.html', 'HTML', 'JS', 'CSS', 'Assets'];
const EMBED_MEDIA = process.env.GTG_EMBED_MEDIA === '1';
// Base CDN pour les médias non embarqués (GitHub Pages sert déjà Medias/).
const MEDIA_BASE = process.env.GTG_MEDIA_BASE || 'https://lelio88.github.io/GTG/Medias/';
// Tous les chemins médias du code sont littéraux `../Medias/` (1362 occurrences).
const MEDIA_REF = '../Medias/';

/** Réécrit `../Medias/` -> CDN dans les .js/.html de www/ (source repo intacte). */
function rewriteMediaToCdn(dir) {
  let count = 0;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, name.name);
    if (name.isDirectory()) {
      count += rewriteMediaToCdn(full);
    } else if (['.js', '.html'].includes(extname(name.name))) {
      const src = readFileSync(full, 'utf8');
      if (src.includes(MEDIA_REF)) {
        writeFileSync(full, src.split(MEDIA_REF).join(MEDIA_BASE), 'utf8');
        count++;
      }
    }
  }
  return count;
}

function copyInto(name) {
  const src = join(ROOT, name);
  if (!existsSync(src)) {
    console.warn(`  ! absent, ignoré : ${name}`);
    return;
  }
  cpSync(src, join(WWW, name), { recursive: true });
  console.log(`  + ${name}`);
}

console.log(`Assemblage de www/ depuis ${ROOT}`);
rmSync(WWW, { recursive: true, force: true });
mkdirSync(WWW, { recursive: true });

for (const entry of WEB_ENTRIES) copyInto(entry);

if (EMBED_MEDIA) {
  console.log('  (GTG_EMBED_MEDIA=1) embarquement de Medias/ — peut être long…');
  copyInto('Medias');
  console.log('  Chemins médias laissés en relatif (../Medias/) → offline local.');
} else {
  const n = rewriteMediaToCdn(WWW);
  console.log(`  Medias/ NON embarqué → chemins réécrits vers le CDN dans ${n} fichier(s)`);
  console.log(`    ${MEDIA_REF}  ->  ${MEDIA_BASE}`);
}

const size = existsSync(join(WWW, 'index.html'))
  ? 'ok'
  : 'ERREUR: index.html manquant';
console.log(`Terminé → ${WWW} (${size})`);
