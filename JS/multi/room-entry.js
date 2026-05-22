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
    db, ref, onValue, off, update, whenAuthenticated, get, runTransaction, onDisconnect
} from './firebase.js';
import { joinRoom, leaveRoom, startGame, MIN_PLAYERS, programDisconnectCleanup } from './lobby.js';
import { startHostEngine, extendTargetGames } from './host-engine.js';
import { startRoundClient } from './round-client.js';
import { startScoreboard } from './scoreboard.js';
import { startChat } from './chat.js';
import { readRoomCodeFromUrl, buildShareableUrl } from './url-room.js';
import { games } from '../gamesDatabase.js';
import confetti from 'https://esm.sh/canvas-confetti@1.9.3';

const BUG_REPORT_BASE = 'https://github.com/Lelio88/GTG/issues/new';
const LAST_ALIAS_KEY = 'gtg_multi_last_alias';

function readLastAlias() {
    try { return (localStorage.getItem(LAST_ALIAS_KEY) || '').slice(0, 20); }
    catch { return ''; }
}
function saveLastAlias(alias) {
    try { localStorage.setItem(LAST_ALIAS_KEY, alias.slice(0, 20)); } catch {}
}

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
let chat = null;
let unsubRoom = null;
let currentView = null; // 'lobby' | 'game' | 'results'
let lastStatus = null;
let resultsConfettiFired = false; // un seul tir de confettis par entrée dans results

// ──────────────────────────────────────────────────────────────────────────
// Init au DOMContentLoaded
// ──────────────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', async () => {
    // Header global
    $('header-room-code').innerText = code;
    $('share-link').value = buildShareableUrl(code);
    $('copy-link-btn').onclick = copyShareLink;
    $('copy-code-btn').onclick = copyRoomCode;
    $('bug-report-btn').onclick = openBugReportModal;
    $('bug-report-cancel').onclick = closeBugReportModal;
    $('bug-report-form').onsubmit = onBugReportSubmit;
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
        // Pas encore dans la room → demander le pseudo via modale
        const alias = await askAliasViaModal();
        if (!alias) {
            window.location.href = 'multi-lobby.html';
            return;
        }
        myName = alias.slice(0, 20);
        saveLastAlias(myName);
        try {
            await joinRoom({ code, name: myName });
        } catch (err) {
            alert(`Impossible de rejoindre : ${err.message}`);
            window.location.href = 'multi-lobby.html';
            return;
        }
    } else {
        myName = playerSnap.val().name;
        saveLastAlias(myName);
    }

    // Détecter si on est l'hôte pour armer le bon onDisconnect
    const metaSnap = await get(ref(db, `rooms/${code}/meta`));
    const meta = metaSnap.val() || {};
    const iAmHost = (meta.hostUid === myUid);

    // Armer le cleanup automatique de cette session room
    // (à faire APRÈS le join, sinon la navigation lobby→room le déclenche en transit)
    await programDisconnectCleanup(code, myUid, iAmHost);

    // Démarrer le scoreboard live
    scoreboard = startScoreboard({ code, container: $('multi-scoreboard'), myUid });

    // Démarrer le chat
    chat = startChat({
        code,
        uid: myUid,
        name: myName,
        messagesEl: $('multi-chat-messages'),
        formEl: $('multi-chat-form'),
        inputEl: $('multi-chat-input'),
        sendBtn: $('multi-chat-send'),
    });

    // Écoute principale de la room → switch de vue
    listenRoom();
});

/**
 * Construit l'URL GitHub Issues pré-remplie à partir de ce que l'utilisateur
 * a tapé dans la modale. Le label "mode-multi" doit exister dans le repo.
 */
function buildBugReportUrlWithContent(code, userTitle, userDesc) {
    const params = new URLSearchParams({
        labels: 'mode-multi',
        title: `[Multi] ${userTitle}`,
        body: [
            '## Description',
            '',
            userDesc,
            '',
            '## Contexte technique (rempli automatiquement)',
            '',
            `- Room : \`${code}\``,
            `- Date : ${new Date().toISOString()}`,
            `- Navigateur : ${navigator.userAgent}`,
            `- URL : ${window.location.href}`,
        ].join('\n'),
    });
    return `${BUG_REPORT_BASE}?${params.toString()}`;
}

function openBugReportModal() {
    $('bug-report-modal').style.display = 'flex';
    setTimeout(() => $('bug-report-title-input').focus(), 50);
}

function closeBugReportModal() {
    $('bug-report-modal').style.display = 'none';
    $('bug-report-form').reset();
}

