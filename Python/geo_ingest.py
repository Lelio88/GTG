"""
Python/geo_ingest.py — Ingere des captures panoramiques 360° (ex: NVIDIA Ansel)
dans le mode Geo, sans rien renommer a la main.

Pour chaque image : valide qu'elle est EQUIRECTANGULAIRE (ratio ~2:1),
redimensionne si trop grande, la nomme `<Title> N.jpg` (N = prochain libre),
la range dans Medias/Geo/, deplace l'original dans _inbox/_processed/, puis
lance geo_declare.py pour declarer les champs `geo` dans gamesDatabase.js.

FLUX RECOMMANDE
    1. Capture tes panoramas 360° en jeu (Ansel : Alt+F2 -> mode 360 -> Snap).
    2. Range-les PAR JEU dans des sous-dossiers de l'inbox, le nom du dossier
       etant le `title` EXACT de gamesDatabase.js :
           Medias/Geo/_inbox/God of War/shot1.jpg
           Medias/Geo/_inbox/Cyberpunk 2077/a.png
    3. python Python/geo_ingest.py

VARIANTE (toutes les images d'un seul jeu, a la racine de l'inbox) :
    python Python/geo_ingest.py --title "God of War"

Options : --inbox DIR | --title T | --dry-run | --no-declare | --max-width N
Prerequis : Pillow.
"""
import re
import sys
import shutil
import argparse
import subprocess
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("ERREUR : Pillow non installe. Lance : pip install pillow", file=sys.stderr)
    sys.exit(1)

REPO = Path(__file__).resolve().parent.parent
GEO = REPO / 'Medias' / 'Geo'
INBOX_DEFAULT = GEO / '_inbox'
TARGET_RATIO = 2.0
RATIO_TOL = 0.2
DEFAULT_MAX_W = 4096
EXTS = {'.png', '.jpg', '.jpeg', '.webp', '.bmp'}


def next_index(title):
    """Prochain N libre pour `<title> N.jpg` dans Medias/Geo/."""
    n = 0
    for f in GEO.glob(f'{title} *.jpg'):
        m = re.match(rf'^{re.escape(title)} (\d+)\.jpg$', f.name)
        if m:
            n = max(n, int(m.group(1)))
    return n + 1


def collect(inbox, forced_title):
    """Retourne [(title, image_path), ...] depuis l'inbox."""
    items = []
    if not inbox.exists():
        return items
    if forced_title:
        for f in sorted(inbox.iterdir()):
            if f.is_file() and f.suffix.lower() in EXTS:
                items.append((forced_title, f))
    else:
        for sub in sorted(inbox.iterdir()):
            if sub.is_dir() and not sub.name.startswith('_'):
                for f in sorted(sub.iterdir()):
                    if f.is_file() and f.suffix.lower() in EXTS:
                        items.append((sub.name, f))
    return items


def process(title, src, n, inbox, max_w, dry):
    """Valide + convertit une capture en Medias/Geo/<title> n.jpg. True si OK."""
    try:
        img = Image.open(src).convert('RGB')
    except Exception as e:
        print(f'  SKIP {src.name} : illisible ({e})')
        return False
    w, h = img.size
    ratio = w / h if h else 0
    if abs(ratio - TARGET_RATIO) > RATIO_TOL:
        print(f'  SKIP {src.name} : ratio {ratio:.2f} != 2.0 -> pas equirectangulaire '
              f'(Ansel : bien choisir le mode "360°", pas "stereo 360" ni "panorama").')
        return False

    dest = GEO / f'{title} {n}.jpg'
    if dry:
        print(f'  [dry] {src.name}  ->  {dest.name}  ({w}x{h})')
        return True

    if w > max_w:
        img = img.resize((max_w, max_w // 2), Image.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, 'JPEG', quality=88)
    done = inbox / '_processed'
    done.mkdir(parents=True, exist_ok=True)
    shutil.move(str(src), str(done / src.name))
    print(f'  OK   {src.name}  ->  {dest.relative_to(REPO)}  ({img.size[0]}x{img.size[1]})')
    return True


def main():
    ap = argparse.ArgumentParser(description='Ingere des captures 360° (Ansel) dans le mode Geo')
    ap.add_argument('--inbox', default=str(INBOX_DEFAULT), help='Dossier source (defaut Medias/Geo/_inbox)')
    ap.add_argument('--title', help='Forcer le titre (images a la racine de l\'inbox)')
    ap.add_argument('--dry-run', action='store_true', help='Simule sans rien ecrire/deplacer')
    ap.add_argument('--no-declare', action='store_true', help='Ne pas lancer geo_declare a la fin')
    ap.add_argument('--max-width', type=int, default=DEFAULT_MAX_W, help='Largeur max (defaut 4096)')
    args = ap.parse_args()

    inbox = Path(args.inbox)
    items = collect(inbox, args.title)
    if not items:
        print(f'Inbox vide : {inbox}\n'
              f'Range tes captures dans des sous-dossiers <Titre du jeu>/ , ou utilise --title.')
        return

    print(f'{len(items)} capture(s) a traiter depuis {inbox}\n')
    counters = {}
    created = 0
    for title, src in items:
        if title not in counters:
            counters[title] = next_index(title)
        if process(title, src, counters[title], inbox, args.max_width, args.dry_run):
            counters[title] += 1
            created += 1

    print(f'\n{created} panorama(s) ingere(s).')
    if args.dry_run:
        print('(dry-run : rien ecrit)')
        return
    if created and not args.no_declare:
        print('\n-> geo_declare.py :')
        subprocess.run([sys.executable, str(REPO / 'Python' / 'geo_declare.py')])


if __name__ == '__main__':
    main()
