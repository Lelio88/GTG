"""
Python/check_assets.py - Audit des assets manquants

Parse JS/gamesDatabase.js, extrait pour chaque jeu :
  - son `title` (utilisé pour l'affichage et la validation des réponses)
  - tous les paths declares dans image[], sound[], midi[], shadow[], pixels[]

Puis verifie l'existence physique de chaque path declare. Important : on lit
les paths reellement declares au lieu de les deviner depuis le title, car
certains titres contiennent des caracteres interdits Windows (':' dans
"Sekiro: Shadows Die Twice") qui sont retires du nom de fichier sur disque
mais conserves dans le `title`.

Usage :
    cd Python && python check_assets.py
    cd Python && python check_assets.py --json > missing.json
"""

import re
import sys
import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
GAMES_DB_PATH = REPO_ROOT / 'JS' / 'gamesDatabase.js'

# Nombre de paths attendus par type dans la declaration d'un jeu
EXPECTED_COUNT_PER_TYPE = {
    'Image': 3,
    'Sound': 3,
    'Midi': 1,
    'Shadow': 1,
    'Pixels': 1,
}

"""
Regex pour parser un literal de string JS en gerant les escapes (\\', \\", \\\\, \\n...).

  '((?:\\\\.|[^'\\\\])*)'    --> single-quoted : capture une suite de
                                  ( backslash + n'importe quoi ) OU ( pas-apostrophe-pas-backslash )
  "((?:\\\\.|[^"\\\\])*)"    --> double-quoted, idem

group(1) = contenu single-quoted, group(2) = contenu double-quoted.
"""
STRING_TOKEN = r"""(?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)")"""

TITLE_PATTERN = re.compile(r"title\s*:\s*" + STRING_TOKEN)
STRING_PATTERN = re.compile(STRING_TOKEN)


def js_unescape(raw):
    """Decode les sequences d'echappement basiques d'un string literal JS."""
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
    """Retourne le contenu du string literal, soit group(1) soit group(2), unescaped."""
    raw = match.group(1) if match.group(1) is not None else match.group(2)
    return js_unescape(raw)


def parse_games(text):
    """Decoupe le JS en blocs par titre et collecte les paths de chaque bloc.

    Important : on gere les apostrophes echappees (`\\'`) dans les titres et paths
    pour les jeux type "Assassin's Creed" ou "Five Night at Freddy's".
    """
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


def resolve_path(rel_path):
    """rel_path commence par '../Medias/'. Resout depuis REPO_ROOT."""
    return REPO_ROOT / rel_path.replace('../', '', 1)


def categorize_path(rel_path):
    """Retourne le type (Image, Sound, ...) depuis '../Medias/<Type>/...'"""
    m = re.match(r"^\.\./Medias/(\w+)/", rel_path)
    return m.group(1) if m else None


def check_game(game):
    """Retourne dict {type: {declared: int, present: int, missing_files: [filenames]}}."""
    by_type = {}
    for p in game['paths']:
        t = categorize_path(p)
        if not t:
            continue
        bucket = by_type.setdefault(t, {'paths': []})
        bucket['paths'].append(p)

    result = {}
    for type_name, expected_count in EXPECTED_COUNT_PER_TYPE.items():
        bucket = by_type.get(type_name, {'paths': []})
        declared = len(bucket['paths'])
        missing_files = []
        # Test l'existence de chaque path declare
        for p in bucket['paths']:
            if not resolve_path(p).exists():
                missing_files.append(p.split('/')[-1])
        # Manquants non declares (declaration incomplete)
        undeclared_count = max(0, expected_count - declared)
        for i in range(undeclared_count):
            missing_files.append(f"(non declare dans gamesDatabase.js)")
        present = declared - len(missing_files) + undeclared_count
        # Recompute present properly
        present = declared - sum(1 for p in bucket['paths'] if not resolve_path(p).exists())
        result[type_name] = {
            'declared': declared,
            'expected': expected_count,
            'present': present,
            'missing_files': missing_files,
        }
    return result


def print_report(games, results):
    incomplete = [(g, r) for g, r in zip(games, results) if any(t['missing_files'] for t in r.values())]
    complete_count = len(games) - len(incomplete)

    print()
    print("=" * 70)
    print(f"  CATALOGUE GTG - {len(games)} jeux dans gamesDatabase.js")
    print("=" * 70)
    print(f"  Jeux complets       : {complete_count} / {len(games)}  ({100 * complete_count // max(1, len(games))}%)")
    print(f"  Jeux avec manquants : {len(incomplete)} / {len(games)}")
    print()

    if incomplete:
        print("=" * 70)
        print("  DETAIL DES MANQUANTS PAR JEU")
        print("=" * 70)
        for game, res in sorted(incomplete, key=lambda x: x[0]['title'].lower()):
            print(f"\n  > {game['title']}")
            for type_name in EXPECTED_COUNT_PER_TYPE.keys():
                t = res[type_name]
                if t['missing_files']:
                    print(f"     [KO] {type_name:6} ({t['present']}/{t['expected']})  {', '.join(t['missing_files'])}")
                # On n'affiche plus les lignes [OK] - inutile bruit pour la lecture

    print()
    print("=" * 70)
    print("  RECAP PAR MODE (sur l'ensemble du catalogue)")
    print("=" * 70)
    for type_name, expected_count in EXPECTED_COUNT_PER_TYPE.items():
        total_expected = expected_count * len(games)
        total_present = sum(r[type_name]['present'] for r in results)
        pct = (100 * total_present // total_expected) if total_expected else 0
        bar_length = 30
        filled = (bar_length * total_present // total_expected) if total_expected else 0
        bar = '#' * filled + '-' * (bar_length - filled)
        missing = total_expected - total_present
        print(f"  {type_name:6} : [{bar}]  {total_present}/{total_expected}  ({pct}%, {missing} manquants)")
    print()


def print_json(games, results):
    payload = {
        'total_games': len(games),
        'games': [
            {
                'title': g['title'],
                'modes': r,
            }
            for g, r in zip(games, results)
            if any(t['missing_files'] for t in r.values())
        ],
    }
    print(json.dumps(payload, indent=2, ensure_ascii=False))


def main():
    if not GAMES_DB_PATH.exists():
        print(f"ERREUR : {GAMES_DB_PATH} introuvable.", file=sys.stderr)
        sys.exit(1)

    text = GAMES_DB_PATH.read_text(encoding='utf-8')
    games = parse_games(text)
    if not games:
        print("ERREUR : aucun jeu detecte dans gamesDatabase.js", file=sys.stderr)
        sys.exit(1)

    results = [check_game(g) for g in games]

    if '--json' in sys.argv:
        print_json(games, results)
    else:
        print_report(games, results)


if __name__ == '__main__':
    main()
