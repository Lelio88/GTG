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
    let gracePhase = false;       // bascule à true quand graceEndsAt est posé
    let revealShown = false;      // évite de re-render la révélation plusieurs fois
    let arrowsCreated = false;    // flèches de nav entre indices créées ?

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
        gracePhase = false;
        revealShown = false;
        // Calcule la durée totale réelle du round (endsAt - now) pour caler la barre
        roundTotalMs = Math.max(1000, endsAt - Date.now());
        // Reset état visuel de la barre
        if (timerBarFillEl) {
            timerBarFillEl.classList.remove('timer-urgent');
            timerBarFillEl.style.width = '100%';
        }

        // Retire les flèches de nav du round précédent si elles existaient
        removeArrows();

        messageEl.innerText = '';
        messageEl.style.color = '';
        inputEl.value = '';
        inputEl.disabled = false;
        inputEl.focus();

        // Bouton Indice : reactive (il a pu etre desactive au round precedent
        // apres reponse/abandon, cf. #48) puis remis a "Indice"/"Abandonner".
        hintButton.disabled = false;
        updateHintButton();

        // Render initial
        await renderers[currentMode](currentGame, 0, contentContainer);

        startCountdown();
    }

    /** Bascule en phase grace quand le 1er joueur trouve (deadline capée à +10s).
     *  IMPORTANT (#45) : on ne réinitialise NI roundTotalMs NI la largeur de la
     *  barre. Avant, on remettait la barre à 100% + on recalait roundTotalMs sur
     *  la fenêtre de grâce → la barre se "resettait" visuellement à plein quand
     *  quelqu'un trouvait. Désormais on ne change que `endsAt` : la barre continue
     *  de refléter `remaining / roundTotalMs` (total d'origine). Elle saute une
     *  seule fois vers le bas (le temps restant a été réduit à 10s) puis poursuit
     *  son décompte normal — plus de reset à plein. Le prochain tick du countdown
     *  (déjà actif) repeint la largeur et gère la classe timer-urgent. */
    function enterGracePhase(graceEndsAtMs) {
        gracePhase = true;
        endsAt = graceEndsAtMs;
    }

    /** Affiche le nom du jeu en fin de manche (pour tous les joueurs)
     *  ET démarre un compte à rebours visuel des 3.5s avant le prochain round
     *  (sinon le timer reste figé sur sa dernière valeur). */
    function showReveal(round) {
        if (revealShown) return;
        revealShown = true;
        clearCountdown();
        inputEl.disabled = true;
        removeArrows();
        messageEl.innerHTML = `📜 La réponse était : <strong>${escapeHtml(round.gameTitle)}</strong>`;
        messageEl.style.color = '#ffb86b';

        // Compte à rebours visuel des 3.5s d'affichage de la réponse
        // (doit matcher le setTimeout(3500) dans host-engine.js::finalizeRound)
        startRevealCountdown(3500);
    }

    /** Mini-countdown pour la phase de révélation : barre + secondes restantes */
    function startRevealCountdown(durationMs) {
        clearCountdown();
        const startedAt = Date.now();
        const endsAtLocal = startedAt + durationMs;
        if (timerBarFillEl) {
            timerBarFillEl.classList.remove('timer-urgent');
            timerBarFillEl.style.width = '100%';
        }
        countdownInterval = setInterval(() => {
            const remainingMs = Math.max(0, endsAtLocal - Date.now());
            const secs = Math.max(0, Math.ceil(remainingMs / 1000));
            timerEl.innerText = `${String(secs).padStart(2, '0')}s`;
            if (timerBarFillEl) {
                const ratio = Math.max(0, Math.min(1, remainingMs / durationMs));
                timerBarFillEl.style.width = `${ratio * 100}%`;
            }
            if (remainingMs <= 0) {
                clearCountdown();
            }
        }, 100);
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
        // Crée les flèches de nav dès qu'on a au moins 2 indices débloqués
        if (maxUnlockedHint >= 1 && !arrowsCreated && totalHints > 1) {
            createNavArrows();
        }
        updateArrowsVisibility();
    }

    /** Crée des flèches DOM (←/→) pour naviguer entre indices débloqués */
    function createNavArrows() {
        if (arrowsCreated) return;
        const parent = contentContainer.parentElement || contentContainer;
        const left = document.createElement('button');
        left.id = 'multi-prev-hint';
        left.className = 'multi-hint-arrow multi-hint-arrow-left';
        left.innerHTML = '&#9664;';
        left.title = 'Indice précédent (←)';
        left.onclick = () => navigateHint(-1);

        const right = document.createElement('button');
        right.id = 'multi-next-hint';
        right.className = 'multi-hint-arrow multi-hint-arrow-right';
        right.innerHTML = '&#9654;';
        right.title = 'Indice suivant (→)';
        right.onclick = () => navigateHint(1);

        parent.appendChild(left);
        parent.appendChild(right);
        arrowsCreated = true;
    }

    function removeArrows() {
        const left = document.getElementById('multi-prev-hint');
        const right = document.getElementById('multi-next-hint');
        if (left) left.remove();
        if (right) right.remove();
        arrowsCreated = false;
    }

    function updateArrowsVisibility() {
        const left = document.getElementById('multi-prev-hint');
        const right = document.getElementById('multi-next-hint');
        if (!left || !right) return;
        left.style.display = currentHintIndex > 0 ? 'flex' : 'none';
        right.style.display = currentHintIndex < maxUnlockedHint ? 'flex' : 'none';
    }

    async function navigateHint(direction) {
        if (revealShown) return;
        const newIndex = currentHintIndex + direction;
        if (newIndex < 0 || newIndex > maxUnlockedHint) return;
        currentHintIndex = newIndex;
        await renderers[currentMode](currentGame, currentHintIndex, contentContainer);
        updateArrowsVisibility();
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    async function submitAnswer() {
        if (hasAnswered || !currentGame) return;
        const input = inputEl.value;
        if (checkAnswerValue(input, currentGame.title)) {
            hasAnswered = true;
            inputEl.disabled = true;
            // Bouton indice inerte une fois la reponse donnee : on le desactive
            // visuellement (sinon il reste cliquable mais useHint() return early
            // a cause de hasAnswered -> impression de bouton casse). (#48)
            hintButton.disabled = true;
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
        hintButton.disabled = true; // plus d'indice apres abandon (#48)
        messageEl.innerText = '🏳️ Tu as abandonné';
        messageEl.style.color = '#aaa';
        await set(ref(db, `rooms/${code}/game/currentRound/results/${uid}`), {
            status: 'abandoned',
            foundAt: null,
            hintsUsed: maxUnlockedHint,
        });
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
            return;
        }

        // Pas le round courant ? ignore
        if (round.roundId !== currentRoundId) return;

        // Bascule grace ? (premier hit détecté → 10s restants)
        if (round.graceEndsAt && !gracePhase && !round.endedAt) {
            enterGracePhase(round.graceEndsAt);
        }

        // Fin de manche (réussite OU échec collectif) → afficher le nom du jeu
        if (round.endedAt && !revealShown) {
            showReveal(round);
        }
    });

    // Wire Enter key pour soumission + flèches pour naviguer entre indices
    inputEl.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submitAnswer();
        }
    });

    // Flèches du clavier pour naviguer entre indices
    // Marche même si l'input a le focus, TANT QUE l'input est vide (sinon
    // on laisse le browser déplacer le curseur dans le texte saisi)
    const arrowKeyHandler = (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        if (document.activeElement === inputEl && inputEl.value.length > 0) return;
        e.preventDefault();
        if (e.key === 'ArrowLeft') navigateHint(-1);
        if (e.key === 'ArrowRight') navigateHint(1);
    };
    document.addEventListener('keydown', arrowKeyHandler);

    // Wire bouton Valider (s'il existe)
    const checkBtn = document.getElementById('multi-check-btn');
    if (checkBtn) checkBtn.onclick = submitAnswer;

    return {
        stop() {
            clearCountdown();
            removeArrows();
            document.removeEventListener('keydown', arrowKeyHandler);
            off(roomRef);
        },
    };
}
