"""
Python/standardize_pixels.py — Genere des Pixels uniformement pixellises

Pour chaque pochette brute presente dans un dossier source :
  1. Match le nom de fichier (sans extension) avec un titre du catalogue
     gamesDatabase.js (matching insensible a la casse + sanitization
     Windows : retire ':', '?', etc. comme le fait Python/pixelated.py)
  2. Downscale a 30 pixels max de large (parametrable) en mode NEAREST
     -> pixels nets, taille uniforme
  3. Sauvegarde dans Medias/Pixels/<Title>.png

Le rendu cote browser utilise 'image-rendering: pixelated' pour zoomer
l'image au format affichage en preservant les pixels carres. Tous les
jeux auront donc EXACTEMENT le meme degre de pixellisation (30 pixels
de large), peu importe la taille de la pochette source.

Workflow recommande :
  1. Lance Python/pixelated.py pour sourcer les pochettes dans
     'Python/pochettes_jeux/' (interface Tkinter de selection)
  2. Lance Python/standardize_pixels.py pour standardiser :
       python standardize_pixels.py --source pochettes_jeux

Prerequis :
    pip install pillow

Usage :
    cd Python
    python standardize_pixels.py --source pochettes_jeux
    python standardize_pixels.py --source pochettes_jeux --width 24
    python standardize_pixels.py --source pochettes_jeux --dry-run
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

REPO_ROOT = Path(__file__).resolve().parent.parent
GAMES_DB_PATH = REPO_ROOT / 'JS' / 'gamesDatabase.js'
PIXELS_DIR = REPO_ROOT / 'Medias' / 'Pixels'

DEFAULT_PIXEL_WIDTH = 30  # largeur cible apres downscale (en pixels)

# Regex JS-aware (gere les apostrophes echappees)
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


def sanitize_filename(filename):
    """Retire les caracteres interdits Windows (idem Python/pixelated.py)."""
    return re.sub(r'[\\/*?:"<>|]', '', filename)


def get_pixels_dest_path(game):
    """Renvoie le path absolu Medias/Pixels/<Title>.png declare par le jeu."""
    pixels_paths = [p for p in game.get('paths', []) if '/Pixels/' in p]
    if not pixels_paths:
        return None
    return REPO_ROOT / pixels_paths[0].replace('../', '', 1)


def match_pochette_to_game(pochette_path, games):
    """Trouve le jeu correspondant a un fichier pochette par matching du nom."""
    pochette_name = pochette_path.stem  # filename sans extension
    pochette_sanitized = sanitize_filename(pochette_name).lower().strip()

    for game in games:
        title_sanitized = sanitize_filename(game['title']).lower().strip()
        if pochette_sanitized == title_sanitized:
            return game
    return None


def pixelate_image(src_path, dest_path, target_width):
    """Downscale l'image a target_width pixels de large (NEAREST) et sauvegarde."""
    img = Image.open(src_path)
    if img.mode != 'RGB':
        img = img.convert('RGB')

    # Calcul hauteur proportionnelle
    ratio = target_width / img.width
    target_height = max(1, int(round(img.height * ratio)))

    # Downscale avec NEAREST pour preserver les pixels nets (effet rétro)
    small = img.resize((target_width, target_height), Image.NEAREST)

    dest_path.parent.mkdir(parents=True, exist_ok=True)
    small.save(dest_path, 'PNG')


def main():
    parser = argparse.ArgumentParser(
        description='Standardise les pochettes brutes en Pixels uniformement pixellises'
    )
    parser.add_argument('--source', required=True,
                        help='Dossier source contenant les pochettes brutes (jpg/png)')
    parser.add_argument('--width', type=int, default=DEFAULT_PIXEL_WIDTH,
                        help=f'Largeur cible en pixels (defaut {DEFAULT_PIXEL_WIDTH})')
    parser.add_argument('--dry-run', action='store_true',
                        help='Affiche le matching sans rien ecrire')
    parser.add_argument('--overwrite', action='store_true',
                        help='Ecrase les Pixels/X.png existants (defaut : skip si deja la)')
    args = parser.parse_args()

    source_dir = Path(args.source)
    if not source_dir.is_absolute():
        # Resout relatif au dossier Python/
        source_dir = Path(__file__).resolve().parent / source_dir
    if not source_dir.exists():
        print(f'ERREUR : dossier source introuvable : {source_dir}', file=sys.stderr)
        sys.exit(1)

    if not GAMES_DB_PATH.exists():
        print(f'ERREUR : {GAMES_DB_PATH} introuvable', file=sys.stderr)
        sys.exit(1)

    text = GAMES_DB_PATH.read_text(encoding='utf-8')
    games = parse_games(text)

    # Liste les pochettes du dossier source
    extensions = {'.jpg', '.jpeg', '.png', '.webp'}
    pochettes = sorted(p for p in source_dir.iterdir() if p.suffix.lower() in extensions)

    if not pochettes:
        print(f'Aucune pochette trouvee dans {source_dir}')
        return

    print()
    print('=' * 64)
    print(f'  Standardisation Pixels : downscale a {args.width} px de large')
    print('=' * 64)
    print(f'  Source        : {source_dir}')
    print(f'  Pochettes     : {len(pochettes)}')
    print(f'  Largeur cible : {args.width} px (NEAREST resampling)')
    print(f'  Overwrite     : {"OUI" if args.overwrite else "non (skip si deja la)"}')
    print(f'  Dry run       : {"OUI" if args.dry_run else "non"}')
    print()

    success = 0
    skipped = 0
    no_match = 0
    errors = 0

    for pochette in pochettes:
        game = match_pochette_to_game(pochette, games)
        if game is None:
            print(f'  [?]   {pochette.name:45s} -> aucun jeu match')
            no_match += 1
            continue

        dest = get_pixels_dest_path(game)
        if dest is None:
            print(f'  [?]   {pochette.name:45s} -> {game["title"]} (pas de Pixels declare)')
            no_match += 1
            continue

        if dest.exists() and not args.overwrite:
            print(f'  [-]   {pochette.name:45s} -> {dest.name} (deja la, skip)')
            skipped += 1
            continue

        if args.dry_run:
            print(f'  [DRY] {pochette.name:45s} -> {dest.name}')
            continue

        try:
            pixelate_image(pochette, dest, args.width)
            print(f'  [OK]  {pochette.name:45s} -> {dest.name}')
            success += 1
        except Exception as e:
            print(f'  [KO]  {pochette.name:45s} : {e}')
            errors += 1

    print()
    print('=' * 64)
    print(f'  Succes      : {success}')
    print(f'  Deja la     : {skipped}')
    print(f'  Sans match  : {no_match}')
    print(f'  Echecs      : {errors}')
    print('=' * 64)


if __name__ == '__main__':
    main()
