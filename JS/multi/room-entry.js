/**
 * JS/multi/room-entry.js — Entry point de HTML/multi-room.html
 *
 * Orchestre 3 vues (lobby / game / results) selon meta.status :
 *   - "lobby"     → #lobby-view, l'hôte voit "Démarrer la partie"
 *   - "playing"   → #game-view, host-engine actif côté hôte uniquement
 *   - "finished"  → #results-view, classement final, hôte peut prolonger
 *   - "cancelled" → toast d'erreur + retour à multi-lobby
 *
 * La sidebar #multi-scoreboard est visible en permanence (lobby + partie + résultats).
 */

import {
    db, ref, onValue, off, update, whenAuthenticated, get
} from './firebase.js';
import { joinRoom, leaveRoom, startGame, MIN_PLAYERS } from './lobby.js';
import { startHostEngine, extendTargetGames } from './host-engine.js';
import { startRoundClient } from './round-client.js';
import { startScoreboard } from './scoreboard.js';
import { readRoomCodeFromUrl, buildShareableUrl } from './url-room.js';
import { games } from '../gamesDatabase.js';

const $ = (id) => document.getElementById(id);

// ──────────────────────────────────────────────────────────────────────────
// Boot
// ──────────────────────────────────────────────────────────────────────────

const code = readRoomCodeFromUrl();
if (!code) {
    window.location.href = 'multi-lobby.html';
    throw new Error('Code de room manquant');
}

let myUid = null;
let myName = null;
let isHost = false;
let hostEngine = null;
let roundClient = null;
let scoreboard = null;
let unsubRoom = null;
let currentView = null; // 'lobby' | 'game' | 'results'
let lastStatus = null;

// ──────────────────────────────────────────────────────────────────────────
// Init au DOMContentLoaded
// ──────────────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', async () => {
    $('room-code-display').innerText = code;
    $('share-link').value = buildShareableUrl(code);
    $('copy-link-btn').onclick = copyShareLink;
    $('leave-room-btn').onclick = onLeaveRoom;
    $('back-to-lobby-btn').onclick = () => { window.location.href = 'multi-lobby.html'; };
    $('start-game-btn').onclick = onStartGame;
    $('add-rounds-btn').onclick = () => extendTargetGames({ code, increment: 5 });
    $('extend-rounds-btn').onclick = onExtendFromResults;

    // Auth + détection si on est déjà dans la room (ex: F5)
    const user = await whenAuthenticated();
    myUid = user.uid;

    const playerSnap = await get(ref(db, `rooms/${code}/players/${myUid}`));
    if (!playerSnap.exists()) {
        // Pas encore dans la room → demander le pseudo
        const alias = prompt('Ton pseudo (20 caractères max) :');
        if (!alias) {
            window.location.href = 'multi-lobby.html';
            return;
        }
        myName = alias.slice(0, 20);
        try {
            await joinRoom({ code, name: myName });
        } catch (err) {
            alert(`Impossible de rejoindre : ${err.message}`);
            window.location.href = 'multi-lobby.html';
            return;
        }
    } else {
        myName = playerSnap.val().name;
    }

    // Démarrer le scoreboard live
    scoreboard = startScoreboard({ code, container: $('multi-scoreboard'), myUid });

    // Écoute principale de la room → switch de vue
    listenRoom();
});

// ──────────────────────────────────────────────────────────────────────────
// Routing entre vues selon meta.status
// ──────────────────────────────────────────────────────────────────────────

function listenRoom() {
    const roomRef = ref(db, `rooms/${code}`);
    unsubRoom = onValue(roomRef, (snap) => {
        const data = snap.val();
        if (!data || !data.meta) {
            // Room supprimée → retour lobby
            window.location.href = 'multi-lobby.html';
            return;
        }
        const meta = data.meta;
        isHost = (meta.hostUid === myUid);

        if (meta.status === 'cancelled') {
            alert('La partie a été annulée (l\'hôte a quitté).');
            window.location.href = 'multi-lobby.html';
            return;
        }

        if (meta.status !== lastStatus) {
            handleStatusChange(meta, data);
            lastStatus = meta.status;
        } else {
            // Même statut → juste mettre à jour quelques éléments dépendant des données
            updateLobbyUi(data);
            updateGameHeaderUi(data);
            updateResultsUi(data);
        }
    });
}

