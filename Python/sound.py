import re, os, warnings, io, time
import tkinter as tk
from tkinter import ttk, messagebox
import yt_dlp
import pygame
from duckduckgo_search import DDGS

# --- CONFIGURATION ---
input_file = 'gamesDatabase.js'
output_folder = 'sons_jeux'

# Tente de trouver ffmpeg automatiquement s'il est dans le même dossier
local_ffmpeg = os.path.join(os.getcwd(), "ffmpeg.exe")
if os.path.exists(local_ffmpeg):
    ffmpeg_location = local_ffmpeg
else:
    ffmpeg_location = "" # Laisse vide si ffmpeg est déjà installé dans le système

if not os.path.exists(output_folder):
    os.makedirs(output_folder)

# Initialisation du mixeur audio
try:
    pygame.mixer.init()
except:
    print("Erreur init audio. Vérifiez vos périphériques.")

class AudioSelector:
    def __init__(self, game_title, search_type, step_number):
        self.root = tk.Tk()
        self.root.title(f"{game_title} - Son {step_number}/3 ({search_type})")
        
        # --- FOCUS FORCE ---
        self.root.attributes("-topmost", True)
        self.root.focus_force()
        self.root.after(100, lambda: self.root.focus_force())

        self.game_title = game_title
        self.step_number = step_number
        self.choice = None 
        self.results = []

        # Instructions
        lbl_info = tk.Label(self.root, text=f"Recherche DuckDuckGo : {search_type}\nDouble-cliquez pour télécharger et écouter", 
                           font=("Arial", 10, "bold"), pady=10)
        lbl_info.pack()

        # Liste des résultats
        self.listbox = tk.Listbox(self.root, width=100, height=12)
        self.listbox.pack(padx=10, pady=5)
        self.listbox.bind('<Double-1>', self.download_and_play)

        # Contrôles Player
        frame_controls = tk.Frame(self.root)
        frame_controls.pack(pady=10)
        tk.Button(frame_controls, text="⏹ STOP", command=self.stop_audio, bg="#ffcdd2", width=20).pack()
        
        # Boutons Validation
        frame_bottom = tk.Frame(self.root)
        frame_bottom.pack(side=tk.BOTTOM, pady=20, fill=tk.X)
        
        tk.Button(frame_bottom, text="✅ GARDER CE SON", command=self.save_and_quit, bg="#c8e6c9", height=2).pack(side=tk.LEFT, expand=True, fill=tk.X, padx=10)
        tk.Button(frame_bottom, text="⏭ PASSER AU JEU SUIVANT", command=self.skip_game, bg="#ffecb3").pack(side=tk.RIGHT, padx=10)

        # Lancer la recherche auto via DuckDuckGo
        self.root.after(100, lambda: self.perform_search_ddg(game_title, search_type))

    def perform_search_ddg(self, game, mode):
        # Mots clés optimisés pour DuckDuckGo -> YouTube
        query = ""
        if mode == "SFX": query = f"site:youtube.com {game} sound effect short"
        elif mode == "DIALOGUE": query = f"site:youtube.com {game} iconic quote lines"
        elif mode == "THEME": query = f"site:youtube.com {game} main theme ost"
        
        print(f"   🔎 Recherche DDG : {query}")
        self.listbox.delete(0, tk.END)
        self.results = []
        
        try:
            with DDGS() as ddgs:
                # On cherche des vidéos via DDG
                ddg_results = list(ddgs.videos(keywords=query, region="wt-wt", max_results=8))
                
                if not ddg_results:
                    self.listbox.insert(tk.END, "Aucun résultat trouvé sur DuckDuckGo.")
                    return

                for res in ddg_results:
                    # On stocke le résultat complet
                    title = res.get('title', 'Sans titre')
                    desc = res.get('description', '')[:50] + "..."
                    url = res.get('content', '') # L'URL de la vidéo
                    
                    if not url: continue # Pas de lien, on passe

                    self.results.append({'title': title, 'url': url})
                    self.listbox.insert(tk.END, f"YouTube | {title} ({desc})")
                    
        except Exception as e:
            print(f"Erreur recherche DDG : {e}")
            self.listbox.insert(tk.END, f"Erreur de connexion : {e}")

    def download_and_play(self, event):
        self.stop_audio()
        selection = self.listbox.curselection()
        if not selection: return
        
        index = selection[0]
        if index >= len(self.results): return

        video_url = self.results[index]['url']
        video_title = self.results[index]['title']
        
        print(f"   ⏳ Téléchargement : {video_title}")
        self.root.title("⏳ Téléchargement en cours... (Patientez)")
        self.root.update()

        # Configuration yt-dlp pour téléchargement direct via URL
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': 'temp_preview', 
            'quiet': True,
            'overwrites': True,
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
        }
        
        if ffmpeg_location:
            ydl_opts['ffmpeg_location'] = ffmpeg_location

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([video_url])
            
            if os.path.exists("temp_preview.mp3"):
                try:
                    pygame.mixer.music.load("temp_preview.mp3")
                    pygame.mixer.music.play()
                    self.root.title(f"🔊 Lecture : {video_title}")
                except Exception as e:
                    messagebox.showerror("Erreur Audio", f"Le fichier est là mais illisible : {e}")
        except Exception as e:
            messagebox.showerror("Erreur Téléchargement", f"Vérifiez que FFmpeg est bien présent !\n\nErreur : {e}")
            self.root.title("Erreur")

    def stop_audio(self):
        try:
            pygame.mixer.music.stop()
            pygame.mixer.music.unload()
        except: pass
        time.sleep(0.1)

    def save_and_quit(self):
        self.stop_audio()
        if os.path.exists("temp_preview.mp3"):
            self.choice = 'saved'
            self.root.destroy()
        else:
            messagebox.showwarning("Attention", "Aucun son n'est chargé.")

    def skip_game(self):
        self.stop_audio()
        self.choice = 'skip'
        self.root.destroy()
        
    def show(self):
        self.root.mainloop()
        return self.choice

