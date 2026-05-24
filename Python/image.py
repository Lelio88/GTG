import re, os, requests, warnings, urllib3, io
from pathlib import Path
import tkinter as tk
from tkinter import ttk
from PIL import Image, ImageTk
from duckduckgo_search import DDGS

# --- CONFIGURATION & SILENCE ---
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
warnings.filterwarnings("ignore")

REPO_ROOT = Path(__file__).resolve().parent.parent
input_file = str(REPO_ROOT / 'JS' / 'gamesDatabase.js')
output_folder = str(Path(__file__).resolve().parent / 'illustrations_jeux')  # Dossier pour les screens
headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"}

if not os.path.exists(output_folder):
    os.makedirs(output_folder)

class ImageSelector:
    def __init__(self, game_title, current_count, total_target=3):
        self.root = tk.Tk()
        # Titre dynamique pour savoir où on en est (1/3, 2/3...)
        self.root.title(f"{game_title} - Sélection Image {current_count}/{total_target}")
        
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
        
        self.root.bind_all('p', self.set_skip)
        self.root.bind_all('<Escape>', self.set_skip)
        
        # Interface Graphique
        frame_top = tk.Frame(self.root)
        frame_top.pack(padx=10, pady=5)
        
        tk.Label(frame_top, text=f"Recherche illustration n°{current_count}", fg="#1565c0", font=("Arial", 11, "bold")).pack()
        
        self.lbl_img = tk.Label(self.root)
        self.lbl_img.pack(padx=10, pady=10)
        
        btn_frame = tk.Frame(self.root)
        btn_frame.pack(pady=10)
        
        ttk.Button(btn_frame, text="GARDER [O/Enter]", command=self.set_keep).grid(row=0, column=0, padx=5)
        ttk.Button(btn_frame, text="SUIVANTE [N/Suppr]", command=self.set_next).grid(row=0, column=1, padx=5)
        ttk.Button(btn_frame, text="PASSER LE JEU [P/Echap]", command=self.set_skip).grid(row=0, column=2, padx=5)

    def display(self, pil_image):
        # Format paysage pour les screens (800x600 max)
        pil_image.thumbnail((800, 600)) 
        img_tk = ImageTk.PhotoImage(pil_image)
        self.lbl_img.config(image=img_tk)
        self.lbl_img.image = img_tk
        self.root.mainloop()
        return self.choice

    def set_keep(self, event=None): self.choice = "o"; self.root.destroy()
    def set_next(self, event=None): self.choice = "n"; self.root.destroy()
    def set_skip(self, event=None): self.choice = "s"; self.root.destroy()

# --- LOGIQUE ---

def sanitize_filename(filename):
    return re.sub(r'[\\/*?:"<>|]', "", filename)

def save_image(data, game_title, number):
    clean_name = sanitize_filename(game_title)
    # Construction du nom : "Jeu 1.jpg", "Jeu 2.jpg", etc.
    filename = f"{clean_name} {number}.jpg"
    path = os.path.join(output_folder, filename)
    
    try:
        image = Image.open(io.BytesIO(data))
        # Conversion forcée en RGB pour le format JPEG (au cas où ce soit un PNG)
        if image.mode in ("RGBA", "P"):
            image = image.convert("RGB")
        
        image.save(path, "JPEG", quality=90)
        print(f"      ✅ Enregistré : {filename}")
        return True
    except Exception as e:
        print(f"      ❌ Erreur sauvegarde : {e}")
        return False

def manage_game(game_title, ddgs):
    clean_name = sanitize_filename(game_title)
    
    # 1. Vérifier combien d'images on a déjà
    current_count = 1
    while current_count <= 3:
        if os.path.exists(os.path.join(output_folder, f"{clean_name} {current_count}.jpg")):
            current_count += 1
        else:
            break
    
    if current_count > 3:
        # Le jeu est déjà complet, on passe silencieusement (ou avec un petit log)
        # print(f"Skipping {game_title} (Complet)")
        return

    print(f"\n🎮 JEU : {game_title} (Début à l'image {current_count}/3)")
    
    # Mots clés variés pour avoir des décors, du gameplay, etc.
    query = f"{game_title} gameplay screenshot environment 4k"
    
    try:
        # On charge un pool d'images
        results = ddgs.images(keywords=query, region="wt-wt", max_results=30)
        
        # On itère sur les résultats
        for res in results:
            if current_count > 3:
                print("      ✨ Jeu terminé (3 images).")
                break
                
            try:
                resp = requests.get(res['image'], headers=headers, timeout=5, verify=False)
                if resp.status_code != 200: continue
                
                pil_img = Image.open(io.BytesIO(resp.content))
                
                # Interface de sélection
                selector = ImageSelector(game_title, current_count)
                choice = selector.display(pil_img)
                
                if choice == "o":
                    # Si on garde, on sauvegarde et on incrémente le compteur
                    if save_image(resp.content, game_title, current_count):
                        current_count += 1
                    # On continue la boucle FOR pour trouver l'image suivante (current_count est à jour)
                    
                elif choice == "s":
                    print("      ⏩ Jeu passé par l'utilisateur.")
                    return # On quitte complètement la fonction du jeu
                
                # Si choix == "n" (Next), on ne fait rien, la boucle for passe à l'image suivante
                
            except Exception as e:
                continue

    except Exception as e:
        print(f"Erreur recherche : {e}")

    # Si on sort de la boucle et qu'on n'a pas 3 images
    if current_count <= 3:
        print(f"      ⚠️ Fin des résultats DuckDuckGo. {current_count-1}/3 images trouvées.")

if __name__ == "__main__":
    try:
        if not os.path.exists(input_file):
            print(f"Fichier {input_file} introuvable.")
        else:
            with open(input_file, 'r', encoding='utf-8') as f:
                titles = re.findall(r'title\s*:\s*["\'](.*?)["\']', f.read())
            
            print(f"Chargement de {len(titles)} jeux...")
            
            with DDGS() as ddgs:
                for t in titles: 
                    manage_game(t, ddgs)
            
            print("\n✅ Terminé ! Toutes les illustrations sont récupérées.")
            
    except Exception as e:
        print(f"Erreur fatale : {e}")