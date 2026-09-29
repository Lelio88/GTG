/**
 * JS/multi/consentement.js — Accord du joueur avant le chargement de reCAPTCHA.
 *
 * Le multi est protégé par App Check, dont le fournisseur web est reCAPTCHA v3 de
 * Google. reCAPTCHA dépose des cookies et analyse la navigation pour le compte de
 * Google : la CNIL le soumet au consentement. firebase.js attend donc
 * `obtenirConsentement()` avant d'initialiser App Check ; sans accord, pas de multi.
 *
 * Choix non évidents :
 * - Preuve du consentement (guide de conformité §A4) : date, version du texte et
 *   portée, gardées dans le localStorage (clé multi, jamais dans les clés solo).
 * - L'accord expire au bout de 6 mois (recommandation CNIL) ; changer le texte
 *   impose d'incrémenter VERSION, ce qui redemande l'accord à tous.
 * - Le retrait (`retirerConsentement`) est proposé dans le lobby multi et sur
 *   privacy.html : il doit rester aussi simple que l'accord.
 *
 * Dépendances : ../ui/dialog.js (showConfirm). Aucun ID DOM attendu.
 *
 * Usage :
 *   if (!(await obtenirConsentement())) { … pas de multi … }
 */
import { showConfirm } from '../ui/dialog.js';

const CLE = 'gtg_multi_consentement';
const VERSION = 1;
const PORTEE = 'recaptcha';
const VALIDITE_MS = 182 * 24 * 3600 * 1000;

const TEXTE = [
    'Le mode multijoueur est protégé contre les robots par reCAPTCHA, un service de Google.',
    '',
    'reCAPTCHA dépose des cookies et analyse ta navigation sur les pages du multi ; Google traite ces données selon ses propres règles.',
    '',
    'Sans ton accord, le multijoueur n\'est pas disponible. Le solo reste accessible sans rien partager.',
    '',
    'Tu pourras retirer ton accord depuis la page du multi ou la page Confidentialité (lien en bas de l\'accueil).',
].join('\n');

/** Accord valide et en cours ({ version, date, portee }), ou null. */
export function lireConsentement() {
    try {
        const accord = JSON.parse(localStorage.getItem(CLE) || 'null');
        if (!accord || accord.version !== VERSION || accord.portee !== PORTEE) return null;
        if (typeof accord.date !== 'number' || Date.now() - accord.date > VALIDITE_MS) return null;
        return accord;
    } catch {
        return null;
    }
}

/** Résout true si l'accord est déjà donné, ou si le joueur l'accepte maintenant. */
export async function obtenirConsentement() {
    if (lireConsentement()) return true;
    const accepte = await showConfirm(TEXTE, {
        title: 'Multijoueur et reCAPTCHA',
        okText: 'Accepter et jouer',
        cancelText: 'Refuser',
    });
    if (accepte) {
        try {
            localStorage.setItem(CLE, JSON.stringify({ version: VERSION, date: Date.now(), portee: PORTEE }));
        } catch {
            // Stockage indisponible : l'accord vaut pour cette page seulement.
        }
    }
    return accepte;
}

/** Retire l'accord : il sera redemandé à la prochaine entrée dans le multi. */
export function retirerConsentement() {
    try { localStorage.removeItem(CLE); } catch { /* rien à retirer */ }
}
