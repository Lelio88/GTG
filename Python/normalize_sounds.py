"""
Python/normalize_sounds.py — Normalise le volume des MP3 de Medias/Sound/

Applique le standard EBU R128 LUFS sur chaque MP3 (le même standard utilisé
par Spotify, YouTube, Netflix). Cible par défaut : -16 LUFS, true peak -1.5 dB.

Résultat : tous tes extraits audio auront le même volume perçu pour
l'utilisateur, peu importe leur source de téléchargement.

PRÉREQUIS
=========

1. **ffmpeg** installé et accessible dans le PATH système.
   - Windows : https://www.gyan.dev/ffmpeg/builds/  (download "essentials" build)
               Décompresse, ajoute le dossier `bin/` au PATH système
   - macOS   : brew install ffmpeg
   - Linux   : sudo apt install ffmpeg

2. **ffmpeg-normalize** (wrapper Python autour de ffmpeg) :
       pip install ffmpeg-normalize

USAGE
=====

    cd Python
    python normalize_sounds.py                 # normalise tout (overwrite)
    python normalize_sounds.py --backup        # crée des .bak avant overwrite
    python normalize_sounds.py --dry-run       # liste sans rien faire
    python normalize_sounds.py --target -14    # cible LUFS custom (défaut -16)

Le script peut être relancé à tout moment — il re-normalise simplement les
fichiers (idempotent en pratique vu que la cible est la même).
"""

import sys
import shutil
import subprocess
import argparse
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SOUND_DIR = REPO_ROOT / 'Medias' / 'Sound'

# Cibles EBU R128 (alignées sur les standards streaming actuels)
DEFAULT_TARGET_LUFS = -16
DEFAULT_TRUE_PEAK_DB = -1.5
DEFAULT_BITRATE = '192k'


def check_dependencies():
    """Verifie que ffmpeg et ffmpeg-normalize sont installes."""
    ffmpeg_ok = shutil.which('ffmpeg') is not None
    fn_ok = (
        shutil.which('ffmpeg-normalize') is not None
        or shutil.which('ffmpeg-normalize.exe') is not None
    )

    if not ffmpeg_ok:
        print("ERREUR : ffmpeg n'est pas trouve dans le PATH.", file=sys.stderr)
        print("  Windows : https://www.gyan.dev/ffmpeg/builds/ (puis ajouter bin/ au PATH)", file=sys.stderr)
        print("  macOS   : brew install ffmpeg", file=sys.stderr)
        print("  Linux   : sudo apt install ffmpeg", file=sys.stderr)
        return False

    if not fn_ok:
        print("ERREUR : ffmpeg-normalize n'est pas installe.", file=sys.stderr)
        print("  pip install ffmpeg-normalize", file=sys.stderr)
        return False

    return True


def normalize_file(mp3_path, target_lufs, true_peak, bitrate, backup):
    """Normalise un MP3 en place avec ffmpeg-normalize.

    Retourne (success: bool, error_message: str | None).
    """
    if backup:
        bak = mp3_path.with_suffix(mp3_path.suffix + '.bak')
        if not bak.exists():
            shutil.copy2(mp3_path, bak)

    # ffmpeg-normalize ne supporte pas l'in-place direct : on sort vers un
    # fichier temp puis on remplace
    tmp_path = mp3_path.with_suffix('.normalizing.mp3')

    cmd = [
        'ffmpeg-normalize',
        str(mp3_path),
        '-o', str(tmp_path),
        '-t', str(target_lufs),
        '-tp', str(true_peak),
        '-c:a', 'libmp3lame',
        '-b:a', bitrate,
        '-f',  # force overwrite output
        '-pr',  # disable progress bar (on a notre propre compteur)
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    except subprocess.TimeoutExpired:
        if tmp_path.exists():
            tmp_path.unlink()
        return False, 'timeout (>120s)'
    except FileNotFoundError:
        return False, "commande 'ffmpeg-normalize' introuvable"

    if result.returncode != 0:
        if tmp_path.exists():
            tmp_path.unlink()
        err_line = (result.stderr or '').strip().split('\n')[-1] if result.stderr else 'erreur inconnue'
        return False, err_line

    if tmp_path.exists() and tmp_path.stat().st_size > 0:
        shutil.move(str(tmp_path), str(mp3_path))
        return True, None

    return False, 'fichier de sortie non cree'


def main():
    parser = argparse.ArgumentParser(
        description='Normalise le volume EBU R128 des MP3 de Medias/Sound/'
    )
    parser.add_argument('--backup', action='store_true',
                        help='Cree un .bak avant chaque overwrite (irreversible sinon)')
    parser.add_argument('--target', type=float, default=DEFAULT_TARGET_LUFS,
                        help=f'LUFS cible (defaut {DEFAULT_TARGET_LUFS})')
    parser.add_argument('--peak', type=float, default=DEFAULT_TRUE_PEAK_DB,
                        help=f'True peak limit dB (defaut {DEFAULT_TRUE_PEAK_DB})')
    parser.add_argument('--bitrate', default=DEFAULT_BITRATE,
                        help=f'Bitrate de sortie (defaut {DEFAULT_BITRATE})')
    parser.add_argument('--dry-run', action='store_true',
                        help='Liste les fichiers sans rien modifier')
    args = parser.parse_args()

    if not SOUND_DIR.exists():
        print(f'ERREUR : {SOUND_DIR} introuvable.', file=sys.stderr)
        sys.exit(1)

    # Exclut les .bak pour ne pas les normaliser eux-memes
    mp3_files = sorted(p for p in SOUND_DIR.glob('*.mp3') if not p.name.endswith('.bak'))
    if not mp3_files:
        print('Aucun MP3 dans Medias/Sound/. Rien a faire.')
        return

    print('=' * 64)
    print(f'  Normalisation EBU R128 des MP3 de Medias/Sound/')
    print('=' * 64)
    print(f'  Fichiers      : {len(mp3_files)} MP3')
    print(f'  Cible         : {args.target} LUFS (true peak {args.peak} dB)')
    print(f'  Bitrate       : {args.bitrate}')
    print(f'  Backup .bak   : {"OUI" if args.backup else "non (overwrite definitif)"}')
    print()

    if args.dry_run:
        print('[DRY RUN] Aucune modification, juste la liste :')
        for f in mp3_files:
            print(f'  - {f.name}')
        return

    if not check_dependencies():
        sys.exit(1)

    success = 0
    errors = 0
    error_log = []

    for i, mp3 in enumerate(mp3_files, 1):
        print(f'[{i:3}/{len(mp3_files)}] {mp3.name[:50]:50s} ', end='', flush=True)
        ok, err = normalize_file(mp3, args.target, args.peak, args.bitrate, args.backup)
        if ok:
            print('OK')
            success += 1
        else:
            print(f'ECHEC ({err})')
            errors += 1
            error_log.append((mp3.name, err))

    print()
    print('=' * 64)
    print(f'  Succes : {success} / {len(mp3_files)}')
    print(f'  Echecs : {errors}')
    print('=' * 64)
    if error_log:
        print()
        print('Detail des echecs :')
        for name, err in error_log:
            print(f'  - {name} : {err}')


if __name__ == '__main__':
    main()
