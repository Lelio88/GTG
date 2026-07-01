/**
 * achievements.js — Systeme de succes (solo, 100 % localStorage).
 *
 * ROLE
 *   Definit le catalogue des succes et fournit la logique pour :
 *     - calculer quels succes sont debloques pour un profil donne
 *       (DERIVE des donnees existantes : aucune duplication d'etat) ;
 *     - detecter les succes fraichement debloques pour les notifier
 *       (via le champ `profile.seenAchievements`) ;
 *     - afficher un toast facon Steam (badge qui monte depuis le bas-droite
 *       + petit son synthetise en Web Audio) quand un succes tombe.
 *
 *   Catalogue : pour chacun des 8 modes -> 3 paliers (Complete / Sans-faute /
 *   Eclair <10s par question) = 24 succes, + 1 succes "666 mauvaises reponses"
 *   qui declenche aussi le theme Enfer (cf. hellMode.js).
 *
 * INVARIANTS
 *   - Les succes de progression sont MONOTONES (compteurs croissants). Le
 *     palier "Eclair" depend de `slowestAnswerByMode` (pire temps d'une bonne
 *     reponse du mode) rempli par gameUtils.updateProfile.
 *   - `check(profile)` doit etre PUR et defensif (profil incomplet -> jamais
 *     de throw : safeCheck).
 *   - `seenAchievements` (tableau d'IDs) est cree PARESSEUSEMENT a la premiere
 *     synchro. Baseline silencieuse : au tout premier passage, l'etat courant
 *     est marque "vu" SANS notifier (pas de spam retroactif).
 *   - Persistance uniquement via profileStore.updateCurrent (atomique,
 *     cross-onglet). Jamais de localStorage direct ici.
 *
 * IDS DOM
 *   - Cree et gere `#gtg-ach-toaster` (conteneur fixe des toasts).
 *
 * DEPENDANCES
 *   - state/profileStore.js (lecture + updateCurrent)
 *   - hellMode.js (HELL_THRESHOLD = 666, partage avec le succes 666)
 *
 * CONSOMMATEURS
 *   - hub.js    : syncSeenAchievements() + showAchievementToast() au chargement
 *   - trophy.js : getAchievements() pour la grille + markAllSeen()
 */

import { profileStore } from './state/profileStore.js';
import { HELL_THRESHOLD } from './hellMode.js';

// Seuil du succes vitesse : chaque question resolue en moins de 10 s.
const SPEED_LIMIT_SECONDS = 10;

// Les 8 modes (base + hardcore) avec leur libelle + icone d'affichage.
const MODES = [
    { key: 'full',      label: 'Full',      icon: '🎯' },
    { key: 'image',     label: 'Image',     icon: '🖼️' },
    { key: 'sound',     label: 'Sound',     icon: '🔊' },
    { key: 'text',      label: 'Text',      icon: '📝' },
    { key: 'pixelated', label: 'Pixelated', icon: '👾' },
    { key: 'midi',      label: 'MIDI',      icon: '🎹' },
    { key: 'shadow',    label: 'Shadow',    icon: '🌑' },
    { key: 'emoji',     label: 'Emoji',     icon: '😀' },
    { key: 'geo',       label: 'Geo',       icon: '🌍' },
];

// === Helpers derives (tous defensifs vis-a-vis d'un profil incomplet) ===

function isCompleted(p, mode) {
    return Array.isArray(p.completedModes) && p.completedModes.includes(mode);
}

function badAnswers(p, mode) {
    const s = p.scoresByMode && p.scoresByMode[mode];
    return s && typeof s.badAnswers === 'number' ? s.badAnswers : 0;
}

// Pire temps (secondes) d'une bonne reponse du mode, ou null si non mesure.
function slowestAnswer(p, mode) {
    const t = p.slowestAnswerByMode && p.slowestAnswerByMode[mode];
    return typeof t === 'number' ? t : null;
}

function totalBadAnswers(p) {
    const byMode = p.scoresByMode || {};
    return Object.values(byMode).reduce((n, s) => n + ((s && s.badAnswers) || 0), 0);
}

