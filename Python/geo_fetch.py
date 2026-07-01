"""
Python/geo_fetch.py — Recupere des panoramas 360° equirectangulaires de jeux
depuis des videos YouTube 360°, pour le mode Geo (yt-dlp + ffmpeg + Pillow).

POURQUOI CA MARCHE : YouTube stocke les videos 360° en projection
EQUIRECTANGULAIRE (ratio 2:1). En extraire une image donne directement un
panorama exploitable par le viewer (Photo Sphere Viewer, cf. renderHintGeo).
On ne telecharge qu'un court segment autour de chaque timestamp (pas la video
entiere) -> rapide et leger.

Prerequis : yt-dlp + ffmpeg (deja utilises par le mode Sound) + Pillow.
    pip install -r Python/requirements.txt   (yt-dlp, Pillow deja presents)

Usage :
    # Chercher des videos 360 candidates (ne telecharge rien ; ratio 2:1 = OK) :
    python Python/geo_fetch.py --search "Minecraft 360 VR"

    # Extraire des panoramas d'une video 360 aux timestamps donnes :
    python Python/geo_fetch.py --url "https://youtu.be/SopX8Y8Monw" \
        --title "Minecraft" --times 00:20 00:45 01:10

    # Un seul panorama (timestamp par defaut 00:20) :
    python Python/geo_fetch.py --url "..." --title "Minecraft"

Sortie : Medias/Geo/<Title> N.jpg (N = 1, 2, ... dans l'ordre des timestamps).
`<Title>` DOIT correspondre au champ `title` de gamesDatabase.js. Pense a
declarer le champ  geo: ['../Medias/Geo/<Title> 1.jpg', ...]  pour ce jeu.
"""

import sys
import argparse
import subprocess
import tempfile
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("ERREUR : Pillow non installe. Lance : pip install pillow", file=sys.stderr)
    sys.exit(1)

REPO_ROOT = Path(__file__).resolve().parent.parent
GEO_DIR = REPO_ROOT / 'Medias' / 'Geo'

# Ratio equirectangulaire attendu (largeur / hauteur).
TARGET_RATIO = 2.0
RATIO_TOLERANCE = 0.2
# Cap de largeur (une equirect 4K = 4096 large ; au-dela on redimensionne).
MAX_WIDTH = 4096
SEGMENT_SECONDS = 2  # duree du segment telecharge autour du timestamp


def run(cmd):
    """Execute une commande, retourne (code, sortie)."""
    proc = subprocess.run(cmd, capture_output=True, text=True)
    return proc.returncode, (proc.stdout or '') + (proc.stderr or '')


def to_seconds(ts):
    """'01:10' / '00:01:10' / '70' -> secondes (float)."""
    parts = [float(p) for p in str(ts).split(':')]
    if len(parts) == 3:
        return parts[0] * 3600 + parts[1] * 60 + parts[2]
    if len(parts) == 2:
        return parts[0] * 60 + parts[1]
    return parts[0]


def search(query, n=8):
    """Liste des videos candidates (id | resolution | ratio | titre)."""
    print(f'Recherche : "{query}" (ratio ~2.0 = equirectangulaire)\n')
    code, out = run([
        'yt-dlp', f'ytsearch{n}:{query}', '--skip-download', '--no-warnings',
        '--print', '%(id)s\t%(width)s\t%(height)s\t%(title).60s',
    ])
    if code != 0:
        print(out, file=sys.stderr)
        return
    for line in out.strip().splitlines():
        cols = line.split('\t')
        if len(cols) < 4:
            continue
        vid, w, h, title = cols[0], cols[1], cols[2], cols[3]
        try:
            ratio = round(int(w) / int(h), 2)
        except (ValueError, ZeroDivisionError):
            ratio = '?'
        flag = 'OK ' if ratio != '?' and abs(ratio - TARGET_RATIO) <= RATIO_TOLERANCE else '   '
        print(f'  [{flag}] https://youtu.be/{vid}  {w}x{h}  ratio={ratio}  {title}')
    print('\nChoisis une video "OK" puis relance avec --url ... --title ... --times ...')