# --- LOGIQUE GLOBALE ---

def sanitize_filename(filename):
    return re.sub(r'[\\/*?:"<>|]', "", filename)

def manage_game(game_title):
    clean_name = sanitize_filename(game_title)
    
    for i in range(1, 4):
        target_file = os.path.join(output_folder, f"{clean_name} {i}.mp3")
        
        if os.path.exists(target_file):
            continue 
            
        sound_type = "SFX"
        if i == 2: sound_type = "DIALOGUE"
        if i == 3: sound_type = "THEME"

        print(f"\n🎧 JEU : {game_title} | Fichier {i}/3 ({sound_type})")
        
        selector = AudioSelector(game_title, sound_type, i)
        result = selector.show()
        
        if result == 'saved':
            try:
                if os.path.exists("temp_preview.mp3"):
                    # On force l'écrasement si besoin
                    if os.path.exists(target_file): os.remove(target_file)
                    os.rename("temp_preview.mp3", target_file)
                    print(f"      💾 Sauvegardé : {clean_name} {i}.mp3")
            except Exception as e:
                print(f"      ❌ Erreur renommage : {e}")
                
        elif result == 'skip':
            print("      ⏩ Jeu passé.")
            return

        # Nettoyage
        if os.path.exists("temp_preview.mp3"):
            try: os.remove("temp_preview.mp3")
            except: pass

if __name__ == "__main__":
    try:
        if not os.path.exists(input_file):
            print(f"Fichier {input_file} introuvable.")
            exit()
            
        with open(input_file, 'r', encoding='utf-8') as f:
            titles = re.findall(r'title\s*:\s*["\'](.*?)["\']', f.read())
        
        print(f"Chargement audio pour {len(titles)} jeux...")
        
        # Vérification rapide FFmpeg
        if not os.path.exists("ffmpeg.exe") and not ffmpeg_location:
            print("⚠️ ATTENTION : ffmpeg.exe n'est pas détecté dans le dossier.")
            print("Si le téléchargement échoue, mettez ffmpeg.exe à côté du script.")
            time.sleep(2)

        for t in titles:
            manage_game(t)
            
        print("\n✅ Terminé !")
        
    except Exception as e:
        print(f"Erreur fatale : {e}")