/**
 * header.js - Barre de navigation commune aux pages de mode (HTML/<mode>.html).
 *
 * Role : remplir le <header id="header-bar"> laisse vide par chaque page de
 * mode avec le logo (retour a l'accueil) et un menu reproduisant les quatre
 * emplacements du hub, plus « Retour au Hub ». Une seule source pour les neuf
 * pages : ajouter ou renommer un mode ne touche plus qu'ici (issues #43, #28).
 *
 * Invariants :
 *   - Meme regle que JS/hub.js : un emplacement affiche le mode hardcore a la
 *     place du mode de base quand le profil a FINI la base ET DEBLOQUE le
 *     hardcore (completedModes + unlockedModes). Le menu ne propose donc
 *     jamais un mode que le hub ne proposerait pas : la progression par cles
 *     n'est pas contournable par la barre.
 *   - Sans profil courant (ou profil inconnu) : les quatre modes de base.
 *   - Le lien de la page courante porte aria-current="page" (style.css).
 *   - Chemins relatifs depuis HTML/ : ../index.html, ../Assets/, ./<mode>.html.
 *   - Construction par API DOM, aucun innerHTML.
 *
 * IDs DOM attendus : #header-bar, vide. Le CSS (#header-bar, #header-logo,
 * #header-bar nav) vit dans CSS/style.css, partage par toutes les pages de mode.
 *
 * Chargement : <script type="module" src="../JS/ui/header.js"> dans le <head>
 * de chaque page de mode. Les modules sont differes : le DOM est pret quand
 * ce fichier s'execute, aucun DOMContentLoaded n'est necessaire.
 *
 * Dependances : state/profileStore.js (profil courant).
 */

import { profileStore } from '../state/profileStore.js';

// Les quatre emplacements du hub, dans son ordre. `hardcore` est l'identifiant
// technique (route vers HTML/<hardcore>.html), les libelles sont ceux affiches.
const HUB_SLOTS = [
    { base: 'full',  baseLabel: 'Full Package', hardcore: 'pixelated', hardcoreLabel: 'Pixelated Mode' },
    { base: 'sound', baseLabel: 'Sound Only',   hardcore: 'midi',      hardcoreLabel: 'MIDI Mode' },
    { base: 'image', baseLabel: 'Image Only',   hardcore: 'shadow',    hardcoreLabel: 'Shadow Mode' },
    { base: 'text',  baseLabel: 'Text Only',    hardcore: 'emoji',     hardcoreLabel: 'Emoji Mode' },
];

const HUB_LINK = { mode: 'hub', label: 'Retour au Hub' };

/**
 * Liens du menu pour un profil donne : un par emplacement du hub, puis le hub.
 * @param {object|null} profile - profil courant, ou null
 * @returns {{mode: string, label: string}[]}
 */
export function resolveNavLinks(profile) {
    const completed = (profile && profile.completedModes) || [];
    const unlocked = (profile && profile.unlockedModes) || [];

    const links = HUB_SLOTS.map(slot => {
        const hardcoreShown = completed.includes(slot.base) && unlocked.includes(slot.hardcore);
        return hardcoreShown
            ? { mode: slot.hardcore, label: slot.hardcoreLabel }
            : { mode: slot.base, label: slot.baseLabel };
    });

    return [...links, HUB_LINK];
}

/** Nom de la page courante sans extension : "HTML/shadow.html" -> "shadow". */
function currentPageMode() {
    const file = window.location.pathname.split('/').pop() || '';
    return decodeURIComponent(file).replace(/\.html$/i, '');
}

/**
 * Construit le contenu de #header-bar. Sans effet si l'element est absent
 * (page qui n'a pas de barre) ou deja rempli (double chargement).
 */
export function renderHeader() {
    const header = document.getElementById('header-bar');
    if (!header || header.childElementCount > 0) return;

    const homeLink = document.createElement('a');
    homeLink.href = '../index.html';
    const logo = document.createElement('img');
    logo.src = '../Assets/Logo.png';
    logo.alt = "Guess The Game - Retour a l'accueil";
    logo.id = 'header-logo';
    homeLink.appendChild(logo);

    const nav = document.createElement('nav');
    const list = document.createElement('ul');
    const current = currentPageMode();

    for (const { mode, label } of resolveNavLinks(profileStore.getCurrent())) {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = `./${mode}.html`;
        link.textContent = label;
        if (mode === current) link.setAttribute('aria-current', 'page');
        item.appendChild(link);
        list.appendChild(item);
    }

    nav.appendChild(list);
    header.append(homeLink, nav);
}

renderHeader();
