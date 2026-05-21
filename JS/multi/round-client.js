/**
 * JS/multi/round-client.js — Client de manche (exécuté par TOUS les joueurs)
 *
 * Responsabilités côté joueur :
 *   - Écouter game/currentRound
 *   - Au changement de roundId : appeler le renderer du mode pour ce jeu
 *   - Capturer la saisie utilisateur, valider avec checkAnswerValue
 *   - Écrire son propre game/currentRound/results/{uid} (found / abandoned)
 *   - Afficher la modale de révélation si revealedAt est posé
 *   - Afficher la modale de fin de manche (rangs/scores) brièvement
 *
 * Invariants :
 *   - Ce module ne fait JAMAIS de transition de round (réservé à host-engine).
 *   - L'écriture dans results/{uid} est limitée à mon propre uid par les règles RTDB.
 *   - On garde un cache local `lastRenderedRoundId` pour éviter les re-renders inutiles.
 */

import { db, ref, onValue, off, update, set, serverTimestamp } from './firebase.js';
import { renderers, getHintCount } from '../hint-renderers.js';
import { checkAnswerValue } from '../gameUtils.js';
import { games } from '../gamesDatabase.js';

/**
 * @param {Object} opts
 * @param {string} opts.code — Code de room
 * @param {string} opts.uid — Mon uid
 * @param {HTMLElement} opts.contentContainer — Conteneur où afficher l'indice
 * @param {HTMLInputElement} opts.inputEl — Input de saisie
 * @param {HTMLElement} opts.messageEl — Élément où afficher feedback (bonne/mauvaise/révélation)
 * @param {HTMLElement} opts.hintButton — Bouton "Indice" / "Abandonner"
 * @param {HTMLElement} opts.timerEl — Élément affichant le compte à rebours
 * @returns {{stop: () => void}}
 */
