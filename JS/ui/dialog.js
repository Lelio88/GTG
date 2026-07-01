/**
 * dialog.js - Modales neon pour remplacer alert/prompt/confirm natifs.
 *
 * API :
 *   showAlert(message, options?)   -> Promise<void>
 *   showConfirm(message, options?) -> Promise<boolean>      true = OK, false = annule
 *   showPrompt(message, options?)  -> Promise<string|null>  null = annule
 *
 * Options communes :
 *   title       string  - titre de la modale (optionnel)
 *   okText      string  - libelle bouton principal (defaut: 'OK')
 *   cancelText  string  - libelle bouton annuler (defaut: 'Annuler', confirm/prompt)
 *
 * Options propres a showPrompt :
 *   defaultValue string - valeur initiale de l'input
 *   placeholder  string - placeholder de l'input
 *   maxLength    number - longueur max acceptee
 *
 * Comportement :
 *   - Une seule modale a la fois (queue) -- chaque appel attend le precedent.
 *   - Echap = bouton secondaire (annule confirm/prompt, ferme alert).
 *   - Enter sur le bouton principal valide (et sur l'input pour prompt).
 *   - Le focus va sur le bouton principal (ou l'input pour prompt) a l'ouverture.
 *   - Clic dans le backdrop : ne ferme PAS (evite les pertes accidentelles).
 *
 * Le CSS est injecte une seule fois au premier import (pas besoin d'ajouter
 * un <link> dans chaque HTML).
 */

