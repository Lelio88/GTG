/**
 * JS/hint-renderers.js — Renderers d'indices factorisés (8 modes)
 *
 * Source unique de vérité pour le rendu DOM des indices. Consommé par :
 *   - JS/<mode>.js (solo) — un appel au renderer + logique métier locale conservée
 *   - JS/multi/* (multi) — dispatch via la table `renderers` selon le mode de la room
 *
 * Signature uniforme : renderHint<Mode>(game, hintIndex, container) → void
 *   - vide le container (innerHTML = '')
 *   - construit la représentation DOM de l'indice d'index hintIndex
 *   - injecte dans container
 *
 * Pour les modes one-shot (midi, shadow, pixelated, emoji), hintIndex est ignoré.
 * Pour `text`, le rendu est cumulatif (affiche TOUS les indices de 0 à hintIndex inclus).
 *
 * Invariants :
 *   - Le module ne dépend que de `game` (objet du catalogue games[]) et du DOM passé
 *     en `container`. Aucun accès à localStorage / variables globales / IDs externes.
 *   - L'import de Tone.js (mode midi) est dynamique → pas de pénalité pour les autres modes.
 *   - Le cleanup spécifique au mode midi (Transport.stop, dispose synths) est exposé
 *     séparément via cleanupMidi() pour les pages qui en ont besoin.
 *
 * Exemple d'usage canonique (côté solo) :
 *   import { renderHintFull } from './hint-renderers.js';
 *   renderHintFull(cachedGame, hintIndex, document.getElementById('content'));
 *
 * Exemple d'usage canonique (côté multi, mode dynamique) :
 *   import { renderers, getHintCount } from './hint-renderers.js';
 *   const total = getHintCount(roomMode, game);
 *   renderers[roomMode](game, currentHintIndex, contentDiv);
 */

// === Mode FULL : image + texte + audio côte à côte ===
export function renderHintFull(game, hintIndex, container) {
    container.innerHTML = '';

    const hintContainer = document.createElement('div');
    hintContainer.className = 'hint-container';

    // Image (gauche)
    if (game.image && game.image[hintIndex]) {
        const img = document.createElement('img');
        img.src = game.image[hintIndex];
        img.alt = 'Indice image';
        hintContainer.appendChild(img);
    }

    // Conteneur droite (texte + audio)
    const rightContent = document.createElement('div');
    rightContent.className = 'hint-right-content';

    if (game.text && game.text[hintIndex]) {
        const text = document.createElement('p');
        text.innerText = game.text[hintIndex];
        rightContent.appendChild(text);
    }

    if (game.sound && game.sound[hintIndex]) {
        const audio = document.createElement('audio');
        audio.controls = true;
        const source = document.createElement('source');
        source.src = game.sound[hintIndex];
        source.type = 'audio/mpeg';
        audio.appendChild(source);
        rightContent.appendChild(audio);
    }

    hintContainer.appendChild(rightContent);
    container.appendChild(hintContainer);
}

// === Mode IMAGE : une image au choix d'index ===
export function renderHintImage(game, hintIndex, container) {
    container.innerHTML = '';

    const img = document.createElement('img');
    img.src = game.image[hintIndex];
    img.id = 'game-image';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    img.style.position = 'relative';
    img.style.transition = 'opacity 0.5s ease';
    container.appendChild(img);
}

// === Mode SOUND : un audio au choix d'index ===
export function renderHintSound(game, hintIndex, container) {
    container.innerHTML = '';

    const audio = document.createElement('audio');
    audio.src = game.sound[hintIndex];
    audio.id = 'game-audio';
    audio.autoplay = false;
    audio.loop = false;
    audio.controls = true;
    audio.style.width = '100%';
    audio.style.position = 'relative';
    audio.style.transition = 'opacity 0.5s ease';
    container.appendChild(audio);
}