// Les 3 paliers appliques a chaque mode.
const TIERS = [
    {
        suffix: 'complete', icon: '🏅', label: 'Complété',
        desc: (m) => `Termine le mode ${m.label} en entier.`,
        check: (m) => (p) => isCompleted(p, m.key),
    },
    {
        suffix: 'flawless', icon: '💎', label: 'Sans-faute',
        desc: (m) => `Termine le mode ${m.label} sans aucune mauvaise réponse.`,
        check: (m) => (p) => isCompleted(p, m.key) && badAnswers(p, m.key) === 0,
    },
    {
        suffix: 'speed', icon: '⚡', label: 'Éclair',
        desc: (m) => `Termine le mode ${m.label} sans faute et en moins de ${SPEED_LIMIT_SECONDS} s par question.`,
        check: (m) => (p) => {
            if (!isCompleted(p, m.key) || badAnswers(p, m.key) !== 0) return false;
            const slow = slowestAnswer(p, m.key);
            return slow != null && slow < SPEED_LIMIT_SECONDS;
        },
    },
];

/**
 * Catalogue des succes. 8 modes x 3 paliers + le succes "666".
 * Chaque entree : { id, icon, title, description, group, groupKey, groupIcon,
 *                   check(profile)->bool }.
 */
export const ACHIEVEMENTS = [
    ...MODES.flatMap((m) => TIERS.map((t) => ({
        id: `${t.suffix}-${m.key}`,
        icon: t.icon,
        title: `${m.label} — ${t.label}`,
        description: t.desc(m),
        group: m.label,
        groupKey: m.key,
        groupIcon: m.icon,
        check: t.check(m),
    }))),
    {
        id: 'hell-666',
        icon: '😈',
        title: '666 — Les Enfers',
        description: 'Atteins 666 mauvaises réponses. De 666 à 777, le monde bascule dans les flammes…',
        group: 'Malédiction',
        groupKey: '_special',
        groupIcon: '🔥',
        check: (p) => totalBadAnswers(p) >= HELL_THRESHOLD,
    },
];

const ACHIEVEMENTS_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

// Evalue un check en absorbant toute erreur (profil corrompu -> non debloque).
function safeCheck(def, profile) {
    try {
        return !!def.check(profile);
    } catch (err) {
        console.error(`Succes "${def.id}" : check a echoue`, err);
        return false;
    }
}

/**
 * Ensemble des IDs de succes debloques pour ce profil.
 * @param {Object} profile
 * @returns {Set<string>}
 */
export function computeUnlockedIds(profile) {
    const ids = new Set();
    if (!profile) return ids;
    for (const def of ACHIEVEMENTS) {
        if (safeCheck(def, profile)) ids.add(def.id);
    }
    return ids;
}

/**
 * Etat complet du catalogue pour un profil : chaque succes + son statut.
 * @param {Object} profile
 * @returns {Array<{id, icon, title, description, group, groupKey, groupIcon, unlocked}>}
 */
export function getAchievements(profile) {
    return ACHIEVEMENTS.map((def) => ({
        id: def.id,
        icon: def.icon,
        title: def.title,
        description: def.description,
        group: def.group,
        groupKey: def.groupKey,
        groupIcon: def.groupIcon,
        unlocked: profile ? safeCheck(def, profile) : false,
    }));
}

/**
 * Detecte les succes fraichement debloques depuis la derniere synchro et
 * met a jour `profile.seenAchievements` (persiste via profileStore).
 *
 * Baseline silencieuse : si `seenAchievements` n'existe pas encore, on
 * enregistre l'etat courant SANS rien notifier.
 *
 * @returns {{ newly: Array<Object>, baseline: boolean }}
 */
