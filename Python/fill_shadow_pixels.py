"""
Python/fill_shadow_pixels.py — Generation automatique des fichiers Shadow + Pixels

Les renderers Shadow et Pixelated du jeu (cote CSS/JS) appliquent deja les
transformations visuelles (filter brightness 0 pour Shadow, canvas downsampling
pour Pixels). Donc on n'a pas besoin de generer une silhouette ou une image
pre-pixelisee : il suffit de **copier l'image source** du jeu (Medias/Image/
<Title> 1.jpg) vers Medias/Shadow/<Title>.png et Medias/Pixels/<Title>.png
(avec conversion JPG -> PNG via Pillow).

Resultat : les 8 fichiers manquants en Shadow + les 8 manquants en Pixels sont
combles en quelques secondes.

Pour un rendu Shadow plus propre (silhouette pre-rendue type 'guess the
silhouette'), on pourrait etendre avec un --process plus tard. La version
copy simple convient pour MVP.

Prerequis :
    pip install pillow

Usage :
    cd Python && python fill_shadow_pixels.py
    cd Python && python fill_shadow_pixels.py --dry-run
    cd Python && python fill_shadow_pixels.py --only Shadow
"""

import re
import sys
import argparse
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("ERREUR : Pillow n'est pas installe. Lance : pip install pillow", file=sys.stderr)
    sys.exit(1)

REPO_ROOT = Path(__file__).resolve().parent.parent
GAMES_DB_PATH = REPO_ROOT / 'JS' / 'gamesDatabase.js'

# Regex JS-aware (gere les apostrophes echappees) — reprise de check_assets.py
STRING_TOKEN = r"""(?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)")"""
TITLE_PATTERN = re.compile(r"title\s*:\s*" + STRING_TOKEN)
STRING_PATTERN = re.compile(STRING_TOKEN)


def js_unescape(raw):
    if raw is None:
        return None
    out = []
    i = 0
    while i < len(raw):
        if raw[i] == '\\' and i + 1 < len(raw):
            c = raw[i + 1]
            mapping = {"'": "'", '"': '"', '\\': '\\', 'n': '\n', 't': '\t', 'r': '\r', '/': '/'}
            out.append(mapping.get(c, c))
            i += 2
        else:
            out.append(raw[i])
            i += 1
    return ''.join(out)


def get_captured_string(match):
    raw = match.group(1) if match.group(1) is not None else match.group(2)
    return js_unescape(raw)


def parse_games(text):
    title_matches = list(TITLE_PATTERN.finditer(text))
    games = []
    for i, m in enumerate(title_matches):
        title = get_captured_string(m)
        start = m.end()
        end = title_matches[i + 1].start() if i + 1 < len(title_matches) else len(text)
        chunk = text[start:end]
        paths = []
        for sm in STRING_PATTERN.finditer(chunk):
            s = get_captured_string(sm)
            if s and s.startswith('../Medias/'):
                paths.append(s)
        games.append({'title': title, 'paths': paths})
    return games


def find_missing(games, type_name):
    """Liste les jeux dont le fichier Medias/<type_name>/<Title>.png manque.
    Renvoie aussi l'objet game complet pour pouvoir retrouver l'image source."""
    missing = []
    for game in games:
        type_paths = [p for p in game['paths'] if f'/{type_name}/' in p]
        if not type_paths:
            continue
        for path in type_paths:
            abs_path = REPO_ROOT / path.replace('../', '', 1)
            if not abs_path.exists():
                missing.append({
                    'title': game['title'],
                    'expected_path': abs_path,
                    'game': game,
                })
    return missing


def find_source_image(game):
    """Cherche une image source EXISTANTE en s'appuyant sur les paths
    declares dans game.paths (cas des titres avec ':' ou autres caracteres
    interdits Windows : le fichier sur disque est sanitise, le path declare
    pointe vers le bon nom)."""
    image_paths = [p for p in game.get('paths', []) if '/Image/' in p]
    for path in image_paths:
        abs_path = REPO_ROOT / path.replace('../', '', 1)
        if abs_path.exists():
            return abs_path
    return None


def copy_as_png(src_path, dest_path):
    """Convertit n'importe quel format image en PNG et sauvegarde a destination."""
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    img = Image.open(src_path)
    # PNG supporte RGB et RGBA — on convertit si necessaire
    if img.mode not in ('RGBA', 'RGB'):
        img = img.convert('RGB')
    img.save(dest_path, 'PNG')


def process_type(type_name, games, dry_run=False):
    """Traite tous les fichiers manquants pour un type donne (Shadow ou Pixels)."""
    missing = find_missing(games, type_name)
    if not missing:
        print(f'[{type_name}] Aucun fichier manquant.')
        return 0, 0

    print(f'[{type_name}] {len(missing)} fichier(s) a generer :')
    success = 0
    errors = 0
    for entry in missing:
        title = entry['title']
        dest = entry['expected_path']
        src = find_source_image(entry['game'])
        if src is None:
            print(f'  [SKIP] {title:40s} -> image source introuvable')
            errors += 1
            continue
        if dry_run:
            print(f'  [DRY]  {title:40s} -> {src.name} (source OK)')
            continue
        try:
            copy_as_png(src, dest)
            print(f'  [OK]   {title:40s} -> {dest.name}')
            success += 1
        except Exception as e:
            print(f'  [KO]   {title:40s} : {e}')
            errors += 1
    return success, errors


def main():
    parser = argparse.ArgumentParser(
        description='Genere automatiquement les fichiers Shadow et Pixels manquants'
    )
    parser.add_argument('--dry-run', action='store_true',
                        help='Affiche ce qui serait fait sans rien ecrire')
    parser.add_argument('--only', choices=['Shadow', 'Pixels'],
                        help='Limite le traitement a un seul type')
    args = parser.parse_args()

    if not GAMES_DB_PATH.exists():
        print(f'ERREUR : {GAMES_DB_PATH} introuvable', file=sys.stderr)
        sys.exit(1)

    text = GAMES_DB_PATH.read_text(encoding='utf-8')
    games = parse_games(text)

    types = ['Shadow', 'Pixels']
    if args.only:
        types = [args.only]

    print()
    print('=' * 64)
    print('  Generation Shadow + Pixels depuis Medias/Image/')
    print('  (copie + conversion JPG -> PNG via Pillow)')
    print('=' * 64)
    print(f'  Dry run : {"OUI" if args.dry_run else "non"}')
    print(f'  Types   : {", ".join(types)}')
    print()

    total_ok = 0
    total_ko = 0
    for t in types:
        ok, ko = process_type(t, games, dry_run=args.dry_run)
        total_ok += ok
        total_ko += ko
        print()

    print('=' * 64)
    print(f'  Total : {total_ok} OK, {total_ko} echecs/skipped')
    print('=' * 64)


if __name__ == '__main__':
    main()
