/**
 * trophy.js — Page Trophées (succès solo).
 *
 * ROLE
 *   Rend la grille des succès pour le profil courant, GROUPÉE par mode
 *   (chaque mode : Complété / Sans-faute / Éclair) + une section « Malédiction »
 *   (succès 666). Affiche la progression globale (X / N) et marque tous les
 *   succès débloqués comme « vus » pour qu'ils ne re-notifient pas au hub.
 *   Applique aussi le thème Enfer si le profil a franchi 666 mauvaises réponses.
 *
 * IDS DOM attendus (HTML/trophy.html)
 *   - #trophy-grid      : conteneur des sections
 *   - #trophy-progress  : compteur "X / N débloqués"
 *
 * DEPENDANCES
 *   - state/profileStore.js (profil courant)
 *   - achievements.js       (getAchievements, markAllSeen)
 *   - hellMode.js           (applyHellMode)
 */

import { profileStore } from './state/profileStore.js';
import { getAchievements, markAllSeen } from './achievements.js';
import { applyHellMode } from './hellMode.js';
import { showConfirm } from './ui/dialog.js';
import { resetModeProgress } from './state/modeReset.js';

const grid = document.getElementById('trophy-grid');
const progressEl = document.getElementById('trophy-progress');

/**
 * Construit une carte de succès (DOM pur, textContent -> pas d'injection).
 * @param {{icon,title,description,unlocked}} a
 * @returns {HTMLElement}
 */
function buildCard(a) {
    const card = document.createElement('article');
    card.className = `trophy-card ${a.unlocked ? 'unlocked' : 'locked'}`;

    const icon = document.createElement('div');
    icon.className = 'trophy-card__icon';
    icon.textContent = a.icon;
    icon.setAttribute('aria-hidden', 'true');

    const title = document.createElement('h3');
    title.className = 'trophy-card__title';
    title.textContent = a.title;

    const desc = document.createElement('p');
    desc.className = 'trophy-card__desc';
    desc.textContent = a.description;

    const status = document.createElement('span');
    status.className = 'trophy-card__status';
    status.textContent = a.unlocked ? 'Débloqué' : 'Verrouillé';

    card.append(icon, title, desc, status);
    return card;
}

/**
 * Construit une section de groupe (mode) : en-tête + sous-grille de cartes.
 * @param {{label, icon, items: Array}} group
 * @returns {HTMLElement}
 */
function buildGroup(group) {
    const section = document.createElement('section');
    section.className = 'trophy-group';

    const header = document.createElement('div');
    header.className = 'trophy-group__header';

    const gicon = document.createElement('span');
    gicon.className = 'trophy-group__icon';
    gicon.textContent = group.icon;
    gicon.setAttribute('aria-hidden', 'true');

    const gtitle = document.createElement('h2');
    gtitle.className = 'trophy-group__title';
    gtitle.textContent = group.label;

    const gcount = document.createElement('span');
    gcount.className = 'trophy-group__count';
    const unlocked = group.items.filter((i) => i.unlocked).length;
    gcount.textContent = `${unlocked}/${group.items.length}`;

    header.append(gicon, gtitle, gcount);

    // Bouton "Rejouer" : réinitialise le mode pour retenter Sans-faute / Éclair.
    // Pas sur la section spéciale (Malédiction).
    if (group.key !== '_special') {
        const replay = document.createElement('button');
        replay.type = 'button';
        replay.className = 'trophy-replay';
        replay.textContent = '↻ Rejouer';
        replay.title = `Réinitialiser ta progression du mode ${group.label} pour retenter les succès`;
        replay.addEventListener('click', () => onReplay(group));
        header.append(replay);
    }

    const items = document.createElement('div');
    items.className = 'trophy-group__items';
    group.items.forEach((a) => items.appendChild(buildCard(a)));

    section.append(header, items);
    return section;
}

// Réinitialise un mode (après confirmation) puis redirige vers ce mode pour
// rejouer immédiatement. Clés et modes hardcore conservés (cf. modeReset.js).
async function onReplay(group) {
    const ok = await showConfirm(
        `Réinitialiser ta progression du mode ${group.label} pour retenter les succès Sans-faute / Éclair ?\n\nTes clés et modes hardcore débloqués sont conservés.`,
        { title: `Rejouer ${group.label}`, okText: 'Rejouer', cancelText: 'Annuler' }
    );
    if (!ok) return;
    resetModeProgress(group.key);
    window.location.href = `${group.key}.html`;
}

function renderEmpty(message) {
    const empty = document.createElement('p');
    empty.className = 'trophy-empty';
    empty.textContent = message;
    grid.appendChild(empty);
}

// Regroupe la liste plate par groupKey, dans l'ordre d'apparition du catalogue.
function groupByMode(achievements) {
    const groups = [];
    const byKey = new Map();
    for (const a of achievements) {
        if (!byKey.has(a.groupKey)) {
            const g = { key: a.groupKey, label: a.group, icon: a.groupIcon, items: [] };
            byKey.set(a.groupKey, g);
            groups.push(g);
        }
        byKey.get(a.groupKey).items.push(a);
    }
    return groups;
}

function init() {
    const profile = profileStore.getCurrent();
    applyHellMode(profile); // coherence visuelle si le profil est en enfer

    if (!profile) {
        progressEl.textContent = '';
        renderEmpty('Aucun profil sélectionné. Reviens depuis la chambre après avoir choisi un profil.');
        return;
    }

    const achievements = getAchievements(profile);
    const unlockedCount = achievements.filter((a) => a.unlocked).length;
    progressEl.textContent = `${unlockedCount} / ${achievements.length} débloqués`;

    const fragment = document.createDocumentFragment();
    groupByMode(achievements).forEach((g) => fragment.appendChild(buildGroup(g)));
    grid.appendChild(fragment);

    // Consulter la page = tout ce qui est debloque est desormais "vu".
    markAllSeen();
}

init();
