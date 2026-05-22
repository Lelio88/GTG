"""
Python/fill_sound.py — Combler les sons MP3 manquants en semi-auto

Similaire a fill_midi.py mais pour les sons : pour chaque jeu, 3 slots
(1, 2, 3) — le script detecte les slots manquants individuellement et
te les fait combler un par un via Tkinter.

Workflow :
  1. Scanne gamesDatabase.js + Medias/Sound/ -> liste les slots manquants
  2. UI Tkinter slot par slot avec :
     - Titre du jeu en cours
     - Numero du slot (1/3, 2/3 ou 3/3)
     - Bouton 'Rechercher OST' -> ouvre YouTube avec query optimisee
     - Bouton 'Charger MP3' -> file dialog -> copie + renomme
     - Bouton 'Skip ce slot' (si introuvable)
     - Bouton 'Skip ce jeu' (saute les 3 slots du jeu courant d'un coup)
  3. Optionnel : applique la normalisation EBU R128 -16 LUFS apres chaque
     chargement (--normalize) -> evite de relancer normalize_sounds.py

Usage :
    cd Python && python fill_sound.py
    cd Python && python fill_sound.py --normalize   (normalise apres copie)

Prerequis :
    - Python 3 + Tkinter (stdlib)
    - Pour --normalize : ffmpeg + ffmpeg-normalize (pip install ffmpeg-normalize)
"""

import re
import sys
import shutil
import subprocess
import webbrowser
import urllib.parse
import argparse
from pathlib import Path
import tkinter as tk
from tkinter import ttk, filedialog

REPO_ROOT = Path(__file__).resolve().parent.parent
GAMES_DB_PATH = REPO_ROOT / 'JS' / 'gamesDatabase.js'
SOUND_DIR = REPO_ROOT / 'Medias' / 'Sound'

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


def find_missing_sounds(games):
    """Liste les slots sound manquants (1 entree par fichier manquant)."""
    missing = []
    for game in games:
        sound_paths = sorted(p for p in game['paths'] if '/Sound/' in p)
        for path in sound_paths:
            abs_path = REPO_ROOT / path.replace('../', '', 1)
            if not abs_path.exists():
                missing.append({
                    'title': game['title'],
                    'expected_path': abs_path,
                    'filename': abs_path.name,
                })
    return missing


