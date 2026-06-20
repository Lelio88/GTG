/**
 * JS/multi/firebase.js — Initialisation Firebase + helpers RTDB
 *
 * Source unique de vérité pour la connexion Firebase. Tous les autres modules
 * `JS/multi/*` importent depuis ici (db, auth, helpers).
 *
 * Notes :
 *   - La config ci-dessous (apiKey, etc.) n'est PAS un secret. C'est l'identifiant
 *     public du projet Firebase, lisible côté client comme côté serveur. La sécurité
 *     est garantie par les `database.rules.json` posées dans la console Firebase.
 *   - Imports CDN ESM (pas de bundler, conforme à la doctrine vanilla du projet).
 *   - `signInUserAnonymously()` doit être appelé AVANT tout accès à la DB — les règles
 *     RTDB exigent `auth != null`. Le helper `whenAuthenticated()` retourne une
 *     promesse résolue dès qu'un uid est disponible.
 *
 * Invariants :
 *   - Une seule instance Firebase app (initializeApp idempotent via FirebaseApp).
 *   - L'uid Firebase persiste à travers les F5 (token stocké en IndexedDB) — un joueur
 *     qui recharge la page garde son identité dans la room s'il rejoint à nouveau.
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
    getDatabase, ref, set, get, onValue, off, onDisconnect, push, update,
    runTransaction, serverTimestamp, child, remove
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import {
    getAuth, signInAnonymously, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

const firebaseConfig = {
    apiKey: "AIzaSyC-Twtz41rnk2ngBn1kPnLHEtMQQVGcVOk",
    authDomain: "gtg-multi.firebaseapp.com",
    databaseURL: "https://gtg-multi-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "gtg-multi",
    storageBucket: "gtg-multi.firebasestorage.app",
    messagingSenderId: "312949992950",
    appId: "1:312949992950:web:5052e7b68dde193ea6ebd7"
};

const app = initializeApp(firebaseConfig);

/**
 * App Check (reCAPTCHA v3) — anti-bot, anti-spam.
 * Coller la SITE KEY reCAPTCHA v3 ci-dessous pour activer.
 * Tant que la chaîne est vide, App Check est désactivé (l'app marche
 * normalement, juste sans la protection anti-bot).
 *
 * Setup : voir docs/multiplayer-architecture.md §14.
 */
// App Check ACTIF — clé reCAPTCHA v3 classique. La site key ci-dessous est
// PUBLIQUE (non secrète, comme l'apiKey Firebase). La Secret key associée est
// collée côté Firebase Console (App Check, provider reCAPTCHA v3) et n'apparaît
// JAMAIS dans le repo. Setup complet : docs/multiplayer-architecture.md §13.5.
const RECAPTCHA_SITE_KEY = '6LfxsyktAAAAAMnMtW-7lEdiwVsXU4e0Jb5QM7D2';

if (RECAPTCHA_SITE_KEY) {
    // Import dynamique : ne charge le SDK App Check QUE si une clé est définie
    const appCheckModule = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-check.js');
    appCheckModule.initializeAppCheck(app, {
        provider: new appCheckModule.ReCaptchaV3Provider(RECAPTCHA_SITE_KEY),
        isTokenAutoRefreshEnabled: true,
    });
    console.log('[Firebase] App Check activé (reCAPTCHA v3)');
}

export const db = getDatabase(app);
export const auth = getAuth(app);

// Réexports des helpers RTDB pour que les autres modules n'aient pas à importer du CDN.
export { ref, set, get, onValue, off, onDisconnect, push, update, runTransaction, serverTimestamp, child, remove };

/**
 * Connecte l'utilisateur en anonyme et résout dès qu'un uid est dispo.
 * Idempotent — appel multiple OK, retourne la même promesse en cours.
 */
let authPromise = null;
export function whenAuthenticated() {
    if (authPromise) return authPromise;

    authPromise = new Promise((resolve, reject) => {
        const unsub = onAuthStateChanged(auth, (user) => {
            if (user) {
                unsub();
                resolve(user);
            }
        });
        signInAnonymously(auth).catch((err) => {
            unsub();
            authPromise = null; // libere la promesse rejetee -> autorise un nouvel essai au prochain appel (ex. 1er token App Check en retard au passage en Enforce)
            reject(err);
        });
    });
    return authPromise;
}

/**
 * Génère un code de room à 6 caractères depuis un alphabet sans ambiguïté
 * (pas de 0/O/I/1). Sert à la création de room.
 */
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function genRoomCode(length = 6) {
    let code = '';
    for (let i = 0; i < length; i++) {
        code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
    }
    return code;
}

/**
 * Renvoie `true` si une room existe en DB.
 */
export async function roomExists(code) {
    const snap = await get(ref(db, `rooms/${code}/meta`));
    return snap.exists();
}

/**
 * Trouve un code de room libre. Réessaie jusqu'à `maxAttempts` collisions.
 */
export async function findFreeRoomCode(maxAttempts = 10) {
    for (let i = 0; i < maxAttempts; i++) {
        const code = genRoomCode();
        if (!(await roomExists(code))) return code;
    }
    throw new Error('Impossible de générer un code de room unique');
}
