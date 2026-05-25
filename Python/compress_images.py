#!/usr/bin/env python3
"""
compress_images.py -- Compression batch des images du projet GTG.

Strategie :
  1. Resize : si max(width, height) > MAX_DIM, on reduit a MAX_DIM en gardant
     le ratio. Les jaquettes de jeux ne depassent jamais 1920px d'affiche
     dans l'app, donc on ne perd rien visuellement.
  2. Re-encode :
       - JPG : quality=JPG_QUALITY, optimize=True, progressive=True
       - PNG : optimize=True (Pillow fait un huffman optimum)
                + si AUCUNE transparence reelle, conversion vers JPG
                  (gain massif, on garde l'extension du fichier appele).
  3. Strip metadata EXIF (souvent 50-200 KB inutiles).

On n'ECRASE le fichier source que si gain >= MIN_GAIN_PCT.
Sinon on laisse tel quel (image deja optimisee).

Sortie : tableau de chiffres avant/apres, total final.

Usage :
    cd Python
    python compress_images.py --dry-run            # voir le rapport sans ecrire
    python compress_images.py                       # ecrase si gain >= 20%
    python compress_images.py --path ../Assets      # seulement un dossier
    python compress_images.py --min-gain 30         # seuil personnalise

Le script est idempotent : ne re-touche pas une image deja serree.
"""

from __future__ import annotations

import argparse
import io
import sys
from pathlib import Path
from typing import Iterable

try:
    from PIL import Image
except ImportError:
    print("ERREUR : Pillow n'est pas installe. pip install -r requirements.txt", file=sys.stderr)
    sys.exit(1)

# === CONFIGURATION ===
REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DIRS = [
    REPO_ROOT / "Assets",
    REPO_ROOT / "Medias" / "Image",
    REPO_ROOT / "Medias" / "Shadow",
    REPO_ROOT / "Medias" / "Pixels",
    REPO_ROOT / "Medias" / "Text",
]

# Dimension max (largeur OU hauteur, ratio preserve)
MAX_DIM = 1920

# JPG quality 85 = sweet spot taille/qualite, indiscernable visuellement
JPG_QUALITY = 85

# Seuil minimum de gain pour ecraser le fichier (en %)
DEFAULT_MIN_GAIN_PCT = 20

# Extensions traitees
IMAGE_EXTS = {".png", ".jpg", ".jpeg"}


def iter_images(root: Path) -> Iterable[Path]:
    """Genere recursivement tous les fichiers image sous root."""
    if not root.exists():
        return
    for p in root.rglob("*"):
        if p.is_file() and p.suffix.lower() in IMAGE_EXTS:
            yield p


def has_real_transparency(img: Image.Image) -> bool:
    """Detecte si l'image a des pixels reellement transparents (alpha < 255).
    Une image en mode RGBA mais 100% opaque retourne False (on peut la
    convertir en JPG sans perdre d'info)."""
    if img.mode not in ("RGBA", "LA", "P"):
        return False
    if img.mode == "P":
        # Palette : verifier si elle a un index transparent
        return "transparency" in img.info
    # Mode RGBA / LA : verifier alpha
    alpha = img.getchannel("A")
    return alpha.getextrema()[0] < 255