def normalize_inplace(mp3_path):
    """Applique EBU R128 -16 LUFS sur le fichier (in-place via temp)."""
    tmp = mp3_path.with_suffix('.normalizing.mp3')
    cmd = [
        'ffmpeg-normalize', str(mp3_path),
        '-o', str(tmp),
        '-t', '-16', '-tp', '-1.5',
        '-c:a', 'libmp3lame', '-b:a', '192k',
        '-f', '-pr',
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    except FileNotFoundError:
        return False, "ffmpeg-normalize introuvable (pip install ffmpeg-normalize)"
    except subprocess.TimeoutExpired:
        if tmp.exists():
            tmp.unlink()
        return False, 'timeout'
    if result.returncode != 0 or not tmp.exists() or tmp.stat().st_size == 0:
        if tmp.exists():
            tmp.unlink()
        err = (result.stderr or '').strip().split('\n')[-1] if result.stderr else 'erreur inconnue'
        return False, err
    shutil.move(str(tmp), str(mp3_path))
    return True, None


class SoundFiller:
    def __init__(self, missing, normalize):
        self.missing = missing
        self.normalize = normalize
        self.index = 0
        self.completed = 0
        self.skipped = 0

        self.root = tk.Tk()
        self.root.title('Completer les sons manquants - GTG')
        self.root.geometry('600x400')
        self.root.attributes('-topmost', True)

        # Header avec compteur
        self.counter_label = tk.Label(self.root, text='', font=('Arial', 10), fg='#888')
        self.counter_label.pack(pady=(15, 5))

        # Titre du jeu en cours
        self.title_label = tk.Label(
            self.root, text='', font=('Arial', 17, 'bold'),
            fg='#1565c0', wraplength=560, justify='center'
        )
        self.title_label.pack(pady=8)

        # Slot
        self.slot_label = tk.Label(self.root, text='', font=('Arial', 13), fg='#444')
        self.slot_label.pack(pady=(0, 5))

        # Nom du fichier attendu
        self.filename_label = tk.Label(self.root, text='', font=('Courier', 10), fg='#666')
        self.filename_label.pack(pady=(0, 12))

        # Boutons (grille 2x2)
        btn_frame = tk.Frame(self.root)
        btn_frame.pack(pady=8)

        self.btn_search = ttk.Button(btn_frame, text='[F]  Rechercher OST sur YouTube',
                                     command=self.open_search, width=30)
        self.btn_search.grid(row=0, column=0, padx=5, pady=3)

        self.btn_load = ttk.Button(btn_frame, text='[L]  Charger MP3 telecharge',
                                   command=self.load_file, width=30)
        self.btn_load.grid(row=0, column=1, padx=5, pady=3)

        self.btn_skip_slot = ttk.Button(btn_frame, text='[S]  Skip ce slot',
                                        command=self.skip_slot, width=30)
        self.btn_skip_slot.grid(row=1, column=0, padx=5, pady=3)

        self.btn_skip_game = ttk.Button(btn_frame, text='[G]  Skip ce jeu entier',
                                        command=self.skip_game, width=30)
        self.btn_skip_game.grid(row=1, column=1, padx=5, pady=3)

        # Status / feedback
        self.status_label = tk.Label(
            self.root, text='', font=('Arial', 10), fg='blue',
            wraplength=560, justify='center'
        )
        self.status_label.pack(pady=15)

        # Raccourcis clavier
        self.root.bind('<Return>', lambda e: self.load_file())
        self.root.bind('<space>', lambda e: self.open_search())
        self.root.bind('<Escape>', lambda e: self.skip_slot())
        self.root.bind('<f>', lambda e: self.open_search())
        self.root.bind('<l>', lambda e: self.load_file())
        self.root.bind('<s>', lambda e: self.skip_slot())
        self.root.bind('<g>', lambda e: self.skip_game())

        self.update_ui()

    def update_ui(self):
        if self.index >= len(self.missing):
            self._show_done()
            return
        current = self.missing[self.index]
        # Extrait le numero du slot depuis le filename, e.g. "BioShock 1.mp3" -> 1
        m = re.search(r' (\d+)\.mp3$', current['filename'])
        slot = m.group(1) if m else '?'
        self.title_label.config(text=current['title'])
        self.slot_label.config(text=f'Extrait {slot} / 3')
        self.filename_label.config(text=f'Fichier attendu : {current["filename"]}')
        self.counter_label.config(
            text=f'Slot {self.index + 1} / {len(self.missing)}   |   '
                 f'Telecharges : {self.completed}   |   Skipped : {self.skipped}'
        )
        self.status_label.config(
            text='F = Recherche | L = Charger | S = Skip slot | G = Skip jeu entier',
            fg='#888'
        )

    def _show_done(self):
        self.title_label.config(text='[OK] Termine !')
        self.slot_label.config(text='')
        self.filename_label.config(text='')
        self.counter_label.config(
            text=f'{len(self.missing)} slot(s) parcouru(s)   |   '
                 f'Telecharges : {self.completed}   |   Skipped : {self.skipped}'
        )
        self.status_label.config(
            text='Relance check_assets.py pour verifier le total.',
            fg='green'
        )
        self.btn_search.config(state='disabled')
        self.btn_load.config(state='disabled')
        self.btn_skip_slot.config(state='disabled')
        self.btn_skip_game.config(state='disabled')

    def open_search(self):
        if self.index >= len(self.missing):
            return
        current = self.missing[self.index]
        query = f'{current["title"]} OST official soundtrack theme'
        url = f'https://www.youtube.com/results?search_query={urllib.parse.quote(query)}'
        webbrowser.open(url)
        self.status_label.config(
            text='YouTube ouvert. Telecharge le MP3 (yt-dlp / ytmp3.cc / etc.) puis clique Charger.',
            fg='blue'
        )

    def load_file(self):
        if self.index >= len(self.missing):
            return
        current = self.missing[self.index]
        path = filedialog.askopenfilename(
            title=f'MP3 pour {current["title"]} (slot {current["filename"]})',
            filetypes=[('Audio', '*.mp3 *.m4a *.ogg *.wav *.opus'), ('All files', '*.*')],
            initialdir=str(Path.home() / 'Downloads'),
        )
        if not path:
            return

        src = Path(path)
        if not src.exists() or src.stat().st_size == 0:
            self.status_label.config(text='[KO] Fichier introuvable ou vide.', fg='red')
            return

        dest = current['expected_path']
        dest.parent.mkdir(parents=True, exist_ok=True)
        try:
            shutil.copy2(src, dest)
        except Exception as e:
            self.status_label.config(text=f'[KO] Erreur copie : {e}', fg='red')
            return

        if self.normalize:
            self.status_label.config(text='Normalisation en cours...', fg='blue')
            self.root.update()
            ok, err = normalize_inplace(dest)
            if ok:
                self.status_label.config(text=f'[OK] {dest.name} (normalise -16 LUFS)', fg='green')
            else:
                self.status_label.config(
                    text=f'[OK] {dest.name} (copie OK, normalisation echec: {err})',
                    fg='orange'
                )
        else:
            self.status_label.config(text=f'[OK] Copie vers {dest.name}', fg='green')

        self.completed += 1
        self.index += 1
        self.root.after(900, self.update_ui)

    def skip_slot(self):
        if self.index >= len(self.missing):
            return
        self.skipped += 1
        self.index += 1
        self.update_ui()

    def skip_game(self):
        """Saute tous les slots restants du jeu courant."""
        if self.index >= len(self.missing):
            return
        current_title = self.missing[self.index]['title']
        while self.index < len(self.missing) and self.missing[self.index]['title'] == current_title:
            self.skipped += 1
            self.index += 1
        self.update_ui()

    def run(self):
        self.root.mainloop()


def main():
    parser = argparse.ArgumentParser(description='Comble les MP3 sons manquants en semi-auto')
    parser.add_argument('--normalize', action='store_true',
                        help='Applique EBU R128 -16 LUFS apres chaque chargement')
    args = parser.parse_args()

    if not GAMES_DB_PATH.exists():
        print(f'ERREUR : {GAMES_DB_PATH} introuvable', file=sys.stderr)
        sys.exit(1)

    text = GAMES_DB_PATH.read_text(encoding='utf-8')
    games = parse_games(text)
    missing = find_missing_sounds(games)

    if not missing:
        print('Aucun MP3 sound manquant ! Catalogue complet.')
        return

    print(f'{len(missing)} slot(s) sound manquant(s).')
    if args.normalize:
        print('Mode normalisation auto : ON (ffmpeg-normalize requis a chaque charge)')
    print('Interface graphique en cours d\'ouverture...')

    SOUND_DIR.mkdir(parents=True, exist_ok=True)
    SoundFiller(missing, args.normalize).run()


if __name__ == '__main__':
    main()
