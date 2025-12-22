/* ============================
    MIDI MODE
   ============================ */
import * as Tone from 'https://cdn.jsdelivr.net/npm/tone@latest/build/Tone.js';
import { Midi } from 'https://cdn.jsdelivr.net/npm/@tonejs/midi@latest/dist/Midi.js';
import { games } from './gamesDatabase.js';
import { handleGameCompletion } from './gameCompletion.js';
import {
    getCurrentProfile,
    initializeProfile,
    updateProfile as updateProfileUtil,
    getAvailableGames,
    startTimer as startTimerUtil,
    stopTimer,
    abandonGame as abandonGameUtil,
    checkAnswerValue,
    updateScoreboard,
    setupEnterKeyHandler,
    showCorrectAnswerFeedback,
    showIncorrectAnswerFeedback,
    initializeGameTitle,
    revealTitle
} from './gameUtils.js';

let timerInterval;
let cachedTitle = '';
let cachedGame = null;
let correctAnswerGiven = false;
let synths = [];
let midiLoaded = false;

// === Get current profile ===
let currentProfile = getCurrentProfile();
if (!currentProfile) {
    window.location.href = '../index.html';
}
currentProfile = initializeProfile(currentProfile);

// === Filter already found games in "midi" mode ===
const availableGames = getAvailableGames(games, currentProfile, 'midi');

async function launchGameMidi() {
    if (availableGames.length === 0) {
        handleGameCompletion(currentProfile, 'midi');
        return;
    }

    cachedGame = availableGames[Math.floor(Math.random() * availableGames.length)];
    cachedTitle = cachedGame.title;

    initializeGameTitle(cachedTitle);

    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = '';

    // Create player controls
    const controlsContainer = document.createElement('div');
    controlsContainer.style.cssText = 'display: flex; gap: 10px; justify-content: center; align-items: center; margin:  20px 0;';
    
    const playButton = document.createElement('button');
    playButton.innerText = '▶ Play';
    playButton.id = 'play-midi';
    playButton. style.cssText = 'padding: 10px 20px; font-size: 16px; cursor: pointer;';
    
    const pauseButton = document.createElement('button');
    pauseButton.innerText = '⏸ Pause';
    pauseButton. id = 'pause-midi';
    pauseButton.style. cssText = 'padding: 10px 20px; font-size: 16px; cursor:  pointer;';
    pauseButton.disabled = true;
    
    const stopButton = document.createElement('button');
    stopButton.innerText = '⏹ Stop';
    stopButton.id = 'stop-midi';
    stopButton.style.cssText = 'padding: 10px 20px; font-size: 16px; cursor: pointer;';
    stopButton.disabled = true;

    const loadingText = document.createElement('p');
    loadingText.innerText = 'Chargement du MIDI...';
    loadingText.id = 'midi-status';
    loadingText.style.cssText = 'font-style: italic; color: #666;';

    controlsContainer.appendChild(playButton);
    controlsContainer.appendChild(pauseButton);
    controlsContainer.appendChild(stopButton);
    contentDiv.appendChild(controlsContainer);
    contentDiv.appendChild(loadingText);

    // Load MIDI file
    try {
        const midi = await Midi.fromUrl(cachedGame.midi);
        
        // Create synths for each track
        midi.tracks.forEach(track => {
            if (track.notes. length > 0) {
                const synth = new Tone. PolySynth(Tone.Synth, {
                    volume: -8,
                    oscillator: {
                        type: 'triangle'
                    },
                    envelope: {
                        attack: 0.005,
                        decay: 0.1,
                        sustain: 0.3,
                        release: 1
                    }
                }).toDestination();
                
                synths.push(synth);
                
                // Schedule notes
                track.notes.forEach(note => {
                    Tone.Transport.schedule(time => {
                        synth. triggerAttackRelease(
                            note.name,
                            note.duration,
                            time,
                            note.velocity
                        );
                    }, note. time);
                });
            }
        });

        // Loop the music
        Tone.Transport.loop = true;
        Tone. Transport.loopEnd = midi.duration;

        loadingText.innerText = `MIDI chargé avec succès ! (${Math.round(midi.duration)}s)`;
        loadingText.style.color = '#4CAF50';
        midiLoaded = true;

        // Enable play button
        playButton.disabled = false;

        // Button handlers
        playButton.onclick = async () => {
            await Tone.start();
            Tone.Transport.start();
            playButton.disabled = true;
            pauseButton.disabled = false;
            stopButton.disabled = false;
            loadingText.innerText = '🎵 En lecture...';
        };

        pauseButton.onclick = () => {
            Tone.Transport.pause();
            playButton.disabled = false;
            pauseButton. disabled = true;
            loadingText.innerText = '⏸ En pause';
        };

        stopButton. onclick = () => {
            Tone.Transport.stop();
            playButton.disabled = false;
            pauseButton.disabled = true;
            stopButton.disabled = true;
            loadingText.innerText = '⏹ Arrêté';
        };

    } catch (error) {
        console.error('Erreur lors du chargement du MIDI:', error);
        loadingText.innerText = `❌ Erreur : ${error.message}`;
        loadingText.style.color = '#f44336';
    }

    timerInterval = startTimerUtil();
}

function showHint() {
    const hintButton = document.getElementById('hint-button');
    
    // Since there's only one MIDI file (no progressive hints), 
    // "hint" button becomes "abandon"
    hintButton.innerText = "Abandonner";
    hintButton. onclick = abandonGame;
}

function abandonGame() {
    revealTitle(cachedTitle, { mode: 'modal', autoAdvance: true, delay: 2000 })
        .then(() => {
            cleanupMidi();
            abandonGameUtil(currentProfile);
        });
}

function checkAnswer() {
    const input = document.getElementById('user-input').value;

    if (correctAnswerGiven) {
        return;
    }

    if (checkAnswerValue(input, cachedTitle)) {
        updateProfileUtil(currentProfile, cachedTitle, true, 'midi');
        showCorrectAnswerFeedback(cachedTitle, timerInterval);
        correctAnswerGiven = true;
        cleanupMidi();
    } else {
        updateProfileUtil(currentProfile, cachedTitle, false, 'midi');
        showIncorrectAnswerFeedback();
    }

    updateScoreboard(currentProfile);
}

function nextQuestion() {
    cleanupMidi();
    correctAnswerGiven = false;
    midiLoaded = false;
    
    // Remove old content
    const contentDiv = document. getElementById('content');
    contentDiv.innerHTML = '';
    
    // Reload page to start new question
    window.location.reload();
}

function cleanupMidi() {
    // Stop transport
    Tone.Transport.stop();
    Tone.Transport.cancel();
    
    // Dispose all synths
    synths.forEach(synth => synth.dispose());
    synths = [];
}

// Expose functions to global context
window.checkAnswer = checkAnswer;
window. showHint = showHint;
window.nextQuestion = nextQuestion;

// Setup Enter key handler
setupEnterKeyHandler(checkAnswer, nextQuestion, () => correctAnswerGiven);

// On load
window.onload = () => {
    launchGameMidi();
    updateScoreboard(currentProfile);
    document.getElementById('user-input').focus();
};

// Cleanup on page unload
window.addEventListener('beforeunload', cleanupMidi);