// === Mode TEXT : indices cumulés de 0 à hintIndex inclus ===
export function renderHintText(game, hintIndex, container) {
    container.innerHTML = '';

    for (let i = 0; i <= hintIndex && i < game.text.length; i++) {
        const p = document.createElement('p');
        p.textContent = game.text[i];
        container.appendChild(p);
    }
}

// === Mode EMOJI : chaîne d'emojis (one-shot, hintIndex ignoré) ===
export function renderHintEmoji(game, _hintIndex, container) {
    container.innerHTML = '';

    const p = document.createElement('p');
    p.id = 'emoji-display';
    p.textContent = game.emoji;
    p.style.cssText = `
        font-size: 60px;
        text-align: center;
        padding: 40px;
        line-height: 1.5;
    `;
    container.appendChild(p);
}

// === Mode SHADOW : silhouette noire (brightness 0) sur caisson lumineux ===
//
// La silhouette est forcee en noir pur via `filter: brightness(0)`. Pour
// qu'elle soit VISIBLE, le cadre est un caisson LUMINEUX (fond clair
// retroeclaire) : une silhouette noire sur le fond sombre du theme neon
// serait invisible (noir sur noir). Le fond clair reste clair meme en mode
// Enfer ; seule la bordure neon suit le theme.
export function renderHintShadow(game, _hintIndex, container) {
    container.innerHTML = '';

    const source = (game.shadow && game.shadow.length > 0) ? game.shadow : game.image;

    // Caisson lumineux COMPACT : il epouse la silhouette (inline-flex) au lieu
    // d'un grand panneau blanc plein cadre (qui jurait avec le theme sombre).
    // Fond clair juste autour du sujet + cadre neon discret -> la silhouette
    // noire ressort sans "mur blanc" tout autour.
    const imageWrapper = document.createElement('div');
    imageWrapper.style.display = 'inline-flex';
    imageWrapper.style.justifyContent = 'center';
    imageWrapper.style.alignItems = 'center';
    imageWrapper.style.maxWidth = '100%';
    imageWrapper.style.padding = '12px';
    imageWrapper.style.border = '1px solid rgba(0, 246, 255, 0.45)';
    imageWrapper.style.borderRadius = '14px';
    imageWrapper.style.background = 'radial-gradient(circle at 50% 40%, #edf2f8 0%, #d3dde9 68%, #bfcbd9 100%)';
    imageWrapper.style.boxShadow = '0 0 22px rgba(0, 246, 255, 0.25), inset 0 0 30px rgba(0, 0, 0, 0.05)';
    imageWrapper.style.boxSizing = 'border-box';
    imageWrapper.style.marginBottom = '20px';

    const img = document.createElement('img');
    img.src = source[0];
    img.id = 'game-image';
    img.style.maxWidth = '100%';
    img.style.maxHeight = '44vh';
    img.style.objectFit = 'contain';
    img.style.border = 'none';
    img.style.outline = 'none';
    img.style.boxShadow = 'none';
    // brightness(0) => tous les pixels visibles deviennent NOIR pur (l'ombre la
    // plus noire possible), en preservant la transparence (contour net).
    img.style.filter = 'brightness(0)';
    img.style.transition = 'opacity 0.5s ease, filter 0.5s ease';

    imageWrapper.appendChild(img);
    container.appendChild(imageWrapper);
}

// === Mode PIXELATED : image pixelisée (one-shot, hintIndex ignoré) ===
//
// Cas idéal : game.pixels[0] est une pochette DÉJÀ standardisée à ~30 px
// de large (générée par Python/standardize_pixels.py). On l'affiche tel
// quel avec `image-rendering: pixelated` → tous les jeux ont exactement
// le même degré de pixellisation, peu importe la taille source.
//
// Fallback : si pas de pochette pré-rendue, on downsample en canvas à
// 30 px max sur la largeur (même cible que standardize_pixels.py) pour
// garder un rendu uniforme avec les images standardisées.
const PIXELATED_TARGET_WIDTH = 30;

