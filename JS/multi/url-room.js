/**
 * JS/multi/url-room.js — Parsing et génération des URLs partageables de room
 *
 * Convention : le code de room est passé via le fragment URL (`#room=AB12CD`)
 * pour 2 raisons :
 *   1. Pas envoyé au serveur (utile si on passe un jour derrière un CDN avec logs)
 *   2. Modifiable côté client sans recharger via history.replaceState
 *
 * Exemple : https://.../HTML/multi-room.html#room=AB12CD
 */

const HASH_PREFIX = '#room=';

/**
 * Lit le code de room depuis l'URL courante. Renvoie `null` si absent ou malformé.
 */
export function readRoomCodeFromUrl() {
    const hash = window.location.hash || '';
    if (!hash.startsWith(HASH_PREFIX)) return null;
    const code = hash.slice(HASH_PREFIX.length).trim().toUpperCase();
    return code || null;
}

/**
 * Met à jour l'URL courante avec le code de room (sans recharger la page).
 */
export function writeRoomCodeToUrl(code) {
    const url = new URL(window.location.href);
    url.hash = `${HASH_PREFIX}${code}`;
    window.history.replaceState(null, '', url.toString());
}

/**
 * Génère l'URL absolue d'une room (pour copier dans le presse-papier).
 * Pointe toujours vers multi-room.html.
 */
export function buildShareableUrl(code) {
    const base = new URL('multi-room.html', window.location.href);
    base.hash = `${HASH_PREFIX}${code}`;
    return base.toString();
}
