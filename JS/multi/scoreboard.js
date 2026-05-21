/**
 * JS/multi/scoreboard.js — Sidebar live des joueurs
 *
 * Affiche pour chaque joueur : pseudo, score cumulé, statut de la manche en cours
 * (🔍 cherche, ✅ trouvé, 🏳️ abandonné, 🔌 déconnecté).
 *
 * Met à jour en temps réel via onValue sur la room entière.
 */

import { db, ref, onValue, off } from './firebase.js';

const STATUS_ICONS = {
    searching: '🔍',
    found: '✅',
    abandoned: '🏳️',
    disconnected: '🔌',
};

/**
 * @param {Object} opts
 * @param {string} opts.code
 * @param {HTMLElement} opts.container — où injecter la sidebar
 * @param {string} opts.myUid — pour highlight de la ligne courante
 * @returns {{stop: () => void}}
 */
export function startScoreboard({ code, container, myUid }) {
    const roomRef = ref(db, `rooms/${code}`);
    const unsub = onValue(roomRef, (snap) => {
        const data = snap.val() || {};
        const players = data.players || {};
        const results = data.game?.currentRound?.results || {};
        const meta = data.meta || {};
        const game = data.game || {};

        // Tri : meilleur score en premier, puis pseudo alpha
        const sorted = Object.entries(players)
            .map(([uid, p]) => ({ uid, ...p }))
            .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0) || a.name.localeCompare(b.name));

        const headerHtml = `
            <div class="multi-scoreboard-header">
                <h3>Joueurs (${sorted.length})</h3>
                <p class="multi-progress">Manche ${(game.playedCount || 0) + (meta.status === 'playing' ? 1 : 0)} / ${meta.targetGames || '?'}</p>
            </div>
        `;

        const rows = sorted.map((p) => {
            const status = p.connected === false
                ? 'disconnected'
                : (results[p.uid]?.status || 'searching');
            const icon = STATUS_ICONS[status] || '🔍';
            const isHost = p.uid === meta.hostUid ? ' 👑' : '';
            const isMe = p.uid === myUid ? ' multi-scoreboard-me' : '';
            return `
                <li class="multi-scoreboard-row${isMe}">
                    <span class="multi-scoreboard-status">${icon}</span>
                    <span class="multi-scoreboard-name">${escapeHtml(p.name)}${isHost}</span>
                    <span class="multi-scoreboard-score">${p.totalScore || 0}</span>
                </li>
            `;
        }).join('');

        container.innerHTML = `${headerHtml}<ul class="multi-scoreboard-list">${rows}</ul>`;
    });

    return {
        stop() { off(roomRef); },
    };
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