def extract_one(url, seconds, dest, tmpdir):
    """Telecharge un segment autour de `seconds` et en extrait une image -> dest."""
    start, end = seconds, seconds + SEGMENT_SECONDS
    seg = Path(tmpdir) / 'seg.%(ext)s'
    code, out = run([
        'yt-dlp', url,
        '--download-sections', f'*{start}-{end}',
        # Format equirectangulaire (les videos 360 ne le sont qu'en haute def ;
        # les formats <=1440 sont souvent du 16:9 non-360). Pas de re-encodage
        # (--force-keyframes) : simple copie de flux = bien plus rapide, la
        # precision au keyframe n'importe pas pour extraire une image.
        '-f', 'bv*[height<=2160]/b',
        '--no-warnings',
        '-o', str(seg),
    ])
    seg_files = list(Path(tmpdir).glob('seg.*'))
    if code != 0 or not seg_files:
        print(f'    ECHEC telechargement ({url} @ {seconds}s)\n{out[-400:]}', file=sys.stderr)
        return False
    src = seg_files[0]

    frame = Path(tmpdir) / 'frame.jpg'
    code, out = run([
        'ffmpeg', '-y', '-ss', '0.5', '-i', str(src),
        '-vframes', '1', str(frame),
    ])
    src.unlink(missing_ok=True)
    if code != 0 or not frame.exists():
        print(f'    ECHEC extraction ffmpeg\n{out[-300:]}', file=sys.stderr)
        return False

    img = Image.open(frame).convert('RGB')
    w, h = img.size
    ratio = w / h if h else 0
    if abs(ratio - TARGET_RATIO) > RATIO_TOLERANCE:
        print(f'    ATTENTION ratio {ratio:.2f} != 2.0 : la video n\'est peut-etre pas 360° '
              f'equirectangulaire. Image sauvee quand meme.')
    if w > MAX_WIDTH:
        img = img.resize((MAX_WIDTH, MAX_WIDTH // 2), Image.LANCZOS)

    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, 'JPEG', quality=88)
    print(f'    OK -> {dest.relative_to(REPO_ROOT)}  ({img.size[0]}x{img.size[1]})')
    frame.unlink(missing_ok=True)
    return True


def get_duration(url):
    """Duree de la video en secondes (ou None)."""
    code, out = run(['yt-dlp', '--no-warnings', '--print', '%(duration)s', url])
    try:
        return float(out.strip().splitlines()[0])
    except (ValueError, IndexError):
        return None


def fetch(url, title, times):
    # Ignore les timestamps au-dela de la duree (sinon ffmpeg echoue en silence).
    duration = get_duration(url)
    if duration:
        kept = []
        for ts in times:
            if to_seconds(ts) + SEGMENT_SECONDS <= duration:
                kept.append(ts)
            else:
                print(f'  (ignore {ts} : au-dela de la duree video {int(duration)}s)')
        times = kept
    if not times:
        print('Aucun timestamp valide pour cette video.', file=sys.stderr)
        return

    print(f'Extraction de {len(times)} panorama(s) pour "{title}"\n')
    ok = 0
    with tempfile.TemporaryDirectory() as tmp:
        for i, ts in enumerate(times, 1):
            dest = GEO_DIR / f'{title} {i}.jpg'
            print(f'  [{i}/{len(times)}] {ts} ...')
            if extract_one(url, to_seconds(ts), dest, tmp):
                ok += 1
    print(f'\nTermine : {ok}/{len(times)} panorama(s).')
    if ok:
        paths = ", ".join(f"'../Medias/Geo/{title} {i}.jpg'" for i in range(1, ok + 1))
        print(f"\nDeclare dans gamesDatabase.js (jeu \"{title}\") :\n    geo: [{paths}]")


def main():
    p = argparse.ArgumentParser(description='Panoramas 360° de jeux depuis YouTube (mode Geo)')
    p.add_argument('--search', metavar='REQUETE', help='Cherche des videos 360 candidates (ne telecharge rien)')
    p.add_argument('--url', help='URL de la video YouTube 360°')
    p.add_argument('--title', help='Titre du jeu (= champ title de gamesDatabase.js)')
    p.add_argument('--times', nargs='+', default=['00:20'],
                   help='Timestamps a extraire (ex: 00:20 01:10 02:30). Defaut: 00:20')
    args = p.parse_args()

    if args.search:
        search(args.search)
        return
    if not args.url or not args.title:
        p.error('Fournis --search REQUETE, ou --url URL --title "Titre" [--times ...]')
    fetch(args.url, args.title, args.times)


if __name__ == '__main__':
    main()