export function syncSeenAchievements() {
    const profile = profileStore.getCurrent();
    if (!profile) return { newly: [], baseline: false };

    // Premiere synchro : on pose la baseline sans notifier.
    if (!Array.isArray(profile.seenAchievements)) {
        profileStore.updateCurrent((p) => {
            if (!Array.isArray(p.seenAchievements)) {
                p.seenAchievements = [...computeUnlockedIds(p)];
            }
            return p;
        });
        return { newly: [], baseline: true };
    }

    const seen = new Set(profile.seenAchievements);
    const newlyIds = [...computeUnlockedIds(profile)].filter((id) => !seen.has(id));
    if (newlyIds.length === 0) return { newly: [], baseline: false };

    // Defense en profondeur : on recalcule sur le profil frais dans l'updater.
    profileStore.updateCurrent((p) => {
        const s = new Set(Array.isArray(p.seenAchievements) ? p.seenAchievements : []);
        for (const id of computeUnlockedIds(p)) s.add(id);
        p.seenAchievements = [...s];
        return p;
    });

    const newly = newlyIds.map((id) => ACHIEVEMENTS_BY_ID[id]).filter(Boolean);
    return { newly, baseline: false };
}

/**
 * Marque comme "vus" tous les succes actuellement debloques (union avec
 * l'existant). Appele par la page Trophees.
 */
export function markAllSeen() {
    profileStore.updateCurrent((p) => {
        const s = new Set(Array.isArray(p.seenAchievements) ? p.seenAchievements : []);
        for (const id of computeUnlockedIds(p)) s.add(id);
        p.seenAchievements = [...s];
        return p;
    });
}

// === Toast "succes debloque" facon Steam (bas-droite -> monte + son) =======
//
// Le badge glisse vers le HAUT a l'apparition (ancre en bas-droite, il pousse
// les precedents vers le haut facon Steam). Un petit son de succes SYNTHETISE
// (Web Audio API : aucun asset requis, file://-compatible, pas de droits) est
// joue en meme temps. Best-effort audio : la politique d'autoplay peut
// retarder le son jusqu'au 1er geste utilisateur -> on installe un "unlock"
// sur pointerdown/keydown. Le toast VISUEL fonctionne toujours.

const TOAST_STYLE_ID = 'gtg-ach-toast-styles';
const TOASTER_ID = 'gtg-ach-toaster';
const TOAST_DURATION_MS = 4500;

function ensureToastStyles() {
    if (document.getElementById(TOAST_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = TOAST_STYLE_ID;
    style.textContent = `
        #${TOASTER_ID} {
            position: fixed;
            bottom: 88px;           /* degage le footer du hub */
            right: 20px;
            display: flex;
            flex-direction: column; /* nouveau en bas -> pousse les anciens vers le haut */
            align-items: flex-end;
            gap: 10px;
            z-index: 10000;
            pointer-events: none;
            max-width: min(340px, 92vw);
        }
        .gtg-ach-toast {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 16px 10px 12px;
            background: linear-gradient(135deg, rgba(20, 9, 30, 0.97), rgba(28, 14, 40, 0.97));
            border: 1px solid var(--neon-success, #39ff14);
            border-left: 4px solid var(--neon-success, #39ff14);
            border-radius: 10px;
            box-shadow:
                0 0 18px rgba(57, 255, 20, 0.3),
                0 8px 24px rgba(0, 0, 0, 0.5);
            color: var(--text-primary, #e8e1f5);
            font-family: var(--font-ui, 'Rajdhani', sans-serif);
            pointer-events: auto;
            animation: gtg-ach-in 0.45s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .gtg-ach-toast.gtg-ach-out {
            animation: gtg-ach-out 0.35s ease forwards;
        }
        .gtg-ach-toast__icon {
            font-size: 1.8rem;
            line-height: 1;
            flex-shrink: 0;
            filter: drop-shadow(0 0 8px rgba(57, 255, 20, 0.6));
        }
        .gtg-ach-toast__eyebrow {
            font-family: var(--font-display, 'Orbitron', sans-serif);
            font-size: 0.62rem;
            font-weight: 700;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: var(--neon-success, #39ff14);
            text-shadow: 0 0 8px rgba(57, 255, 20, 0.5);
        }
        .gtg-ach-toast__title {
            font-size: 1rem;
            font-weight: 700;
            color: var(--text-primary, #e8e1f5);
        }
        @keyframes gtg-ach-in {
            from { opacity: 0; transform: translateY(120%); }
            to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes gtg-ach-out {
            from { opacity: 1; transform: translateY(0); }
            to   { opacity: 0; transform: translateY(120%); }
        }
        @media (prefers-reduced-motion: reduce) {
            .gtg-ach-toast, .gtg-ach-toast.gtg-ach-out { animation: none; }
        }
    `;
    document.head.appendChild(style);
}

function ensureToaster() {
    let toaster = document.getElementById(TOASTER_ID);
    if (!toaster) {
        toaster = document.createElement('div');
        toaster.id = TOASTER_ID;
        toaster.setAttribute('role', 'status');
        toaster.setAttribute('aria-live', 'polite');
        document.body.appendChild(toaster);
    }
    return toaster;
}

// --- Son de succes (Web Audio API, synthetise) ---
let audioCtx = null;
let audioUnlockInstalled = false;

function getAudioCtx() {
    if (audioCtx) return audioCtx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
        audioCtx = new AC();
    } catch {
        return null;
    }
    return audioCtx;
}

// Autoplay policy : reprend le contexte audio au tout premier geste utilisateur.
function installAudioUnlock() {
    if (audioUnlockInstalled) return;
    audioUnlockInstalled = true;
    const resume = () => {
        const ctx = getAudioCtx();
        if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    };
    window.addEventListener('pointerdown', resume, { once: true });
    window.addEventListener('keydown', resume, { once: true });
}

// Petit arpege montant facon "succes" (E5 -> B5 -> E6), enveloppe douce.
function playAchievementSound() {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    const notes = [659.25, 987.77, 1318.51]; // E5, B5, E6
    notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const t0 = now + i * 0.09;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.32);
    });
}