def compress_one(src: Path, min_gain_pct: int, jpg_quality: int, dry_run: bool) -> tuple[int, int, str]:
    """Compresse une image. Retourne (avant, apres, status_message).
    apres == avant si on n'a pas reecrit (gain insuffisant ou erreur)."""
    before = src.stat().st_size

    try:
        with Image.open(src) as img:
            img.load()
            orig_mode = img.mode
            ext = src.suffix.lower()

            # 1. Resize si trop grand
            w, h = img.size
            if max(w, h) > MAX_DIM:
                ratio = MAX_DIM / max(w, h)
                new_size = (int(w * ratio), int(h * ratio))
                img = img.resize(new_size, Image.LANCZOS)

            # 2. Decide du format de sortie
            #    - Si l'extension est .jpg/.jpeg : on garde JPG (et on convertit le mode si besoin)
            #    - Si l'extension est .png :
            #         - transparence reelle -> garde PNG
            #         - sinon -> garde PNG (on n'a pas le droit de changer
            #           l'extension sans casser les references dans gamesDatabase.js)
            buf = io.BytesIO()

            if ext in (".jpg", ".jpeg"):
                if img.mode != "RGB":
                    img = img.convert("RGB")
                img.save(buf, format="JPEG", quality=jpg_quality, optimize=True, progressive=True)
            else:  # .png
                if has_real_transparency(img):
                    # On garde PNG avec optimize
                    if img.mode == "P":
                        img.save(buf, format="PNG", optimize=True)
                    else:
                        img.save(buf, format="PNG", optimize=True)
                else:
                    # Pas de transparence reelle : PNG optimize (on reste en PNG
                    # pour preserver l'extension dans les references JS).
                    # Convertir en RGB d'abord supprime le canal alpha inutile.
                    if img.mode != "RGB":
                        img = img.convert("RGB")
                    img.save(buf, format="PNG", optimize=True)
    except Exception as exc:
        return before, before, f"ERREUR lecture/encode : {exc}"

    after = len(buf.getvalue())
    if after >= before:
        return before, before, "deja optimise (re-encode plus gros)"

    gain_pct = (1 - after / before) * 100
    if gain_pct < min_gain_pct:
        return before, before, f"gain {gain_pct:.1f}% < seuil {min_gain_pct}%"

    if dry_run:
        return before, after, f"DRY-RUN : gain {gain_pct:.1f}%"

    # Ecriture atomique : on ecrit dans un .tmp puis on renomme
    tmp = src.with_suffix(src.suffix + ".tmp")
    tmp.write_bytes(buf.getvalue())
    tmp.replace(src)
    return before, after, f"compresse, gain {gain_pct:.1f}%"


def fmt_size(n: int) -> str:
    if n >= 1024 * 1024:
        return f"{n / (1024 * 1024):.1f} MB"
    if n >= 1024:
        return f"{n / 1024:.1f} KB"
    return f"{n} B"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--path",
        type=Path,
        action="append",
        help="Dossier(s) a traiter. Repetable. Defaut : Assets + Medias/*.",
    )
    parser.add_argument(
        "--min-gain",
        type=int,
        default=DEFAULT_MIN_GAIN_PCT,
        help=f"Seuil de gain en %% pour ecraser (defaut : {DEFAULT_MIN_GAIN_PCT}).",
    )
    parser.add_argument(
        "--quality",
        type=int,
        default=JPG_QUALITY,
        help=f"Quality JPG (1-100). Defaut : {JPG_QUALITY}. 90+ = perte indetectable meme au zoom.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Ne touche pas les fichiers, juste un rapport.",
    )
    args = parser.parse_args()

    roots = args.path if args.path else DEFAULT_DIRS

    total_before = 0
    total_after = 0
    touched = 0
    skipped = 0
    errored = 0

    print(f"{'Fichier':<60} {'Avant':>10}  {'Apres':>10}  {'Gain':>6}  Statut")
    print("-" * 110)
    for root in roots:
        for src in sorted(iter_images(root)):
            rel = src.relative_to(REPO_ROOT) if src.is_relative_to(REPO_ROOT) else src
            before, after, status = compress_one(src, args.min_gain, args.quality, args.dry_run)
            total_before += before
            total_after += after
            if "ERREUR" in status:
                errored += 1
            elif after < before:
                touched += 1
            else:
                skipped += 1
            gain = (1 - after / before) * 100 if before > 0 else 0
            print(f"{str(rel):<60} {fmt_size(before):>10}  {fmt_size(after):>10}  {gain:>5.1f}%  {status}")

    print("-" * 110)
    total_gain = (1 - total_after / total_before) * 100 if total_before > 0 else 0
    print(f"{'TOTAL':<60} {fmt_size(total_before):>10}  {fmt_size(total_after):>10}  {total_gain:>5.1f}%")
    print()
    print(f"  Compresses : {touched}")
    print(f"  Skippes    : {skipped}")
    print(f"  Erreurs    : {errored}")
    if args.dry_run:
        print()
        print("Mode DRY-RUN : aucun fichier modifie. Relance sans --dry-run pour appliquer.")
    return 0 if errored == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
