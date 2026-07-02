"""
Python/geo_undeclare.py — Retire le champ `geo` des jeux dont les panoramas
n'existent PLUS dans Medias/Geo/ (nettoyage apres suppression d'assets casses).

Pendant du geo_declare.py : declare = fichiers presents ; undeclare = fichiers
absents. Idempotent : ne retire une ligne `geo:` que si AUCUN de ses fichiers
n'existe encore sur le disque. Backup .js.bak.undeclare. A relancer apres avoir
supprime des panoramas invalides (stereo 3D, mauvaise projection, mauvais jeu).

Usage :
    python Python/geo_undeclare.py            # applique
    python Python/geo_undeclare.py --dry-run  # simule sans ecrire
"""
import re
import argparse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
GEO = REPO / 'Medias' / 'Geo'
DB = REPO / 'JS' / 'gamesDatabase.js'

GEO_LINE = re.compile(r"^\s*geo:\s*\[(.*)\],?\s*$")
GEO_FILE = re.compile(r"'\.\./Medias/Geo/([^']+)'")


def main():
    ap = argparse.ArgumentParser(description='Retire les champs geo orphelins (fichiers manquants)')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    text = DB.read_text(encoding='utf-8')
    out, removed = [], []
    for line in text.splitlines(keepends=True):
        m = GEO_LINE.match(line)
        if m:
            files = GEO_FILE.findall(m.group(1))
            if files and any((GEO / f).exists() for f in files):
                out.append(line)          # au moins un panorama existe -> on garde
            else:
                removed.append(files)     # tous manquants -> on retire la ligne
                continue
        else:
            out.append(line)

    print(f'Champs geo retires (fichiers manquants) : {removed}')
    if args.dry_run:
        print('(dry-run : rien ecrit)')
        return
    if removed:
        DB.with_suffix('.js.bak.undeclare').write_text(text, encoding='utf-8')
        DB.write_text(''.join(out), encoding='utf-8')
        print(f'Ecrit. Backup -> {DB.name}.bak.undeclare')
    else:
        print('Rien a retirer.')


if __name__ == '__main__':
    main()