export function startRoundClient(opts) {
    const { code, uid, contentContainer, inputEl, messageEl, hintButton, timerEl } = opts;

    let currentRoundId = null;
    let currentMode = null;
    let currentGame = null;
    let currentHintIndex = 0;
    let maxUnlockedHint = 0;
    let totalHints = 1;
    let hasAnswered = false;
    let endsAt = null;
    let roundTotalMs = 30_000; // mis à jour quand un nouveau round commence
    let countdownInterval = null;

    const roomRef = ref(db, `rooms/${code}`);
    const timerBarFillEl = document.getElementById('multi-timer-bar-fill');

    function clearCountdown() {
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
    }

    function startCountdown() {
        clearCountdown();
        countdownInterval = setInterval(() => {
            if (!endsAt) return;
            const remainingMs = Math.max(0, endsAt - Date.now());
            const secs = Math.ceil(remainingMs / 1000);
            timerEl.innerText = `${String(secs).padStart(2, '0')}s`;

            // Update barre de progression
            if (timerBarFillEl) {
                const ratio = Math.max(0, Math.min(1, remainingMs / roundTotalMs));
                timerBarFillEl.style.width = `${ratio * 100}%`;
                // Bascule en mode urgence sous les 5 dernières secondes
                if (remainingMs <= 5000 && !timerBarFillEl.classList.contains('timer-urgent')) {
                    timerBarFillEl.classList.add('timer-urgent');
                } else if (remainingMs > 5000 && timerBarFillEl.classList.contains('timer-urgent')) {
                    timerBarFillEl.classList.remove('timer-urgent');
                }
            }
        }, 200);
    }

    /** Quand un nouveau round arrive : reset l'état local + render */
    async function onNewRound(round, meta) {
        currentRoundId = round.roundId;
        currentMode = meta.mode;
        currentGame = games.find(g => g.title === round.gameTitle);
        if (!currentGame) {
            console.error('Jeu introuvable dans le catalogue:', round.gameTitle);
            return;
        }
        currentHintIndex = 0;
        maxUnlockedHint = 0;
        totalHints = getHintCount(currentMode, currentGame);
        hasAnswered = false;
        endsAt = round.endsAt;
        // Calcule la durée totale réelle du round (endsAt - now) pour caler la barre
        roundTotalMs = Math.max(1000, endsAt - Date.now());
        // Reset état visuel de la barre
        if (timerBarFillEl) {
            timerBarFillEl.classList.remove('timer-urgent');
            timerBarFillEl.style.width = '100%';
        }

        messageEl.innerText = '';
        messageEl.style.color = '';
        inputEl.value = '';
        inputEl.disabled = false;
        inputEl.focus();

        // Bouton Indice : "Indice" si on a plus d'indices, "Abandonner" sinon
        updateHintButton();

        // Render initial
        await renderers[currentMode](currentGame, 0, contentContainer);

        startCountdown();
    }

    function updateHintButton() {
        if (totalHints <= 1 || maxUnlockedHint >= totalHints - 1) {
            hintButton.innerText = 'Abandonner';
            hintButton.onclick = abandonRound;
        } else {
            hintButton.innerText = 'Indice';
            hintButton.onclick = useHint;
        }
    }

    async function useHint() {
        if (hasAnswered) return;
        if (maxUnlockedHint >= totalHints - 1) {
            abandonRound();
            return;
        }
        maxUnlockedHint++;
        currentHintIndex = maxUnlockedHint;
        await renderers[currentMode](currentGame, currentHintIndex, contentContainer);
        updateHintButton();
    }

    async function submitAnswer() {
        if (hasAnswered || !currentGame) return;
        const input = inputEl.value;
        if (checkAnswerValue(input, currentGame.title)) {
            hasAnswered = true;
            inputEl.disabled = true;
            messageEl.innerText = '✅ Bonne réponse !';
            messageEl.style.color = 'limegreen';
            await set(ref(db, `rooms/${code}/game/currentRound/results/${uid}`), {
                status: 'found',
                foundAt: Date.now(),
                hintsUsed: maxUnlockedHint,
            });
        } else {
            messageEl.innerText = '❌ Mauvaise réponse';
            messageEl.style.color = 'violet';
            setTimeout(() => { messageEl.innerText = ''; }, 1500);
        }
    }

    async function abandonRound() {
        if (hasAnswered) return;
        hasAnswered = true;
        inputEl.disabled = true;
        messageEl.innerText = '🏳️ Tu as abandonné';
        messageEl.style.color = '#aaa';
        await set(ref(db, `rooms/${code}/game/currentRound/results/${uid}`), {
            status: 'abandoned',
            foundAt: null,
            hintsUsed: maxUnlockedHint,
        });
    }

    /** Quand revealedAt est posé : affiche la modale révélation à TOUS */
    function onReveal(round) {
        clearCountdown();
        inputEl.disabled = true;
        // Modale révélation simple : intégrée dans #message
        messageEl.innerHTML = `📜 Personne n'a trouvé. La réponse était : <strong>${round.gameTitle}</strong>`;
        messageEl.style.color = '#ffb86b';
    }

    /** Listener principal */
    const unsubHandler = onValue(roomRef, (snap) => {
        const data = snap.val();
        if (!data || !data.meta) return;

        const round = data.game?.currentRound;
        if (!round) return;

        // Nouveau round ?
        if (round.roundId !== currentRoundId && !round.endedAt) {
            onNewRound(round, data.meta);
        }

        // Révélation collective (personne n'a trouvé) ?
        if (round.revealedAt && round.endedAt && round.roundId === currentRoundId) {
            onReveal(round);
        }
    });

    // Wire Enter key pour soumission
    inputEl.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submitAnswer();
        }
    });

    // Wire bouton Valider (s'il existe)
    const checkBtn = document.getElementById('multi-check-btn');
    if (checkBtn) checkBtn.onclick = submitAnswer;

    return {
        stop() {
            clearCountdown();
            off(roomRef);
        },
    };
}