export function renderHintPixelated(game, _hintIndex, container) {
    container.innerHTML = '';

    const prePixelated = game.pixels && game.pixels.length > 0 ? game.pixels[0] : null;
    const fallback = game.image && game.image.length > 0 ? game.image[0] : null;

    const imageWrapper = document.createElement('div');
    imageWrapper.style.width = '100%';
    imageWrapper.style.height = '40vh';
    imageWrapper.style.display = 'flex';
    imageWrapper.style.justifyContent = 'center';
    imageWrapper.style.alignItems = 'center';
    imageWrapper.style.overflow = 'hidden';

    const img = document.createElement('img');
    img.id = 'game-pixels';
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.style.objectFit = 'contain';
    img.style.imageRendering = 'pixelated';
    img.style.boxShadow = 'none';
    img.style.opacity = '0';
    img.style.transition = 'opacity 0.5s ease';

    // Stocke la source HD originale (pour révélation côté appelant)
    img.dataset.originalSrc = fallback || prePixelated || '';

    if (prePixelated) {
        // Image déjà standardisée : on l'utilise telle quelle
        img.src = prePixelated;
        img.onload = () => {
            setTimeout(() => { img.style.opacity = '1'; }, 50);
        };
    } else if (fallback) {
        // Fallback : downsample en canvas à PIXELATED_TARGET_WIDTH px de large
        const tempImg = new Image();
        tempImg.src = fallback;
        tempImg.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const w = PIXELATED_TARGET_WIDTH;
            const h = Math.max(1, Math.floor(tempImg.height * PIXELATED_TARGET_WIDTH / tempImg.width));
            canvas.width = w;
            canvas.height = h;
            ctx.drawImage(tempImg, 0, 0, w, h);
            img.src = canvas.toDataURL();
            setTimeout(() => { img.style.opacity = '1'; }, 50);
        };
    }

    imageWrapper.appendChild(img);
    container.appendChild(imageWrapper);
}

// === Mode MIDI : player Tone.js (one-shot, hintIndex ignoré) ===
// Dynamic import pour ne pas charger Tone.js dans les autres modes.
// Versions pinnees pour eviter qu'une nouvelle major du CDN casse le mode :
//   tone 15.x (latest stable au moment du pin)
//   @tonejs/midi 2.x
// Bumper ici quand on souhaite upgrader, jamais laisser une version non
// pinnee (sinon esm.sh sert la latest et tout peut casser silencieusement).
const TONE_CDN = 'https://esm.sh/tone@15.1.22';
const TONE_MIDI_CDN = 'https://esm.sh/@tonejs/midi@2.0.28';

let ToneRef = null;
let midiSynths = [];

async function loadTone() {
    if (ToneRef === null) {
        ToneRef = await import(TONE_CDN);
    }
    return ToneRef;
}

