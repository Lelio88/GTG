import re, os, requests, warnings, urllib3, ctypes, io
from pathlib import Path
import tkinter as tk
from tkinter import ttk
from PIL import Image, ImageTk
from duckduckgo_search import DDGS
from rembg import remove

# --- CONFIGURATION & SILENCE ---
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
# On garde les warnings critiques, on ignore juste les warnings SSL
warnings.filterwarnings("ignore", category=urllib3.exceptions.InsecureRequestWarning)

REPO_ROOT = Path(__file__).resolve().parent.parent
input_file = str(REPO_ROOT / 'JS' / 'gamesDatabase.js')
output_folder = str(Path(__file__).resolve().parent / 'personnages_originaux')
headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"}

if not os.path.exists(output_folder):
    os.makedirs(output_folder)

class ImageSelector:
    def __init__(self, game_title, mode, has_pending=False):
        self.root = tk.Tk()
        self.root.title(f"{game_title} ({mode})")
        
        # --- FOCUS ET PRIORITE ---
        self.root.attributes("-topmost", True)
        self.root.focus_force()
        # Force le focus un peu après l'init pour être sûr
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
        
        status_text = "⭐ Image en mémoire (Touche 'V' pour valider)" if has_pending else "Aucune image marquée"
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
        # Redimensionnement pour affichage seulement
        pil_image.thumbnail((600, 600))
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

# --- FONCTIONS UTILITAIRES ---

def sanitize_filename(filename):
    return re.sub(r'[\\/*?:"<>|]', "", filename)

def save_image(data, game_title, need_rembg):
    clean_name = sanitize_filename(game_title)
    path = os.path.join(output_folder, f"{clean_name}.png")
    
    print(f"      💾 Sauvegarde en cours...")
    try:
        if need_rembg:
            print(f"      🤖 IA : Détourage du fond en cours (patience)...")
            output_data = remove(data)
            with open(path, 'wb') as f: f.write(output_data)
        else:
            with open(path, 'wb') as f: f.write(data)
        print(f"      ✨ Succès : {clean_name}.png créé !")
    except Exception as e:
        print(f"      ❌ Erreur lors de la sauvegarde : {e}")

def search_loop(game_title, query, mode, ddgs):
    """
    Retourne : 'saved', 'skip', ou 'next'
    """
    print(f"   🔎 Recherche ({mode}) : {query}")
    pending_data = None # Pour stocker l'image "Marquée"
    
    try:
        # Si mode PRECIS, on préfère les PNG transparents, sinon tout type
        type_img = "transparent" if mode == "PRECIS" else None
        
        # Lancement de la recherche DuckDuckGo
        results = list(ddgs.images(keywords=query, region="wt-wt", max_results=12, type_image=type_img))
        
        if not results:
            print(f"      ⚠️ Aucun résultat trouvé pour cette requête.")
            return "next"
            
        print(f"      -> {len(results)} images trouvées. Chargement...")

        for i, res in enumerate(results):
            try:
                img_url = res['image']
                # Téléchargement
                resp = requests.get(img_url, headers=headers, timeout=4, verify=False)
                
                if resp.status_code != 200:
                    print(f"      ⚠️ Image {i+1}: Erreur HTTP {resp.status_code}")
                    continue
                
                # Vérification que c'est bien une image lisible
                try:
                    pil_img = Image.open(io.BytesIO(resp.content))
                except Exception:
                    print(f"      ⚠️ Image {i+1}: Format non reconnu ou corrompu.")
                    continue

                # --- OUVERTURE DE LA FENETRE ---
                selector = ImageSelector(game_title, mode, has_pending=(pending_data is not None))
                choice = selector.display(pil_img)
                # -------------------------------

                if choice == "o": # Garder (Oui)
                    save_image(resp.content, game_title, mode == "LARGE" or mode == "MANUEL")
                    return "saved"
                
                elif choice == "m": # Marquer (Maybe)
                    pending_data = resp.content
                    print("      -> Image mise en mémoire (Marked).")
                    continue 
                
                elif choice == "um": # Utiliser la marquée
                    save_image(pending_data, game_title, mode == "LARGE" or mode == "MANUEL")
                    return "saved"
                
                elif choice == "s": # Skip le jeu
                    print("      -> Jeu passé par l'utilisateur.")
                    return "skip"
                
                elif choice == "n": # Suivante (Next)
                    continue

            except Exception as e:
                # Erreur de connexion ou autre sur une image spécifique
                # print(f"Debug: {e}") 
                continue

    except Exception as e:
        print(f"   ☠️ Erreur critique recherche : {e}")
        return "next"

    # Si on a fini la boucle et qu'on a une image en mémoire, on la sauvegarde
    if pending_data:
        print("      -> Fin de liste : Sauvegarde de l'image marquée.")
        save_image(pending_data, game_title, mode == "LARGE" or mode == "MANUEL")
        return "saved"
    
    return "next"

