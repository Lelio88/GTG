/**
 * JS/multi/chat.js — Chat de groupe dans la room
 *
 * Schéma RTDB : /rooms/{code}/chat/{messageId}
 *   uid:  uid Firebase de l'auteur (vérifié par les rules)
 *   name: pseudo affiché
 *   text: contenu (filtré client-side)
 *   ts:   serverTimestamp
 *
 * Filtre grossièreté CLIENT (non-authoritatif, peut être bypassé par un
 * client modifié — acceptable pour MVP entre potes). Censure simple :
 * remplace chaque mot tabou par des étoiles de même longueur.
 *
 * Exports :
 *   - startChat({ code, uid, name, messagesEl, formEl, inputEl, sendBtn })
 *     → { stop() }
 */

import { db, ref, onValue, off, push, serverTimestamp, set } from './firebase.js';

const MAX_MESSAGE_LEN = 200;
const MAX_DISPLAYED_MESSAGES = 80; // on n'affiche que les N derniers
const CHAT_FLOOD_DELAY_MS = 500;    // anti-spam minimal côté client

// Liste de mots à censurer. Liste volontairement courte/conservatrice pour MVP.
// Peut être étendue dans `docs/multiplayer-architecture.md` si besoin.
const PROFANITY = [
    // français
    'merde', 'putain', 'connard', 'connasse', 'salope', 'salaud', 'pute', 'enculé', 'enculee',
    'fdp', 'tg', 'ferme ta gueule', 'nique', 'niquer', 'enfoiré', 'enfoire', 'pd', 'pédé', 'pede',
    'tapette', 'tarlouze', 'bite', 'couille', 'chatte',
    // anglais
    'fuck', 'fucking', 'shit', 'bitch', 'asshole', 'cunt', 'dick', 'nigger', 'faggot',
];

function censor(text) {
    let out = text;
    for (const word of PROFANITY) {
        // \b…\b ne marche pas avec les chars unicode latins (é/è/à etc.) en certains regex engines
        // donc on fait un escape simple sans \b — peut sur-censurer mais c'est OK pour MVP
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(escaped, 'gi');
        out = out.replace(re, (m) => '*'.repeat(m.length));
    }
    return out;
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function startChat({ code, uid, name, messagesEl, formEl, inputEl, sendBtn }) {
    let lastSentAt = 0;
    let unsubChat = null;
    const chatRef = ref(db, `rooms/${code}/chat`);

    // --- Listener temps réel ---
    unsubChat = onValue(chatRef, (snap) => {
        const data = snap.val() || {};
        const messages = Object.entries(data)
            .map(([id, m]) => ({ id, ...m }))
            .sort((a, b) => (a.ts || 0) - (b.ts || 0))
            .slice(-MAX_DISPLAYED_MESSAGES);

        if (messages.length === 0) {
            messagesEl.innerHTML = `<p class="multi-chat-empty">Personne n'a écrit pour l'instant…</p>`;
            return;
        }

        const html = messages.map((m) => {
            const isMe = m.uid === uid;
            return `
                <div class="multi-chat-message${isMe ? ' is-me' : ''}">
                    <span class="multi-chat-author">${escapeHtml(m.name || '?')}:</span>
                    <span class="multi-chat-text">${escapeHtml(m.text || '')}</span>
                </div>
            `;
        }).join('');

        messagesEl.innerHTML = html;
        // Auto-scroll vers le bas
        messagesEl.scrollTop = messagesEl.scrollHeight;
    });

    // --- Envoi d'un message ---
    async function sendMessage() {
        const raw = inputEl.value.trim();
        if (!raw) return;
        if (raw.length > MAX_MESSAGE_LEN) return;

        // Anti-flood côté client
        const now = Date.now();
        if (now - lastSentAt < CHAT_FLOOD_DELAY_MS) return;
        lastSentAt = now;

        const text = censor(raw).slice(0, MAX_MESSAGE_LEN);

        inputEl.value = '';
        inputEl.focus();

        try {
            const newRef = push(chatRef);
            await set(newRef, {
                uid,
                name,
                text,
                ts: serverTimestamp(),
            });
        } catch (err) {
            console.error('chat send failed', err);
            // Pas d'alerte — on ne dérange pas l'UX pour un message perdu
        }
    }

    function onSubmit(e) {
        e.preventDefault();
        sendMessage();
    }

    formEl.addEventListener('submit', onSubmit);

    return {
        stop() {
            if (unsubChat) off(chatRef);
            formEl.removeEventListener('submit', onSubmit);
        },
    };
}
