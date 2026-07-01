"""
Python/rembg_perso.py — Detourage des avatars du narrateur via rembg (IA)

Les avatars du personnage narrateur (dialogue.js) etaient livres en .jpg
(format sans canal alpha) : le fond degrade sombre etait "cuit" dans l'image
et s'affichait comme un rectangle derriere le personnage dans le hub.

Ce script prend chaque Assets/perso <N>.jpg et produit Assets/perso <N>.png
avec fond transparent, en CONSERVANT les couleurs (contrairement a
rembg_shadow.py qui aplatit tout en noir pour faire une silhouette).

Prerequis :
    pip install rembg pillow

  La premiere execution telecharge le modele U^2-Net (~170 MB) dans ~/.u2net/.
  Suivantes : instantanees.

Usage :
    cd Python && python rembg_perso.py
    cd Python && python rembg_perso.py --dry-run
    cd Python && python rembg_perso.py --model isnet-general-use
"""

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
ASSETS_DIR = REPO_ROOT / 'Assets'

# Avatars a detourer : source .jpg -> destination .png (meme nom).
SOURCES = ['perso 1.jpg', 'perso 2.jpg', 'perso 3.jpg']


def cutout(src_path, dest_path, session):
    """Detoure le sujet via rembg en gardant les couleurs (RGBA transparent)."""
    src_img = Image.open(src_path).convert('RGBA')
    rgba = remove(src_img, session=session)  # fond transparent, sujet en couleur
    rgba = rgba.convert('RGBA')
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    rgba.save(dest_path, 'PNG')


def main():
    parser = argparse.ArgumentParser(description='Detoure les avatars du narrateur via rembg (IA)')
    parser.add_argument('--dry-run', action='store_true', help='Liste sans rien faire')
    parser.add_argument('--model', default='isnet-general-use',
                        help='Modele rembg (isnet-general-use recommande pour les personnages, '
                             'u2net, u2netp, silueta...). Defaut isnet-general-use.')
    args = parser.parse_args()

    targets = []
    for name in SOURCES:
        src = ASSETS_DIR / name
        dest = ASSETS_DIR / (Path(name).stem + '.png')
        targets.append({'src': src, 'dest': dest, 'exists': src.exists()})

    print()
    print('=' * 64)
    print(f'  Detourage de {len(targets)} avatar(s) narrateur via rembg')
    print(f'  Modele : {args.model}')
    print(f'  Dry run : {"OUI" if args.dry_run else "non"}')
    print('=' * 64)
    print()

    if args.dry_run:
        for t in targets:
            tag = 'OK' if t['exists'] else 'NO_SOURCE'
            print(f'  [{tag}] {t["src"].name:20s} -> {t["dest"].name}')
        print()
        return

    print('Chargement du modele rembg (premiere exec = download du modele)...')
    session = new_session(args.model)
    print('Modele charge. Debut du traitement.')
    print()

    success = 0
    errors = 0
    for i, t in enumerate(targets, 1):
        print(f'[{i}/{len(targets)}] {t["src"].name:20s} ', end='', flush=True)
        if not t['exists']:
            print('SKIP (source introuvable)')
            errors += 1
            continue
        try:
            cutout(t['src'], t['dest'], session)
            print(f'OK -> {t["dest"].name}')
            success += 1
        except Exception as e:
            print(f'ECHEC ({e})')
            errors += 1

    print()
    print('=' * 64)
    print(f'  Succes : {success} / {len(targets)}')
    print(f'  Echecs : {errors}')
    print('=' * 64)


if __name__ == '__main__':
    main()