/**
 * Affiche un toast "Succes debloque" facon Steam (monte depuis le bas) + son.
 * Le texte est insere via textContent -> aucun risque d'injection.
 * @param {{icon: string, title: string}} def - definition du succes
 */
export function showAchievementToast(def) {
    if (!def) return;
    ensureToastStyles();
    installAudioUnlock();
    const toaster = ensureToaster();

    const toast = document.createElement('div');
    toast.className = 'gtg-ach-toast';

    const icon = document.createElement('span');
    icon.className = 'gtg-ach-toast__icon';
    icon.textContent = def.icon || '🏆';
    icon.setAttribute('aria-hidden', 'true');

    const body = document.createElement('div');
    const eyebrow = document.createElement('div');
    eyebrow.className = 'gtg-ach-toast__eyebrow';
    eyebrow.textContent = 'Succès débloqué';
    const title = document.createElement('div');
    title.className = 'gtg-ach-toast__title';
    title.textContent = def.title || '';
    body.appendChild(eyebrow);
    body.appendChild(title);

    toast.appendChild(icon);
    toast.appendChild(body);
    toaster.appendChild(toast);

    playAchievementSound();

    const dismiss = () => {
        if (!toast.parentNode) return;
        toast.classList.add('gtg-ach-out');
        toast.addEventListener('animationend', () => toast.remove(), { once: true });
        // Filet de securite si animationend ne se declenche pas (reduced-motion).
        setTimeout(() => toast.remove(), 400);
    };

    toast.addEventListener('click', dismiss);
    setTimeout(dismiss, TOAST_DURATION_MS);
}

// === Notification "in-game" ================================================
//
// Pendant une partie, chaque mise a jour de profil dispatch 'gtg:profile-updated'
// (depuis gameUtils.updateProfile et gameCompletion.handleGameCompletion). On
// notifie alors les succes fraichement debloques AU MOMENT ou ils tombent : le
// clic/Entree du joueur debloque aussi l'audio, donc le son passe.

/**
 * Joue les toasts (+ son) pour les succes fraichement debloques.
 */
export function notifyNewlyUnlocked() {
    const { newly } = syncSeenAchievements();
    newly.forEach((def, i) => setTimeout(() => showAchievementToast(def), i * 250));
}

let achievementWatchInstalled = false;

/**
 * Installe (une seule fois) l'ecoute in-game. Appele par gameCompletion.js,
 * importe par les 8 modes -> couvre toutes les pages de jeu sans les toucher.
 */
export function watchAchievements() {
    if (achievementWatchInstalled || typeof window === 'undefined') return;
    achievementWatchInstalled = true;
    window.addEventListener('gtg:profile-updated', notifyNewlyUnlocked);
}
