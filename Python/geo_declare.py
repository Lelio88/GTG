"""
Python/geo_declare.py — Declare le champ `geo` dans JS/gamesDatabase.js pour
tous les jeux disposant de panoramas dans Medias/Geo/.

Scanne Medias/Geo/<Title> N.jpg, regroupe par jeu, et insere
    geo: ['../Medias/Geo/<Title> 1.jpg', ...]
dans l'entree correspondante de gamesDatabase.js (juste apres la ligne title).

Idempotent : ignore les jeux qui ont deja un champ `geo`. Fait un backup
.js.bak et n'ecrit que s'il y a au moins une insertion. A relancer apres
chaque nouveau lot de panoramas (geo_fetch.py).

Usage :
    python Python/geo_declare.py            # applique
    python Python/geo_declare.py --dry-run  # simule sans ecrire
"""
import re
import argparse
from pathlib import Path
from collections import defaultdict

REPO = Path(__file__).resolve().parent.parent
GEO = REPO / 'Medias' / 'Geo'
DB = REPO / 'JS' / 'gamesDatabase.js'


def scan():
    """Medias/Geo/<Title> N.jpg -> { '<Title>': ['<Title> 1.jpg', ...] } (trie)."""
    groups = defaultdict(list)
    for f in sorted(GEO.glob('*.*')):
        m = re.match(r'^(.+?) (\d+)\.(jpg|jpeg|png)$', f.name, re.IGNORECASE)
        if m:
            groups[m.group(1)].append((int(m.group(2)), f.name))
    return {t: [name for _, name in sorted(v)] for t, v in groups.items()}


def js_escape(title):
    return title.replace('\\', '\\\\').replace("'", "\\'")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    games = scan()
    if not games:
        print('Aucun panorama dans Medias/Geo/.')
        return

    text = DB.read_text(encoding='utf-8')
    added, skipped, missing = [], [], []

    for title in sorted(games):
        marker = f"title: '{js_escape(title)}'"
        idx = text.find(marker)
        if idx == -1:
            missing.append(title)
            continue
        # Bornes de l'entree : du title courant jusqu'au prochain title (ou fin).
        nxt = text.find("\n        title:", idx + 1)
        entry = text[idx:(nxt if nxt != -1 else len(text))]
        if 'geo:' in entry:
            skipped.append(title)
            continue
        paths = ", ".join(f"'../Medias/Geo/{name}'" for name in games[title])
        line_end = text.find('\n', idx)  # fin de la ligne title (title a toujours sa virgule)
        text = text[:line_end] + f"\n        geo: [{paths}]," + text[line_end:]
        added.append(title)

    print(f'Ajoutes ({len(added)}) : {added}')
    print(f'Deja declares   : {skipped}')
    if missing:
        print(f'INTROUVABLES dans gamesDatabase (verifie le titre exact) : {missing}')

    if args.dry_run:
        print('\n(dry-run : rien ecrit)')
        return
    if added:
        DB.with_suffix('.js.bak').write_text(DB.read_text(encoding='utf-8'), encoding='utf-8')
        DB.write_text(text, encoding='utf-8')
        print(f'\nEcrit : {len(added)} insertion(s). Backup -> {DB.name}.bak')
    else:
        print('\nRien a inserer.')


if __name__ == '__main__':
    main()