// === Injection du CSS une seule fois ===
const STYLE_ID = 'gtg-dialog-styles';
export function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        .gtg-dialog-backdrop {
            position: fixed;
            inset: 0;
            background: rgba(8, 4, 15, 0.78);
            backdrop-filter: blur(6px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            animation: gtg-dialog-fade-in 0.18s ease-out;
            font-family: 'Rajdhani', 'Poppins', sans-serif;
        }

        @keyframes gtg-dialog-fade-in {
            from { opacity: 0; }
            to   { opacity: 1; }
        }

        .gtg-dialog-card {
            position: relative;
            min-width: 320px;
            max-width: min(540px, 90vw);
            padding: clamp(1.5rem, 4vw, 2.25rem);
            background: rgba(20, 9, 30, 0.95);
            border: 1px solid rgba(255, 184, 107, 0.35);
            border-radius: 14px;
            box-shadow:
                0 0 25px rgba(255, 184, 107, 0.18),
                0 0 60px rgba(255, 107, 159, 0.1),
                inset 0 1px 0 rgba(255, 255, 255, 0.05);
            color: #e8e1f5;
            animation: gtg-dialog-pop-in 0.22s cubic-bezier(0.34, 1.5, 0.64, 1);
        }

        @keyframes gtg-dialog-pop-in {
            from { opacity: 0; transform: scale(0.92) translateY(8px); }
            to   { opacity: 1; transform: scale(1) translateY(0); }
        }

        .gtg-dialog-title {
            font-family: 'Orbitron', 'Poppins', sans-serif;
            font-size: 1.15rem;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: #00f6ff;
            text-shadow: 0 0 8px rgba(0, 246, 255, 0.5);
            margin: 0 0 0.75rem 0;
        }

        .gtg-dialog-message {
            font-size: 1rem;
            line-height: 1.55;
            color: #e8e1f5;
            margin: 0 0 1.5rem 0;
            white-space: pre-wrap;
            word-wrap: break-word;
        }

        .gtg-dialog-input {
            display: block;
            width: 100%;
            box-sizing: border-box;
            padding: 0.65rem 0.9rem;
            margin-bottom: 1.25rem;
            background: rgba(8, 4, 15, 0.7);
            border: 1px solid rgba(255, 184, 107, 0.35);
            border-radius: 8px;
            color: #e8e1f5;
            font-family: 'Share Tech Mono', 'Courier New', monospace;
            font-size: 1rem;
            outline: none;
            transition: border-color 0.18s ease, box-shadow 0.18s ease;
        }

        .gtg-dialog-input:focus {
            border-color: rgba(0, 246, 255, 0.7);
            box-shadow: 0 0 12px rgba(0, 246, 255, 0.35);
        }

        .gtg-dialog-actions {
            display: flex;
            gap: 0.75rem;
            justify-content: flex-end;
            flex-wrap: wrap;
        }

        .gtg-dialog-btn {
            padding: 0.6rem 1.4rem;
            font-family: 'Orbitron', 'Poppins', sans-serif;
            font-weight: 700;
            font-size: 0.85rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            border: none;
            border-radius: 999px;
            cursor: pointer;
            transition: transform 0.15s ease, box-shadow 0.15s ease;
        }

        .gtg-dialog-btn:hover {
            transform: translateY(-1px);
        }

        .gtg-dialog-btn:active {
            transform: translateY(0);
        }

        .gtg-dialog-btn-primary {
            color: #08040f;
            background: linear-gradient(135deg, #ffb86b, #ff6b9f);
            box-shadow: 0 0 18px rgba(255, 184, 107, 0.4);
        }

        .gtg-dialog-btn-primary:hover {
            box-shadow: 0 0 26px rgba(255, 184, 107, 0.65);
        }

        .gtg-dialog-btn-secondary {
            color: #e8e1f5;
            background: transparent;
            border: 1px solid rgba(255, 184, 107, 0.4);
        }

        .gtg-dialog-btn-secondary:hover {
            border-color: rgba(0, 246, 255, 0.7);
            color: #00f6ff;
        }

        @media (prefers-reduced-motion: reduce) {
            .gtg-dialog-backdrop,
            .gtg-dialog-card {
                animation: none;
            }
        }
    `;
    document.head.appendChild(style);
}

// === Queue pour eviter deux modales en parallele ===
let modalQueue = Promise.resolve();

function openModal({ type, message, options = {} }) {
    ensureStyles();
    const next = modalQueue.then(() => new Promise((resolve) => {
        const {
            title = '',
            okText = 'OK',
            cancelText = 'Annuler',
            defaultValue = '',
            placeholder = '',
            maxLength = null,
        } = options;

        const backdrop = document.createElement('div');
        backdrop.className = 'gtg-dialog-backdrop';
        backdrop.setAttribute('role', 'dialog');
        backdrop.setAttribute('aria-modal', 'true');

        const card = document.createElement('div');
        card.className = 'gtg-dialog-card';

        if (title) {
            const h = document.createElement('h2');
            h.className = 'gtg-dialog-title';
            h.textContent = title;
            card.appendChild(h);
            backdrop.setAttribute('aria-labelledby', 'gtg-dlg-title');
            h.id = 'gtg-dlg-title';
        }

        const p = document.createElement('p');
        p.className = 'gtg-dialog-message';
        p.textContent = message;
        card.appendChild(p);

        let input = null;
        if (type === 'prompt') {
            input = document.createElement('input');
            input.className = 'gtg-dialog-input';
            input.type = 'text';
            input.value = defaultValue;
            input.placeholder = placeholder;
            if (maxLength != null) input.maxLength = maxLength;
            card.appendChild(input);
        }

        const actions = document.createElement('div');
        actions.className = 'gtg-dialog-actions';

        let closed = false;
        const close = (result) => {
            if (closed) return;
            closed = true;
            document.removeEventListener('keydown', onDocKey, true);
            backdrop.remove();
            resolve(result);
        };

        if (type === 'confirm' || type === 'prompt') {
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'gtg-dialog-btn gtg-dialog-btn-secondary';
            cancelBtn.textContent = cancelText;
            cancelBtn.onclick = () => close(type === 'prompt' ? null : false);
            actions.appendChild(cancelBtn);
        }

        const okBtn = document.createElement('button');
        okBtn.className = 'gtg-dialog-btn gtg-dialog-btn-primary';
        okBtn.textContent = okText;
        okBtn.onclick = () => {
            if (type === 'prompt') close(input.value);
            else if (type === 'confirm') close(true);
            else close();
        };
        actions.appendChild(okBtn);

        card.appendChild(actions);
        backdrop.appendChild(card);
        document.body.appendChild(backdrop);

        // Focus initial
        if (type === 'prompt') {
            input.focus();
            input.select();
        } else {
            okBtn.focus();
        }

        // Clavier : on capture au niveau document (phase CAPTURE) pour que la
        // modale traite Enter/Escape AVANT les raccourcis clavier de la page
        // derriere. Sans ca, l'Enter qui valide la modale se propage jusqu'a
        // index.js (qui, sur Enter, tente de lancer un profil -> "Aucun profil
        // selectionne"). stopPropagation neutralise cette fuite.
        const onDocKey = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                if (type === 'prompt') close(input.value);
                else if (type === 'confirm') close(true);
                else close();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                if (type === 'prompt') close(null);
                else if (type === 'confirm') close(false);
                else close();
            } else if (type !== 'prompt' &&
                (e.key === ' ' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
                 e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                // Neutralise la navigation clavier de la page derriere la modale
                // (sauf en prompt, ou l'utilisateur doit pouvoir taper espace/fleches).
                e.stopPropagation();
            }
        };
        document.addEventListener('keydown', onDocKey, true);
    }));
    modalQueue = next.catch(() => {}); // re-armer la queue meme en cas d'erreur
    return next;
}

export function showAlert(message, options = {}) {
    return openModal({ type: 'alert', message, options });
}

export function showConfirm(message, options = {}) {
    return openModal({ type: 'confirm', message, options });
}

export function showPrompt(message, options = {}) {
    return openModal({ type: 'prompt', message, options });
}