function handleStatusChange(meta, data) {
    if (meta.status === 'lobby') {
        showView('lobby');
        updateLobbyUi(data);
    } else if (meta.status === 'playing') {
        showView('game');
        // Démarrer le round-client (tous les joueurs)
        if (!roundClient) {
            roundClient = startRoundClient({
                code,
                uid: myUid,
                contentContainer: $('content'),
                inputEl: $('user-input'),
                messageEl: $('message'),
                hintButton: $('hint-button'),
                timerEl: $('multi-timer'),
            });
        }
        // Démarrer le host-engine si on est l'hôte
        if (isHost && !hostEngine) {
            hostEngine = startHostEngine({ code, uid: myUid });
        }
        updateGameHeaderUi(data);
    } else if (meta.status === 'finished') {
        // Stop game-side handlers
        if (roundClient) { roundClient.stop(); roundClient = null; }
        if (hostEngine) { hostEngine.stop(); hostEngine = null; }
        showView('results');
        updateResultsUi(data);
    }
}

function showView(viewName) {
    if (currentView === viewName) return;
    currentView = viewName;
    $('lobby-view').style.display = viewName === 'lobby' ? 'block' : 'none';
    $('game-view').style.display = viewName === 'game' ? 'block' : 'none';
    $('results-view').style.display = viewName === 'results' ? 'block' : 'none';
}

// ──────────────────────────────────────────────────────────────────────────
// UI Lobby
// ──────────────────────────────────────────────────────────────────────────

function updateLobbyUi(data) {
    if (currentView !== 'lobby') return;
    const playerCount = Object.keys(data.players || {}).length;
    $('lobby-info').innerText = `${playerCount} joueur(s) — mode "${data.meta.mode}" — ${data.meta.targetGames} manches`;
    if (isHost) {
        $('start-game-btn').style.display = 'inline-block';
        $('start-game-btn').disabled = playerCount < MIN_PLAYERS;
        $('start-game-btn').innerText = playerCount < MIN_PLAYERS
            ? `Attendre au moins ${MIN_PLAYERS} joueurs…`
            : `Démarrer la partie (${playerCount} joueurs)`;
    } else {
        $('start-game-btn').style.display = 'none';
    }
}

async function onStartGame() {
    if (!isHost) return;
    const titles = games.map(g => g.title);
    await startGame({ code, gameTitles: titles });
}

// ──────────────────────────────────────────────────────────────────────────
// UI Game
// ──────────────────────────────────────────────────────────────────────────

function updateGameHeaderUi(data) {
    if (currentView !== 'game') return;
    const played = data.game?.playedCount || 0;
    const target = data.meta.targetGames || 0;
    $('multi-progress').innerText = `Manche ${played + 1} / ${target}`;
    $('add-rounds-btn').style.display = isHost ? 'inline-block' : 'none';
}

// ──────────────────────────────────────────────────────────────────────────
// UI Results
// ──────────────────────────────────────────────────────────────────────────

function updateResultsUi(data) {
    if (currentView !== 'results') return;
    const players = data.players || {};
    const sorted = Object.values(players).sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
    $('final-ranking').innerHTML = sorted
        .map((p, i) => `<li><strong>#${i + 1}</strong> ${escapeHtml(p.name)} — ${p.totalScore || 0} pts</li>`)
        .join('');
    $('extend-rounds-btn').style.display = isHost ? 'inline-block' : 'none';
}

async function onExtendFromResults() {
    if (!isHost) return;
    await extendTargetGames({ code, increment: 5 });
    // Au retour à "playing", le listener relance hostEngine et roundClient
    // (le `lastStatus` change pour déclencher handleStatusChange)
}

// ──────────────────────────────────────────────────────────────────────────
// Utilitaires
// ──────────────────────────────────────────────────────────────────────────

function copyShareLink() {
    const url = $('share-link').value;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
            $('copy-link-btn').innerText = 'Copié ✓';
            setTimeout(() => { $('copy-link-btn').innerText = 'Copier'; }, 1500);
        });
    }
}

async function onLeaveRoom() {
    if (!confirm('Quitter la room ?')) return;
    if (hostEngine) hostEngine.stop();
    if (roundClient) roundClient.stop();
    if (scoreboard) scoreboard.stop();
    if (unsubRoom) unsubRoom();
    await leaveRoom({ code, uid: myUid });
    window.location.href = 'multi-lobby.html';
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
