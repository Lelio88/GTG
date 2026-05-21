/**
 * JS/multi/lobby-entry.js — Entry point de HTML/multi-lobby.html
 *
 * Gère la saisie du pseudo, la création d'une room, et la jointure d'une room
 * existante. Redirige vers HTML/multi-room.html#room=XXX une fois la room
 * créée ou rejointe.
 */

import { whenAuthenticated } from './firebase.js';
import { createRoom, joinRoom } from './lobby.js';
import { buildShareableUrl, readRoomCodeFromUrl } from './url-room.js';
import { games } from '../gamesDatabase.js';

const aliasInput = document.getElementById('alias-input');
const modeSelect = document.getElementById('mode-select');
const gamesSelect = document.getElementById('games-select');
const createBtn = document.getElementById('create-room-btn');
const codeInput = document.getElementById('code-input');
const joinBtn = document.getElementById('join-room-btn');
const errorMsg = document.getElementById('error-msg');

function showError(msg) {
    errorMsg.innerText = msg;
    errorMsg.style.color = '#ff6b9f';
}

function clearError() { errorMsg.innerText = ''; }

function validateAlias() {
    const alias = aliasInput.value.trim();
    if (!alias) {
        showError('Entre un pseudo d\'abord');
        return null;
    }
    return alias.slice(0, 20);
}

// Si l'URL contient déjà un code, pré-remplir le champ
window.addEventListener('DOMContentLoaded', () => {
    const code = readRoomCodeFromUrl();
    if (code) {
        codeInput.value = code;
    }
    // Auth en arrière-plan dès le chargement (gain de temps)
    whenAuthenticated().catch(err => console.error('auth init', err));
});

createBtn.addEventListener('click', async () => {
    clearError();
    const alias = validateAlias();
    if (!alias) return;

    const mode = modeSelect.value;
    const targetGames = parseInt(gamesSelect.value, 10);

    createBtn.disabled = true;
    try {
        const { code } = await createRoom({ hostName: alias, mode, targetGames });
        window.location.href = buildShareableUrl(code);
    } catch (err) {
        showError(`Erreur création : ${err.message}`);
        createBtn.disabled = false;
    }
});

joinBtn.addEventListener('click', async () => {
    clearError();
    const alias = validateAlias();
    if (!alias) return;

    const code = codeInput.value.trim().toUpperCase();
    if (!code || code.length !== 6) {
        showError('Code de room invalide (6 caractères)');
        return;
    }

    joinBtn.disabled = true;
    try {
        await joinRoom({ code, name: alias });
        window.location.href = buildShareableUrl(code);
    } catch (err) {
        showError(`Erreur jointure : ${err.message}`);
        joinBtn.disabled = false;
    }
});
