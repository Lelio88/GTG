/* ============================
    MIDI MODE
   ============================ */
import * as Tone from 'https://esm.sh/tone';
import { Midi } from 'https://esm.sh/@tonejs/midi';
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
    contentDiv.appendChild(controlsContainer);

    // Load MIDI file
    try {
        const midi = await Midi.fromUrl(cachedGame.midi[0]);
        
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
                        release: 0.2
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

        midiLoaded = true;

        // Enable play button
        playButton.disabled = false;
        playButton.style.opacity = '1';

        // Button handlers
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

    timerInterval = startTimerUtil();
}

function showHint() {
    // Since there's only one MIDI file, directly abandon
    abandonGame();
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