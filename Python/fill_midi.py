"""
Python/fill_midi.py — Compléter les MIDI manquants en semi-auto

Workflow :
  1. Le script scanne `gamesDatabase.js` et identifie les jeux dont le
     fichier .mid déclaré n'existe pas sur disque.
  2. Une fenêtre Tkinter affiche un jeu à la fois.
  3. Bouton "🔍 Rechercher" → ouvre Google avec une recherche optimisée
     ("<titre>" midi vgmusic) qui pointe sur les sites de référence
     (vgmusic.com, khinsider, zophar, midimelody...).
  4. Tu télécharges le .mid dans ton dossier Téléchargements.
  5. Bouton "📁 Charger" → file dialog → tu sélectionnes le .mid.
  6. Le script renomme + copie vers Medias/Midi/<Title>.mid.
  7. Auto-avance au suivant.
  8. Bouton "⏭ Passer" si tu ne trouves pas.

Usage :
    cd Python && python fill_midi.py
"""

import re
import sys
import shutil
import webbrowser
import urllib.parse
from pathlib import Path
import tkinter as tk
from tkinter import ttk, filedialog

REPO_ROOT = Path(__file__).resolve().parent.parent
GAMES_DB_PATH = REPO_ROOT / 'JS' / 'gamesDatabase.js'
MIDI_DIR = REPO_ROOT / 'Medias' / 'Midi'

# Parseur JS-aware (gère les apostrophes échappées dans les titres comme
# "Five Night at Freddy\'s") — repris de check_assets.py
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


def find_missing_midis(games):
    """Retourne la liste des jeux dont le .mid declare n'existe pas sur disque."""
    missing = []
    for game in games:
        midi_paths = [p for p in game['paths'] if '/Midi/' in p]
        if not midi_paths:
            continue
        midi_path = midi_paths[0]
        abs_path = REPO_ROOT / midi_path.replace('../', '', 1)
        if not abs_path.exists():
            missing.append({
                'title': game['title'],
                'expected_path': abs_path,
                'filename': abs_path.name,
            })
    return missing