function onBugReportSubmit(e) {
    e.preventDefault();
    const title = $('bug-report-title-input').value.trim();
    const desc = $('bug-report-desc').value.trim();
    if (!title || !desc) return;

    const url = buildBugReportUrlWithContent(code, title, desc);
    window.open(url, '_blank', 'noopener');
    closeBugReportModal();
}

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
        const wasHost = isHost;
        isHost = (meta.hostUid === myUid);

        if (meta.status === 'cancelled') {
            alert('La partie a été annulée (l\'hôte a quitté).');
            window.location.href = 'multi-lobby.html';
            return;
        }

        // FAILOVER : si hostUid est null/absent et qu'il y a encore des joueurs,
        // on tente de devenir le nouvel hôte
        if ((!meta.hostUid || meta.hostUid === null) && data.players && data.players[myUid]) {
            attemptHostPromotion(data).catch((err) => console.error('host promotion failed', err));
        }

        // Si je viens de devenir host (promotion réussie), démarrer host-engine
        if (isHost && !wasHost && meta.status === 'playing' && !hostEngine) {
            hostEngine = startHostEngine({ code, uid: myUid });
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

/**
 * Tente de devenir le nouvel hôte de la room via une transaction Firebase.
 * Seul le premier client à exécuter la transaction réussit ; les autres voient
 * que hostUid est déjà set et abort proprement.
 */
let promotionInFlight = false;
async function attemptHostPromotion(roomData) {
    if (promotionInFlight) return;
    promotionInFlight = true;
    try {
        const hostUidRef = ref(db, `rooms/${code}/meta/hostUid`);
        const result = await runTransaction(hostUidRef, (current) => {
            if (current === null || current === undefined) {
                return myUid;  // claim
            }
            return;  // abort, qqn d'autre a claim
        });

        if (result.committed && result.snapshot.val() === myUid) {
            // J'ai gagné la promotion
            console.log('[Failover] Je suis le nouvel hôte');

            // Mettre à jour meta.hostName aussi (cosmétique mais propre)
            await update(ref(db, `rooms/${code}/meta`), { hostName: myName });

            // Ré-armer mon onDisconnect en tant que hôte
            const hostUidRef2 = ref(db, `rooms/${code}/meta/hostUid`);
            await onDisconnect(hostUidRef2).set(null);
        }
    } finally {
        promotionInFlight = false;
    }
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
        // Reset confetti pour ce passage dans results
        resultsConfettiFired = false;
        showView('results');
        updateResultsUi(data);
    } else if (meta.status === 'playing') {
        // Si on revient en playing (prolongation), reset confetti pour le prochain results
        resultsConfettiFired = false;
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

    // Confettis ! (une seule fois par entrée dans la vue results)
    if (!resultsConfettiFired) {
        resultsConfettiFired = true;
        fireConfettiCascade();
    }
}

/**
 * Cascade de confettis : 3 bursts décalés depuis différents points pour un effet "vague".
 * Palette en accord avec la DA néon (orange/rose/violet).
 */
function fireConfettiCascade() {
    const colors = ['#ffb86b', '#ff6b9f', '#9400d3', '#ff4500', '#ffff00'];
    confetti({
        particleCount: 150,
        spread: 90,
        origin: { x: 0.5, y: 0.6 },
        colors,
        scalar: 1.2,
    });
    setTimeout(() => confetti({
        particleCount: 100,
        spread: 70,
        origin: { x: 0.15, y: 0.7 },
        colors,
        startVelocity: 50,
    }), 300);
    setTimeout(() => confetti({
        particleCount: 100,
        spread: 70,
        origin: { x: 0.85, y: 0.7 },
        colors,
        startVelocity: 50,
    }), 600);
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

/**
 * Affiche la modale de saisie du pseudo. Pré-remplit avec le dernier
 * alias utilisé (stocké en localStorage, clé `gtg_multi_last_alias`).
 * Renvoie une promesse résolue avec le pseudo, ou null si annulé.
 */
function askAliasViaModal() {
    return new Promise((resolve) => {
        const modal = $('alias-modal');
        const input = $('alias-modal-input');
        const form = $('alias-form');
        const cancel = $('alias-cancel');

        // Pré-remplir avec le dernier alias stocké
        input.value = readLastAlias();

        modal.style.display = 'flex';
        setTimeout(() => { input.focus(); input.select(); }, 50);

        const cleanup = () => {
            modal.style.display = 'none';
            form.removeEventListener('submit', onSubmit);
            cancel.removeEventListener('click', onCancel);
        };
        const onSubmit = (e) => {
            e.preventDefault();
            const value = input.value.trim();
            if (!value) return;
            cleanup();
            resolve(value);
        };
        const onCancel = () => {
            cleanup();
            resolve(null);
        };

        form.addEventListener('submit', onSubmit);
        cancel.addEventListener('click', onCancel);
    });
}

function copyShareLink() {
    const url = $('share-link').value;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
            const btn = $('copy-link-btn');
            const original = btn.innerText;
            btn.innerText = '✓';
            setTimeout(() => { btn.innerText = original; }, 1500);
        });
    }
}

function copyRoomCode() {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(code).then(() => {
            const btn = $('copy-code-btn');
            const original = btn.innerText;
            btn.innerText = '✓';
            setTimeout(() => { btn.innerText = original; }, 1500);
        });
    }
}

async function onLeaveRoom() {
    if (!confirm('Quitter la room ?')) return;
    if (hostEngine) hostEngine.stop();
    if (roundClient) roundClient.stop();
    if (scoreboard) scoreboard.stop();
    if (chat) chat.stop();
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
