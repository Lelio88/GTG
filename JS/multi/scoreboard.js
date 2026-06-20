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
export function startScoreboard({ code, container, myUid, onKick }) {
    const roomRef = ref(db, `rooms/${code}`);

    // Délégation : un seul listener sur le container (survit aux remplacements
    // d'innerHTML). Gère les clics sur les boutons kick (#51).
    function onContainerClick(e) {
        const btn = e.target.closest('.multi-kick-btn');
        if (!btn) return;
        const kickUid = btn.getAttribute('data-kick-uid');
        if (kickUid && typeof onKick === 'function') onKick(kickUid);
    }
    container.addEventListener('click', onContainerClick);

    const unsub = onValue(roomRef, (snap) => {
        const data = snap.val() || {};
        const players = data.players || {};
        const results = data.game?.currentRound?.results || {};
        const meta = data.meta || {};
        const game = data.game || {};
        const viewerIsHost = meta.hostUid === myUid;

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
            // Couleur du joueur (#54). Pastille + nom teinté si une couleur valide
            // est choisie. On valide le format hex (un client modifié pourrait
            // écrire n'importe quoi dans players/{uid}/color -> injection CSS).
            const color = isHexColor(p.color) ? p.color : null;
            const dot = color
                ? `<span class="multi-scoreboard-dot" style="background:${escapeHtml(color)}"></span>`
                : '';
            const nameStyle = color ? ` style="color:${escapeHtml(color)}"` : '';
            // Bouton kick (#51) : visible seulement pour l'hôte, sur les autres joueurs.
            const kickBtn = (viewerIsHost && p.uid !== myUid)
                ? `<button class="multi-kick-btn" data-kick-uid="${escapeHtml(p.uid)}" title="Exclure ${escapeHtml(p.name)}" aria-label="Exclure ${escapeHtml(p.name)}">✕</button>`
                : '';
            return `
                <li class="multi-scoreboard-row${isMe}">
                    <span class="multi-scoreboard-status">${icon}</span>
                    ${dot}<span class="multi-scoreboard-name"${nameStyle}>${escapeHtml(p.name)}${isHost}</span>
                    <span class="multi-scoreboard-score">${p.totalScore || 0}</span>
                    ${kickBtn}
                </li>
            `;
        }).join('');

        container.innerHTML = `${headerHtml}<ul class="multi-scoreboard-list">${rows}</ul>`;
    });

    return {
        stop() {
            off(roomRef);
            container.removeEventListener('click', onContainerClick);
        },
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

/** Valide qu'une valeur est bien un code couleur hex (#rgb / #rrggbb / #rrggbbaa). */
function isHexColor(s) {
    return typeof s === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(s);
}