class MidiFiller:
    """Fenêtre Tkinter de remplissage semi-auto."""

    def __init__(self, missing):
        self.missing = missing
        self.index = 0
        self.completed = 0
        self.skipped = 0

        self.root = tk.Tk()
        self.root.title('Compléter les MIDI manquants - GTG')
        self.root.geometry('560x340')
        self.root.attributes('-topmost', True)

        # Header avec compteur
        self.counter_label = tk.Label(self.root, text='', font=('Arial', 10), fg='#888')
        self.counter_label.pack(pady=(15, 5))

        # Titre du jeu en cours
        self.title_label = tk.Label(
            self.root, text='', font=('Arial', 18, 'bold'),
            fg='#1565c0', wraplength=520, justify='center'
        )
        self.title_label.pack(pady=10)

        # Nom du fichier attendu
        self.filename_label = tk.Label(
            self.root, text='', font=('Courier', 10), fg='#444'
        )
        self.filename_label.pack(pady=(0, 15))

        # Boutons
        btn_frame = tk.Frame(self.root)
        btn_frame.pack(pady=10)

        self.btn_search = ttk.Button(
            btn_frame, text='🔍  Rechercher sur Google', command=self.open_search
        )
        self.btn_search.grid(row=0, column=0, padx=5, pady=3, sticky='ew')

        self.btn_load = ttk.Button(
            btn_frame, text='📁  Charger le .mid téléchargé', command=self.load_file
        )
        self.btn_load.grid(row=0, column=1, padx=5, pady=3, sticky='ew')

        self.btn_skip = ttk.Button(
            btn_frame, text='⏭   Passer ce jeu', command=self.skip
        )
        self.btn_skip.grid(row=1, column=0, columnspan=2, padx=5, pady=3, sticky='ew')

        # Statut / feedback
        self.status_label = tk.Label(
            self.root, text='', font=('Arial', 10), fg='blue',
            wraplength=520, justify='center'
        )
        self.status_label.pack(pady=15)

        # Raccourcis clavier
        self.root.bind('<Return>', lambda e: self.load_file())
        self.root.bind('<space>', lambda e: self.open_search())
        self.root.bind('<Escape>', lambda e: self.skip())

        self.update_ui()

    def update_ui(self):
        if self.index >= len(self.missing):
            self._show_done()
            return

        current = self.missing[self.index]
        self.title_label.config(text=current['title'])
        self.filename_label.config(text=f'Fichier attendu : {current["filename"]}')
        self.counter_label.config(
            text=f'Jeu {self.index + 1} / {len(self.missing)}   |   '
                 f'Complétés : {self.completed}   |   Passés : {self.skipped}'
        )
        self.status_label.config(
            text='Espace = Recherche Google   |   Entrée = Charger fichier   |   Échap = Passer',
            fg='#888'
        )

    def _show_done(self):
        self.title_label.config(text='✅ Terminé !')
        self.filename_label.config(text='')
        self.counter_label.config(
            text=f'{len(self.missing)} jeu(x) parcouru(s)   |   '
                 f'Complétés : {self.completed}   |   Passés : {self.skipped}'
        )
        self.status_label.config(
            text='Tu peux fermer cette fenêtre. Relance check_assets.py pour vérifier.',
            fg='green'
        )
        self.btn_search.config(state='disabled')
        self.btn_load.config(state='disabled')
        self.btn_skip.config(state='disabled')

    def open_search(self):
        if self.index >= len(self.missing):
            return
        current = self.missing[self.index]
        query = f'"{current["title"]}" midi vgmusic OR khinsider OR zophar'
        url = f'https://www.google.com/search?q={urllib.parse.quote(query)}'
        webbrowser.open(url)
        self.status_label.config(
            text='🔍 Recherche ouverte dans le navigateur. Télécharge le .mid puis clique "Charger".',
            fg='blue'
        )

    def load_file(self):
        if self.index >= len(self.missing):
            return
        current = self.missing[self.index]
        path = filedialog.askopenfilename(
            title=f'Sélectionne le MIDI pour {current["title"]}',
            filetypes=[('MIDI files', '*.mid *.midi'), ('All files', '*.*')],
            initialdir=str(Path.home() / 'Downloads'),
        )
        if not path:
            return

        # Vérification basique
        src = Path(path)
        if not src.exists() or src.stat().st_size == 0:
            self.status_label.config(text='❌ Fichier introuvable ou vide.', fg='red')
            return

        # Copie + rename
        dest = current['expected_path']
        dest.parent.mkdir(parents=True, exist_ok=True)
        try:
            shutil.copy2(src, dest)
        except Exception as e:
            self.status_label.config(text=f'❌ Erreur copie : {e}', fg='red')
            return

        self.status_label.config(text=f'✅ Copié vers {dest.name}', fg='green')
        self.completed += 1
        self.index += 1
        # Petit délai avant d'afficher le suivant pour que tu voies le succès
        self.root.after(700, self.update_ui)

    def skip(self):
        if self.index >= len(self.missing):
            return
        self.skipped += 1
        self.index += 1
        self.update_ui()

    def run(self):
        self.root.mainloop()


def main():
    if not GAMES_DB_PATH.exists():
        print(f'ERREUR : {GAMES_DB_PATH} introuvable.', file=sys.stderr)
        sys.exit(1)

    text = GAMES_DB_PATH.read_text(encoding='utf-8')
    games = parse_games(text)
    missing = find_missing_midis(games)

    if not missing:
        print('Aucun MIDI manquant ! Tu peux fermer.')
        return

    print(f'{len(missing)} MIDI(s) manquant(s). Ouverture de l\'interface...')
    for m in missing:
        print(f'  - {m["title"]}  →  {m["filename"]}')

    MIDI_DIR.mkdir(parents=True, exist_ok=True)
    app = MidiFiller(missing)
    app.run()


if __name__ == '__main__':
    main()
