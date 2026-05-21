"""
Python/check_assets.py — Audit des assets manquants

Lit JS/gamesDatabase.js, pour chaque jeu vérifie l'existence des fichiers
attendus dans Medias/<Type>/ selon les conventions du projet :

    Image:  Medias/Image/<Title> 1.jpg, <Title> 2.jpg, <Title> 3.jpg
    Sound:  Medias/Sound/<Title> 1.mp3, <Title> 2.mp3, <Title> 3.mp3
    Midi:   Medias/Midi/<Title>.mid
    Shadow: Medias/Shadow/<Title>.png
    Pixels: Medias/Pixels/<Title>.png

Affiche :
    - Récap global (combien de jeux complets)
    - Détail par jeu (quoi manque)
    - Récap par mode (pourcentage de complétion)

Usage :
    cd Python && python check_assets.py
    cd Python && python check_assets.py --json > missing.json  (export JSON)
"""

import re
import sys
import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
GAMES_DB_PATH = REPO_ROOT / 'JS' / 'gamesDatabase.js'

EXPECTED_PER_GAME = {
    'Image':  lambda t: [f"{t} {i}.jpg" for i in (1, 2, 3)],
    'Sound':  lambda t: [f"{t} {i}.mp3" for i in (1, 2, 3)],
    'Midi':   lambda t: [f"{t}.mid"],
    'Shadow': lambda t: [f"{t}.png"],
    'Pixels': lambda t: [f"{t}.png"],
}


def extract_titles(text):
    """Extrait la liste des titres depuis gamesDatabase.js (regex sur title: '...')."""
    pattern = re.compile(r"title\s*:\s*['\"]([^'\"]+)['\"]")
    return pattern.findall(text)


def check_game(title):
    """Pour un titre, retourne un dict {type: [fichiers_manquants]}."""
    missing = {}
    for type_name, build_files in EXPECTED_PER_GAME.items():
        type_dir = REPO_ROOT / 'Medias' / type_name
        expected = build_files(title)
        absent = [f for f in expected if not (type_dir / f).exists()]
        if absent:
            missing[type_name] = absent
    return missing


def print_report(titles, results):
    """Affiche le rapport texte (ASCII safe pour Windows console)."""
    incomplete = [(t, m) for t, m in results.items() if m]
    complete = len(titles) - len(incomplete)

    print()
    print("=" * 70)
    print(f"  CATALOGUE GTG - {len(titles)} jeux dans gamesDatabase.js")
    print("=" * 70)
    print(f"  Jeux complets       : {complete} / {len(titles)}  ({100*complete//len(titles)}%)")
    print(f"  Jeux avec manquants : {len(incomplete)} / {len(titles)}")
    print()

    if incomplete:
        print("=" * 70)
        print("  DETAIL DES MANQUANTS PAR JEU")
        print("=" * 70)
        for title, missing in sorted(incomplete, key=lambda x: x[0]):
            print(f"\n  > {title}")
            for type_name in EXPECTED_PER_GAME.keys():
                if type_name in missing:
                    files = missing[type_name]
                    total = len(EXPECTED_PER_GAME[type_name](title))
                    print(f"     [KO] {type_name:6} ({len(files)}/{total} manquants)  {', '.join(files)}")
                else:
                    print(f"     [OK] {type_name:6}")

    print()
    print("=" * 70)
    print("  RECAP PAR MODE")
    print("=" * 70)
    for type_name in EXPECTED_PER_GAME.keys():
        total_expected = sum(len(EXPECTED_PER_GAME[type_name](t)) for t in titles)
        total_missing = sum(len(m.get(type_name, [])) for m in results.values())
        present = total_expected - total_missing
        pct = (100 * present // total_expected) if total_expected else 0
        bar_length = 30
        filled = bar_length * present // total_expected if total_expected else 0
        bar = '#' * filled + '-' * (bar_length - filled)
        print(f"  {type_name:6} : [{bar}]  {present}/{total_expected}  ({pct}%)")
    print()


def print_json(titles, results):
    """Sortie JSON pour scripts downstream."""
    incomplete = {t: m for t, m in results.items() if m}
    output = {
        'total_games': len(titles),
        'complete_games': len(titles) - len(incomplete),
        'incomplete_count': len(incomplete),
        'incomplete': incomplete,
    }
    print(json.dumps(output, indent=2, ensure_ascii=False))


def main():
    if not GAMES_DB_PATH.exists():
        print(f"ERREUR : {GAMES_DB_PATH} introuvable.", file=sys.stderr)
        sys.exit(1)

    text = GAMES_DB_PATH.read_text(encoding='utf-8')
    titles = extract_titles(text)
    if not titles:
        print("ERREUR : aucun jeu trouvé dans gamesDatabase.js", file=sys.stderr)
        sys.exit(1)

    results = {title: check_game(title) for title in titles}

    if '--json' in sys.argv:
        print_json(titles, results)
    else:
        print_report(titles, results)


if __name__ == '__main__':
    main()
