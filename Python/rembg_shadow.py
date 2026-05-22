"""
Python/rembg_shadow.py — Generation auto des silhouettes Shadow via rembg (IA)

Pour chaque jeu dont Medias/Shadow/<Title>.png manque :
  1. Prend la 1ere image disponible dans Medias/Image/ (declaree dans
     gamesDatabase.js path image[])
  2. Applique rembg (modele IA U^2-Net) pour detourer le personnage / sujet
     principal et obtenir un PNG avec fond transparent
  3. Convertit tous les pixels non-transparents en noir pur
     -> silhouette propre (forme reconnaissable, fond transparent)
  4. Sauvegarde dans Medias/Shadow/<Title>.png

Prerequis :
    pip install rembg pillow

  La premiere execution telecharge le modele U^2-Net (~170 MB) automatiquement
  dans ~/.u2net/. Suivantes : instantanees.

Usage :
    cd Python && python rembg_shadow.py
    cd Python && python rembg_shadow.py --dry-run
    cd Python && python rembg_shadow.py --image-index 0   # par defaut 0 = image 1

Notes :
    - Detourage automatique pas toujours parfait (depend du screenshot source)
    - ~3-8 secondes par image (CPU)
    - Pour des resultats meilleurs, choisis une image source avec un sujet
      bien centre et detache du fond
"""

import re
import sys
import argparse
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("ERREUR : Pillow non installe. Lance : pip install pillow", file=sys.stderr)
    sys.exit(1)

try:
    from rembg import remove, new_session
except ImportError:
    print("ERREUR : rembg non installe. Lance : pip install rembg", file=sys.stderr)
    print("Note : la premiere execution telechargera ~170 MB de modele IA.", file=sys.stderr)
    sys.exit(1)

REPO_ROOT = Path(__file__).resolve().parent.parent
GAMES_DB_PATH = REPO_ROOT / 'JS' / 'gamesDatabase.js'

# Regex JS-aware
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


def find_missing_shadows(games):
    """Liste les jeux dont Medias/Shadow/<Title>.png manque, avec leur game."""
    missing = []
    for game in games:
        shadow_paths = [p for p in game['paths'] if '/Shadow/' in p]
        for path in shadow_paths:
            abs_path = REPO_ROOT / path.replace('../', '', 1)
            if not abs_path.exists():
                missing.append({
                    'title': game['title'],
                    'expected_path': abs_path,
                    'game': game,
                })
    return missing


def get_source_image(game, image_index=0):
    """Renvoie le path absolu de l'image source (Image/<Title> N.jpg) ou None."""
    image_paths = sorted(p for p in game.get('paths', []) if '/Image/' in p)
    if image_index >= len(image_paths):
        return None
    src = REPO_ROOT / image_paths[image_index].replace('../', '', 1)
    return src if src.exists() else None


def make_silhouette(src_path, dest_path, session):
    """Detoure le sujet via rembg, puis remplace les pixels non-transparents par du noir."""
    src_img = Image.open(src_path)
    # rembg renvoie une image RGBA avec fond transparent
    rgba = remove(src_img, session=session)
    rgba = rgba.convert('RGBA')

    pixels = rgba.getdata()
    silhouette = []
    for r, g, b, a in pixels:
        if a > 30:
            silhouette.append((0, 0, 0, 255))  # noir opaque
        else:
            silhouette.append((0, 0, 0, 0))     # transparent
    rgba.putdata(silhouette)

    dest_path.parent.mkdir(parents=True, exist_ok=True)
    rgba.save(dest_path, 'PNG')


def main():
    parser = argparse.ArgumentParser(description='Genere des silhouettes Shadow via rembg (IA)')
    parser.add_argument('--dry-run', action='store_true', help='Liste sans rien faire')
    parser.add_argument('--image-index', type=int, default=0,
                        help='Index image source (0=image 1, 1=image 2, etc.). Defaut 0.')
    parser.add_argument('--model', default='u2net',
                        help='Modele rembg (u2net, u2netp, silueta, isnet-general-use...). Defaut u2net.')
    args = parser.parse_args()

    if not GAMES_DB_PATH.exists():
        print(f'ERREUR : {GAMES_DB_PATH} introuvable', file=sys.stderr)
        sys.exit(1)

    text = GAMES_DB_PATH.read_text(encoding='utf-8')
    games = parse_games(text)
    missing = find_missing_shadows(games)

    if not missing:
        print('Aucune silhouette Shadow manquante.')
        return

    print()
    print('=' * 64)
    print(f'  Generation de {len(missing)} silhouette(s) Shadow via rembg')
    print(f'  Modele : {args.model}')
    print(f'  Image source : image {args.image_index + 1}/3 de chaque jeu')
    print(f'  Dry run : {"OUI" if args.dry_run else "non"}')
    print('=' * 64)
    print()

    if args.dry_run:
        for entry in missing:
            src = get_source_image(entry['game'], args.image_index)
            tag = 'OK' if src else 'NO_SOURCE'
            print(f'  [{tag}] {entry["title"]:40s} -> {entry["expected_path"].name}')
        print()
        return

    # Initialise la session rembg une seule fois (charge le modele en RAM)
    print('Chargement du modele rembg (premiere exec = download du modele)...')
    session = new_session(args.model)
    print('Modele charge. Debut du traitement.')
    print()

    success = 0
    errors = 0
    for i, entry in enumerate(missing, 1):
        title = entry['title']
        dest = entry['expected_path']
        src = get_source_image(entry['game'], args.image_index)
        print(f'[{i:3}/{len(missing)}] {title:40s} ', end='', flush=True)
        if src is None:
            print('SKIP (image source introuvable)')
            errors += 1
            continue
        try:
            make_silhouette(src, dest, session)
            print(f'OK -> {dest.name}')
            success += 1
        except Exception as e:
            print(f'ECHEC ({e})')
            errors += 1

    print()
    print('=' * 64)
    print(f'  Succes : {success} / {len(missing)}')
    print(f'  Echecs : {errors}')
    print('=' * 64)


if __name__ == '__main__':
    main()
