import re, os, requests, warnings, urllib3, ctypes, io
import tkinter as tk
from tkinter import ttk
from PIL import Image, ImageTk
from duckduckgo_search import DDGS
from rembg import remove

# --- CONFIGURATION & SILENCE ---
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
warnings.filterwarnings("ignore")

input_file = 'gamesDatabase.js'
output_folder = 'personnages_originaux'
headers = {"User-Agent": "Mozilla/5.0"}

if not os.path.exists(output_folder):
    os.makedirs(output_folder)

class ImageSelector:
    def __init__(self, game_title, mode, has_pending=False):
        self.root = tk.Tk()
        self.root.title(f"{game_title} ({mode})")
        
        # --- FOCUS ET PRIORITE ---
        self.root.attributes("-topmost", True)
        self.root.focus_force()
        self.root.after(100, lambda: self.root.focus_force())
        
        self.choice = "n"
        
        # --- RACCOURCIS CLAVIER (Utilisation de bind_all pour plus de robustesse) ---
        # Garder (O ou Enter)
        self.root.bind_all('o', self.set_keep)
        self.root.bind_all('<Return>', self.set_keep)   # Touche Entrée principale
        self.root.bind_all('<KP_Enter>', self.set_keep) # Touche Entrée pavé num.
        
        # Suivante (N ou Delete/Backspace)
        self.root.bind_all('n', self.set_next)
        self.root.bind_all('<Delete>', self.set_next)   # Touche Suppr
        self.root.bind_all('<BackSpace>', self.set_next) # Touche Retour arrière
        
        # Marquer (M ou Shift)
        self.root.bind_all('m', self.set_maybe)
        self.root.bind_all('<Shift_L>', self.set_maybe)
        self.root.bind_all('<Shift_R>', self.set_maybe)
        
        # Passer le jeu (P ou Echap)
        self.root.bind_all('p', self.set_skip)
        self.root.bind_all('<Escape>', self.set_skip)
        
        # Valider la marquée (V)
        if has_pending:
            self.root.bind_all('v', self.set_use_marked)

        # Interface Graphique
        frame_top = tk.Frame(self.root)
        frame_top.pack(padx=10, pady=5)
        
        status_text = "⭐ Image en mémoire (Touche 'V' pour valider)" if has_pending else "Aucune image marquée"
        color = "#2e7d32" if has_pending else "#c62828"
        tk.Label(frame_top, text=status_text, fg=color, font=("Arial", 10, "bold")).pack()
        
        self.lbl_img = tk.Label(self.root)
        self.lbl_img.pack(padx=10, pady=10)
        
        btn_frame = tk.Frame(self.root)
        btn_frame.pack(pady=10)
        
        # Boutons d'aide visuelle
        ttk.Button(btn_frame, text="GARDER [O/Enter]", command=self.set_keep).grid(row=0, column=0, padx=5)
        ttk.Button(btn_frame, text="MARQUER [M/Shift]", command=self.set_maybe).grid(row=0, column=1, padx=5)
        ttk.Button(btn_frame, text="SUIVANTE [N/Suppr]", command=self.set_next).grid(row=0, column=2, padx=5)
        
        if has_pending:
            btn_use_marked = tk.Button(btn_frame, text="✅ PRENDRE LA MARQUÉE [V]", 
                                    bg="#4CAF50", fg="white", command=self.set_use_marked)
            btn_use_marked.grid(row=1, column=0, columnspan=2, sticky="nsew", pady=5, padx=5)
        
        ttk.Button(btn_frame, text="PASSER LE JEU [P/Echap]", command=self.set_skip).grid(row=1, column=2, sticky="nsew", pady=5, padx=5)

    def display(self, pil_image):
        pil_image.thumbnail((500, 500))
        img_tk = ImageTk.PhotoImage(pil_image)
        self.lbl_img.config(image=img_tk)
        self.lbl_img.image = img_tk
        self.root.mainloop()
        return self.choice

    def set_keep(self, event=None): self.choice = "o"; self.root.destroy()
    def set_maybe(self, event=None): self.choice = "m"; self.root.destroy()
    def set_next(self, event=None): self.choice = "n"; self.root.destroy()
    def set_use_marked(self, event=None): self.choice = "um"; self.root.destroy()
    def set_skip(self, event=None): self.choice = "s"; self.root.destroy()

# --- RESTE DU CODE (Même logique de recherche) ---
def sanitize_filename(filename):
    return re.sub(r'[\\/*?:"<>|]', "", filename)

def save_image(data, game_title, is_large):
    path = os.path.join(output_folder, f"{sanitize_filename(game_title)}.png")
    if is_large:
        print(f"🤖 IA : Détourage en cours...")
        with open(path, 'wb') as f: f.write(remove(data))
    else:
        with open(path, 'wb') as f: f.write(data)
    print(f"✨ Sauvegardé : {game_title}")

def search_loop(game_title, query, mode, ddgs):
    print(f"   Recherche : {query}")
    pending_data = None
    try:
        type_img = "transparent" if mode == "PRECIS" else None
        results = list(ddgs.images(keywords=query, region="wt-wt", max_results=15, type_image=type_img))
        for res in results:
            try:
                resp = requests.get(res['image'], headers=headers, timeout=5, verify=False)
                if resp.status_code != 200: continue
                pil_img = Image.open(io.BytesIO(resp.content))
                selector = ImageSelector(game_title, mode, has_pending=(pending_data is not None))
                choice = selector.display(pil_img)
                if choice == "o":
                    save_image(resp.content, game_title, mode == "LARGE")
                    return "saved"
                elif choice == "m":
                    pending_data = resp.content
                    continue 
                elif choice == "um":
                    save_image(pending_data, game_title, mode == "LARGE")
                    return "saved"
                elif choice == "s": return "skip"
                elif choice == "n": continue
            except: continue
    except: pass
    if pending_data:
        save_image(pending_data, game_title, mode == "LARGE")
        return "saved"
    return "next"

def manage_game(game_title, ddgs):
    clean_name = sanitize_filename(game_title)
    path = os.path.join(output_folder, f"{clean_name}.png")
    if os.path.exists(path): return
    print(f"\n>>> JEU : {game_title}")
    status = search_loop(game_title, f"{game_title} character render png", "PRECIS", ddgs)
    if status in ["next"]:
        search_loop(game_title, f"{game_title} official artwork", "LARGE", ddgs)

if __name__ == "__main__":
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            titles = re.findall(r'title\s*:\s*["\'](.*?)["\']', f.read())
        print(f"Initialisation de {len(titles)} jeux.")
        with DDGS() as ddgs:
            for t in titles: manage_game(t, ddgs)
        print("\nBase de données mise à jour !")
    except Exception as e:
        print(f"Erreur fatale : {e}")