def manage_game(game_title, ddgs):
    clean_name = sanitize_filename(game_title)
    path = os.path.join(output_folder, f"{clean_name}.png")
    
    # On saute si déjà fait
    if os.path.exists(path): return

    print(f"\n==========================================")
    print(f"🎮 JEU : {game_title}")
    print(f"==========================================")
    
    # 1. Tentative PRÉCISE (Render propre) - Sans le mot "character" pour inclure les objets/voitures
    status = search_loop(game_title, f"{game_title} render png", "PRECIS", ddgs)
    if status in ["saved", "skip"]: return

    # 2. Tentative LARGE (Artwork/Wallpaper) - Nécessitera détourage
    status = search_loop(game_title, f"{game_title} official artwork", "LARGE", ddgs)
    if status in ["saved", "skip"]: return

    # 3. Tentative SECOURS (Box Art / Logo) - Pour les jeux abstraits
    print("   -> Tentative de secours (Box Art)...")
    status = search_loop(game_title, f"{game_title} box art", "LARGE", ddgs)
    if status in ["saved", "skip"]: return

    # 4. Mode MANUEL (L'utilisateur tape sa recherche)
    while True:
        print(f"\n   ❌ L'IA n'a rien trouvé de concluant pour '{game_title}'.")
        user_query = input(f"   ⌨️  Tape une recherche manuelle (ex: '{game_title} car') ou ENTER pour ignorer : ")
        
        if not user_query.strip():
            print(f"   -> Jeu '{game_title}' ignoré définitivement.")
            break
        
        # On relance la recherche avec les mots de l'utilisateur
        # On force le mode LARGE/MANUEL pour activer le détourage automatique par sécurité
        status = search_loop(game_title, user_query, "MANUEL", ddgs)
        if status == "saved": return
        if status == "skip": return

if __name__ == "__main__":
    try:
        # Lecture du fichier JS
        if not os.path.exists(input_file):
            print(f"Erreur: Le fichier {input_file} est introuvable.")
            exit()
            
        with open(input_file, 'r', encoding='utf-8') as f:
            content = f.read()
            # Regex pour capturer title:"..." ou title:'...'
            titles = re.findall(r'title\s*:\s*["\'](.*?)["\']', content)

        total = len(titles)
        print(f"🚀 Initialisation : {total} jeux détectés.")
        print(f"📂 Dossier de sortie : {output_folder}/")
        
        # Instance unique de DDGS
        with DDGS() as ddgs:
            for i, t in enumerate(titles):
                # Petit compteur pour suivre la progression
                print(f"\n[{i+1}/{total}] Traitement...")
                manage_game(t, ddgs)
                
        print("\n✅ Terminé ! Base de données mise à jour.")
        
    except KeyboardInterrupt:
        print("\n🛑 Arrêt par l'utilisateur.")
    except Exception as e:
        print(f"\n❌ Erreur fatale globale : {e}")
        input("Appuyez sur Entrée pour fermer...")