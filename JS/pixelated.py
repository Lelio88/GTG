import re, os, requests, warnings, urllib3, io
import tkinter as tk
from tkinter import ttk
from PIL import Image, ImageTk
from duckduckgo_search import DDGS

# Note : J'ai retiré 'rembg' car on ne détoure pas une pochette (c'est un rectangle).

# --- CONFIGURATION & SILENCE ---
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
warnings.filterwarnings("ignore")

input_file = 'gamesDatabase.js'
output_folder = 'pochettes_jeux'  # Nouveau dossier de sortie
headers = {"User-Agent": "Mozilla/5.0"}

if not os.path.exists(output_folder):
    os.makedirs(output_folder)

class ImageSelector:
    def __init__(self, game_title, mode, has_pending=False):
        self.root = tk.Tk()
        self.root.title(f"{game_title} - Recherche : {mode}")
        
        # --- FOCUS ET PRIORITE ---
        self.root.attributes("-topmost", True)
        self.root.focus_force()
        self.root.after(100, lambda: self.root.focus_force())
        
        self.choice = "n"
        
        # --- RACCOURCIS CLAVIER ---
        self.root.bind_all('o', self.set_keep)
        self.root.bind_all('<Return>', self.set_keep)
        self.root.bind_all('<KP_Enter>', self.set_keep)
        
        self.root.bind_all('n', self.set_next)
        self.root.bind_all('<Delete>', self.set_next)
        self.root.bind_all('<BackSpace>', self.set_next)
        
        self.root.bind_all('m', self.set_maybe)
        self.root.bind_all('<Shift_L>', self.set_maybe)
        self.root.bind_all('<Shift_R>', self.set_maybe)
        
        self.root.bind_all('p', self.set_skip)
        self.root.bind_all('<Escape>', self.set_skip)
        
        if has_pending:
            self.root.bind_all('v', self.set_use_marked)

        # Interface Graphique
        frame_top = tk.Frame(self.root)
        frame_top.pack(padx=10, pady=5)
        
        status_text = "⭐ Image en mémoire (Touche 'V')" if has_pending else "Aucune image marquée"
        color = "#2e7d32" if has_pending else "#c62828"
        tk.Label(frame_top, text=status_text, fg=color, font=("Arial", 10, "bold")).pack()
        
        self.lbl_img = tk.Label(self.root)
        self.lbl_img.pack(padx=10, pady=10)
        
        btn_frame = tk.Frame(self.root)
        btn_frame.pack(pady=10)
        
        ttk.Button(btn_frame, text="GARDER [O/Enter]", command=self.set_keep).grid(row=0, column=0, padx=5)
        ttk.Button(btn_frame, text="MARQUER [M/Shift]", command=self.set_maybe).grid(row=0, column=1, padx=5)
        ttk.Button(btn_frame, text="SUIVANTE [N/Suppr]", command=self.set_next).grid(row=0, column=2, padx=5)
        
        if has_pending:
            btn_use_marked = tk.Button(btn_frame, text="✅ PRENDRE LA MARQUÉE [V]", 
                                    bg="#4CAF50", fg="white", command=self.set_use_marked)
            btn_use_marked.grid(row=1, column=0, columnspan=2, sticky="nsew", pady=5, padx=5)
        
        ttk.Button(btn_frame, text="PASSER LE JEU [P/Echap]", command=self.set_skip).grid(row=1, column=2, sticky="nsew", pady=5, padx=5)

    def display(self, pil_image):
        # Redimensionnement pour l'affichage uniquement (les pochettes sont verticales)
        pil_image.thumbnail((400, 600)) 
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

# --- LOGIQUE DE RECHERCHE ---
def sanitize_filename(filename):
    return re.sub(r'[\\/*?:"<>|]', "", filename)

def save_image(data, game_title):
    # Sauvegarde directe sans détourage
    path = os.path.join(output_folder, f"{sanitize_filename(game_title)}.png") # Ou .jpg si vous préférez
    with open(path, 'wb') as f: f.write(data)
    print(f"✨ Sauvegardé : {game_title}")

def search_loop(game_title, query, ddgs):
    print(f"   Recherche : {query}")
    pending_data = None
    try:
        # On ne demande plus type_image="transparent", on prend tout
        results = list(ddgs.images(keywords=query, region="wt-wt", max_results=15))
        
        for res in results:
            try:
                resp = requests.get(res['image'], headers=headers, timeout=5, verify=False)
                if resp.status_code != 200: continue
                
                pil_img = Image.open(io.BytesIO(resp.content))
                
                # --- FILTRE OPTIONNEL : RATIO ---
                # Les pochettes sont souvent verticales (Portrait). 
                # On peut ignorer les images trop larges si on veut, 
                # mais je laisse le choix à l'utilisateur pour l'instant.
                
                selector = ImageSelector(game_title, query, has_pending=(pending_data is not None))
                choice = selector.display(pil_img)
                
                if choice == "o":
                    save_image(resp.content, game_title)
                    return "saved"
                elif choice == "m":
                    pending_data = resp.content
                    continue 
                elif choice == "um":
                    save_image(pending_data, game_title)
                    return "saved"
                elif choice == "s": return "skip"
                elif choice == "n": continue
            except: continue
    except Exception as e: 
        print(f"Erreur recherche : {e}")
        pass
        
    if pending_data:
        save_image(pending_data, game_title)
        return "saved"
    return "next"

def manage_game(game_title, ddgs):
    clean_name = sanitize_filename(game_title)
    # Vérifie si l'image existe déjà en png (ou jpg si vous changez l'extension)
    if os.path.exists(os.path.join(output_folder, f"{clean_name}.png")): return
    
    print(f"\n>>> JEU : {game_title}")
    
    # 1ère tentative : "Box Art" (Terme standard pour jaquette)
    status = search_loop(game_title, f"{game_title} box art high quality", ddgs)
    
    # 2ème tentative : "Cover" si la première échoue ou est passée
    if status in ["next"]:
        status = search_loop(game_title, f"{game_title} official cover", ddgs)

    # 3ème tentative : Juste le titre + key art (souvent utilisé pour les fonds d'écran mais parfois donne de belles jaquettes)
    if status in ["next"]:
        search_loop(game_title, f"{game_title} key art", ddgs)

if __name__ == "__main__":
    try:
        # Assurez-vous que le fichier gamesDatabase.js est au bon endroit
        if not os.path.exists(input_file):
            print(f"Fichier {input_file} introuvable.")
        else:
            with open(input_file, 'r', encoding='utf-8') as f:
                titles = re.findall(r'title\s*:\s*["\'](.*?)["\']', f.read())
            
            print(f"Initialisation de {len(titles)} jeux.")
            with DDGS() as ddgs:
                for t in titles: manage_game(t, ddgs)
            print("\nBase de données mise à jour !")
            
    except Exception as e:
        print(f"Erreur fatale : {e}")