export async function renderHintMidi(game, _hintIndex, container) {
    container.innerHTML = '';

    const Tone = await loadTone();
    const { Midi } = await import(TONE_MIDI_CDN);

    const controlsContainer = document.createElement('div');
    controlsContainer.style.cssText = 'display: flex; gap: 15px; justify-content: center; align-items: center; margin: 30px 0;';

    const playButton = document.createElement('button');
    playButton.innerText = '▶ Play';
    playButton.id = 'play-midi';
    playButton.style.cssText = 'padding: 12px 24px; font-size: 16px; cursor: pointer; background: #4CAF50; color: white; border: none; border-radius: 5px; transition: opacity 0.3s;';
    playButton.disabled = true;
    playButton.style.opacity = '0.5';

    const pauseButton = document.createElement('button');
    pauseButton.innerText = '⏸ Pause';
    pauseButton.id = 'pause-midi';
    pauseButton.style.cssText = 'padding: 12px 24px; font-size: 16px; cursor: pointer; background: #FFC107; color: white; border: none; border-radius: 5px; transition: opacity 0.3s;';
    pauseButton.disabled = true;
    pauseButton.style.opacity = '0.5';

    const stopButton = document.createElement('button');
    stopButton.innerText = '⏹ Stop';
    stopButton.id = 'stop-midi';
    stopButton.style.cssText = 'padding: 12px 24px; font-size: 16px; cursor: pointer; background: #f44336; color: white; border: none; border-radius: 5px; transition: opacity 0.3s;';
    stopButton.disabled = true;
    stopButton.style.opacity = '0.5';

    controlsContainer.appendChild(playButton);
    controlsContainer.appendChild(pauseButton);
    controlsContainer.appendChild(stopButton);
    container.appendChild(controlsContainer);

    try {
        const midi = await Midi.fromUrl(game.midi[0]);

        midi.tracks.forEach(track => {
            if (track.notes.length > 0) {
                const synth = new Tone.PolySynth(Tone.Synth, {
                    volume: -8,
                    oscillator: { type: 'triangle' },
                    envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.2 }
                }).toDestination();
                midiSynths.push(synth);

                track.notes.forEach(note => {
                    Tone.Transport.schedule(time => {
                        synth.triggerAttackRelease(note.name, note.duration, time, note.velocity);
                    }, note.time);
                });
            }
        });

        Tone.Transport.loop = true;
        Tone.Transport.loopEnd = midi.duration;

        playButton.disabled = false;
        playButton.style.opacity = '1';

        playButton.onclick = async () => {
            await Tone.start();
            Tone.Transport.start();
            playButton.disabled = true;
            playButton.style.opacity = '0.5';
            pauseButton.disabled = false;
            pauseButton.style.opacity = '1';
            stopButton.disabled = false;
            stopButton.style.opacity = '1';
        };

        pauseButton.onclick = () => {
            Tone.Transport.pause();
            playButton.disabled = false;
            playButton.style.opacity = '1';
            pauseButton.disabled = true;
            pauseButton.style.opacity = '0.5';
        };

        stopButton.onclick = () => {
            Tone.Transport.stop();
            playButton.disabled = false;
            playButton.style.opacity = '1';
            pauseButton.disabled = true;
            pauseButton.style.opacity = '0.5';
            stopButton.disabled = true;
            stopButton.style.opacity = '0.5';
        };
    } catch (error) {
        console.error('Erreur lors du chargement du MIDI:', error);
    }
}

/**
 * Cleanup à appeler avant un changement de manche / fermeture de page en mode midi.
 * Stoppe le Transport global Tone.js et dispose les synths.
 */
export function cleanupMidi() {
    if (ToneRef) {
        ToneRef.Transport.stop();
        ToneRef.Transport.cancel();
    }
    midiSynths.forEach(synth => synth.dispose());
    midiSynths = [];
}

// === Dispatch + métadonnées (pour usage multi avec mode dynamique) ===

export const renderers = {
    full: renderHintFull,
    image: renderHintImage,
    sound: renderHintSound,
    text: renderHintText,
    midi: renderHintMidi,
    shadow: renderHintShadow,
    pixelated: renderHintPixelated,
    emoji: renderHintEmoji,
};

/**
 * Nombre total d'indices que ce mode peut révéler pour un jeu donné.
 * Sert au système de navigation entre indices côté solo, et au multi pour borner
 * le déblocage progressif.
 */
export function getHintCount(mode, game) {
    switch (mode) {
        case 'full':
            return Math.max(
                (game.image || []).length,
                (game.sound || []).length,
                (game.text || []).length
            );
        case 'image': return (game.image || []).length;
        case 'sound': return (game.sound || []).length;
        case 'text': return (game.text || []).length;
        case 'midi':
        case 'shadow':
        case 'pixelated':
        case 'emoji':
            return 1;
        default:
            return 1;
    }
}
