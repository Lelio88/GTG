/**
 * Teste les règles Realtime Database du multi (database.rules.json) sur l'émulateur.
 *
 * Rejoue, par l'API REST de l'émulateur, chaque écriture de JS/multi/* (création de
 * room, arrivée, réglages de l'hôte, manches, résultats, chat, reprise d'hôte,
 * exclusion, départ, purge des rooms de plus de 24 h), puis leurs détournements :
 * gonfler son score, piéger un champ affiché en innerHTML, parler au nom d'un autre,
 * s'emparer d'une room, écrire sans être joueur.
 *
 * Choix non évidents :
 * - Aucune dépendance npm (fetch natif de Node 18+) : le dépôt reste sans package.json.
 * - L'identité est un jeton non signé (alg « none »), que l'émulateur accepte tel quel.
 * - Les étapes s'enchaînent comme une vraie partie : l'ordre compte.
 *
 * Invariant : toute écriture ajoutée à JS/multi/* reçoit ici un cas « accepté », et son
 * détournement un cas « refusé ».
 *
 * Usage (Java requis par l'émulateur) :
 *   npx firebase-tools emulators:exec --only database "node tests/regles.test.mjs"
 */

const PROJET = 'gtg-multi';
const NS = `${PROJET}-default-rtdb`;
const BASE = `http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1:9000'}`;
const CODE = 'ABCDEF';
const HORLOGE = { '.sv': 'timestamp' };
const JOUR = 24 * 3600 * 1000;

let reussis = 0;
const echecs = [];

function jeton(uid) {
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const t = Math.floor(Date.now() / 1000);
    return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
        iss: `https://securetoken.google.com/${PROJET}`, aud: PROJET, iat: t, exp: t + 3600, auth_time: t,
        sub: uid, user_id: uid, firebase: { sign_in_provider: 'anonymous', identities: {} },
    })}.`;
}

async function requete(qui, methode, chemin, corps, requeteSup = '') {
    const admin = qui === 'admin';
    const auth = qui && !admin ? `&auth=${jeton(qui)}` : '';
    const rep = await fetch(`${BASE}/${chemin}.json?ns=${NS}${auth}${requeteSup}`, {
        method: methode,
        headers: admin ? { Authorization: 'Bearer owner' } : {},
        body: corps === undefined ? undefined : JSON.stringify(corps),
    });
    return { ok: rep.ok, statut: rep.status, corps: await rep.text() };
}

async function attendu(ok, description, qui, methode, chemin, corps, requeteSup) {
    const r = await requete(qui, methode, chemin, corps, requeteSup);
    if (r.ok === ok) { reussis += 1; return; }
    echecs.push(`${ok ? 'devait passer' : 'devait être refusé'} : ${description} (${r.statut} ${r.corps.slice(0, 120)})`);
}

const accepte = (...a) => attendu(true, ...a);
const refuse = (...a) => attendu(false, ...a);
const room = (suite = '', code = CODE) => `rooms/${code}${suite}`;

const joueur = (name, extra = {}) => ({ name, joinedAt: HORLOGE, connected: true, totalScore: 0, ...extra });
function nouvelleRoom(hote, extraMeta = {}) {
    return {
        meta: {
            hostUid: hote, hostName: 'Alice', mode: 'full', targetGames: 20, status: 'lobby',
            maxPlayers: 8, createdAt: HORLOGE, ...extraMeta,
        },
        players: { [hote]: joueur('Alice') },
    };
}

async function creation() {
    await requete('admin', 'DELETE', '');
    await refuse('un visiteur non connecté crée une room', null, 'PUT', room(), nouvelleRoom('alice'));
    await refuse('eve crée une room au nom d\'alice', 'eve', 'PUT', room(), nouvelleRoom('alice'));
    await refuse('code hors alphabet (0)', 'alice', 'PUT', room('', 'ABCDE0'), nouvelleRoom('alice'));
    await refuse('code trop court', 'alice', 'PUT', room('', 'ABC'), nouvelleRoom('alice'));
    await refuse('mode inconnu', 'alice', 'PUT', room(), nouvelleRoom('alice', { mode: '<script>' }));
    await refuse('nombre de manches piégé (XSS)', 'alice', 'PUT', room(), nouvelleRoom('alice', { targetGames: '<img>' }));
    await refuse('champ de meta inconnu', 'alice', 'PUT', room(), nouvelleRoom('alice', { pub: 'x' }));
    await accepte('alice crée sa room', 'alice', 'PUT', room(), nouvelleRoom('alice'));
    await refuse('eve écrase la room d\'alice', 'eve', 'PUT', room(), nouvelleRoom('eve'));
    await refuse('un visiteur non connecté lit la room', null, 'GET', room());
    await accepte('bob lit la room pour la rejoindre', 'bob', 'GET', room('/meta'));
    await refuse('eve liste toutes les rooms', 'eve', 'GET', 'rooms');
    await refuse('eve écrit hors des rooms', 'eve', 'PUT', 'pub', 'x');
}

async function arrivees() {
    await accepte('bob rejoint', 'bob', 'PUT', room('/players/bob'), joueur('Bob'));
    await accepte('carl rejoint', 'carl', 'PUT', room('/players/carl'), joueur('Carl'));
    await refuse('dana arrive avec 50 points', 'dana', 'PUT', room('/players/dana'), joueur('Dana', { totalScore: 50 }));
    await refuse('dana arrive avec un score piégé (XSS)', 'dana', 'PUT', room('/players/dana'), joueur('Dana', { totalScore: '<img src=x onerror=alert(1)>' }));
    await refuse('dana arrive avec un champ inconnu', 'dana', 'PUT', room('/players/dana'), joueur('Dana', { admin: true }));
    await refuse('pseudo de 21 caractères', 'dana', 'PUT', room('/players/dana'), joueur('x'.repeat(21)));
    await refuse('eve inscrit bob à sa place', 'eve', 'PUT', room('/players/bob'), joueur('Eve'));
    await refuse('eve s\'inscrit dans une room inexistante', 'eve', 'PUT', room('/players/eve', 'ZZZZZZ'), joueur('Eve'));
    await accepte('bob choisit sa couleur', 'bob', 'PATCH', room('/players/bob'), { color: '#ff6b9f' });
    await refuse('couleur piégée (injection CSS)', 'bob', 'PATCH', room('/players/bob'), { color: 'red;background:url(x)' });
    await refuse('bob se donne 99 points', 'bob', 'PUT', room('/players/bob/totalScore'), 99);
    await refuse('bob supprime carl', 'bob', 'DELETE', room('/players/carl'));
}

async function reglagesHote() {
    await accepte('alice change le mode', 'alice', 'PATCH', room('/meta'), { mode: 'image' });
    await accepte('alice change la durée des manches', 'alice', 'PATCH', room('/meta'), { roundDurationMs: 45000 });
    await accepte('alice règle le bonus de temps', 'alice', 'PATCH', room('/meta'), { timeBonus: { mode: 'bonus', seconds: 5, frequency: 'each' } });
    await refuse('bonus de temps inconnu', 'alice', 'PATCH', room('/meta'), { timeBonus: { mode: 'triche', seconds: 5, frequency: 'each' } });
    await refuse('bob change le mode', 'bob', 'PATCH', room('/meta'), { mode: 'text' });
    await refuse('bob annule la partie', 'bob', 'PATCH', room('/meta'), { status: 'cancelled' });
    await refuse('bob s\'empare de l\'hôte en place', 'bob', 'PUT', room('/meta/hostUid'), 'bob');
    await refuse('alice réécrit la date de création', 'alice', 'PATCH', room('/meta'), { createdAt: 1 });
}

async function manche() {
    const titres = ['BioShock', 'Celeste', 'Hades'];
    await refuse('pile piégée (non texte)', 'alice', 'PATCH', room(), { 'meta/status': 'playing', 'game/playedCount': 0, 'game/pile': [{ x: 1 }] });
    await accepte('alice démarre la partie', 'alice', 'PATCH', room(), { 'meta/status': 'playing', 'game/playedCount': 0, 'game/pile': titres });
    await refuse('bob démarre une manche', 'bob', 'PATCH', room('/game'), { pile: [] });
    await accepte('alice lance une manche', 'alice', 'PATCH', room('/game'), {
        pile: titres.slice(1),
        currentRound: {
            roundId: 'r-1-abcde', gameTitle: titres[0], startedAt: HORLOGE, endsAt: Date.now() + 30000,
            firstFinisherUid: null, firstFinisherAt: null, graceEndsAt: null, revealedAt: null, results: {},
        },
    });
    await accepte('bob trouve', 'bob', 'PUT', room('/game/currentRound/results/bob'), { status: 'found', foundAt: Date.now(), hintsUsed: 1 });
    await accepte('carl abandonne', 'carl', 'PUT', room('/game/currentRound/results/carl'), { status: 'abandoned', foundAt: null, hintsUsed: 0 });
    await refuse('bob répond pour alice', 'bob', 'PUT', room('/game/currentRound/results/alice'), { status: 'found', foundAt: 1, hintsUsed: 0 });
    await refuse('eve, hors de la room, répond', 'eve', 'PUT', room('/game/currentRound/results/eve'), { status: 'found', foundAt: 1, hintsUsed: 0 });
    await refuse('statut de résultat inconnu', 'bob', 'PUT', room('/game/currentRound/results/bob'), { status: 'gagne' });
    await refuse('bob s\'attribue des points', 'bob', 'PATCH', room('/game/currentRound/results/bob'), { pointsEarned: 500 });
    await refuse('bob change le jeu à deviner', 'bob', 'PATCH', room('/game/currentRound'), { gameTitle: 'Celeste' });
    await accepte('alice clôt la manche', 'alice', 'PATCH', room(), {
        'game/currentRound/results/bob/rank': 1, 'game/currentRound/results/bob/pointsEarned': 4,
        'game/currentRound/endedAt': HORLOGE, 'game/playedCount': 1,
    });
    await refuse('bob répond après la clôture', 'bob', 'PUT', room('/game/currentRound/results/bob'), { status: 'found', foundAt: 2, hintsUsed: 0 });
    await accepte('alice crédite bob', 'alice', 'PUT', room('/players/bob/totalScore'), 4);
    await refuse('score piégé écrit par l\'hôte (XSS)', 'alice', 'PUT', room('/players/bob/totalScore'), '<img>');
    await accepte('bob, crédité, change encore sa couleur', 'bob', 'PATCH', room('/players/bob'), { color: '#00f6ff' });
    await accepte('alice ajoute 5 manches', 'alice', 'PATCH', room(), { 'meta/targetGames': 25 });
}

async function chat() {
    const message = (uid, name, text) => ({ uid, name, text, color: '#ff6b9f', ts: HORLOGE });
    await accepte('bob écrit dans le chat', 'bob', 'POST', room('/chat'), message('bob', 'Bob', 'salut'));
    await accepte('alice écrit sans couleur', 'alice', 'POST', room('/chat'), { uid: 'alice', name: 'Alice', text: 'go', ts: HORLOGE });
    await refuse('bob signe du nom d\'alice', 'bob', 'POST', room('/chat'), message('bob', 'Alice', 'je triche'));
    await refuse('bob écrit au nom de l\'uid d\'alice', 'bob', 'POST', room('/chat'), message('alice', 'Alice', 'x'));
    await refuse('eve, hors de la room, écrit', 'eve', 'POST', room('/chat'), message('eve', 'Eve', 'spam'));
    await refuse('message de 201 caractères', 'bob', 'POST', room('/chat'), message('bob', 'Bob', 'x'.repeat(201)));
    await refuse('couleur de message piégée', 'bob', 'POST', room('/chat'), { ...message('bob', 'Bob', 'x'), color: 'red;x:y' });
    await accepte('bob écrit un message à id fixe', 'bob', 'PUT', room('/chat/m1'), message('bob', 'Bob', 'un'));
    await refuse('bob réécrit son message', 'bob', 'PUT', room('/chat/m1'), message('bob', 'Bob', 'deux'));
}

async function repriseEtExclusion() {
    await accepte('alice part : son rôle d\'hôte se libère', 'alice', 'PUT', room('/meta/hostUid'), null);
    await refuse('eve, hors de la room, reprend l\'hôte', 'eve', 'PUT', room('/meta/hostUid'), 'eve');
    await refuse('bob reprend l\'hôte au nom de carl', 'bob', 'PUT', room('/meta/hostUid'), 'carl');
    await accepte('bob reprend l\'hôte', 'bob', 'PUT', room('/meta/hostUid'), 'bob');
    await accepte('le nouvel hôte met son nom', 'bob', 'PATCH', room('/meta'), { hostName: 'Bob' });
    await refuse('alice, ex-hôte, change le mode', 'alice', 'PATCH', room('/meta'), { mode: 'text' });
    await accepte('bob exclut carl', 'bob', 'DELETE', room('/players/carl'));
    await accepte('bob ramène la room au lobby', 'bob', 'PATCH', room(), { 'meta/status': 'lobby', game: null, 'players/bob/totalScore': 0 });
    await accepte('alice quitte la room', 'alice', 'DELETE', room('/players/alice'));
}

async function purge() {
    const vieille = Date.now() - 2 * JOUR;
    const requetePurge = (fin, limite) => `&orderBy=${encodeURIComponent('"meta/createdAt"')}&endAt=${fin}${limite ? `&limitToFirst=${limite}` : ''}`;
    await requete('admin', 'PUT', room('', 'VQYZ22'), { meta: { ...nouvelleRoom('zoe').meta, createdAt: vieille }, chat: { a: { uid: 'zoe', name: 'Zoe', text: 'x', ts: vieille } } });
    await requete('admin', 'PUT', room('', 'JUNKJK'), { players: { zoe: joueur('Zoe') } });
    // Les règles ne comparent query.endAt que par égalité : la seule borne admise est
    // le début de la veille (minuit UTC), calculé comme dans JS/multi/purge.js.
    const debutVeille = Date.now() - (Date.now() % JOUR) - JOUR;
    await accepte('eve liste les rooms créées avant hier', 'eve', 'GET', 'rooms', undefined, requetePurge(debutVeille, 50));
    await refuse('eve liste les rooms récentes', 'eve', 'GET', 'rooms', undefined, requetePurge(Date.now(), 50));
    await refuse('eve liste avec une autre borne', 'eve', 'GET', 'rooms', undefined, requetePurge(debutVeille + 1, 50));
    await refuse('liste sans limite', 'eve', 'GET', 'rooms', undefined, requetePurge(debutVeille));
    await refuse('liste de plus de 50 rooms', 'eve', 'GET', 'rooms', undefined, requetePurge(debutVeille, 100));
    await refuse('eve supprime la room en cours', 'eve', 'DELETE', room());
    await accepte('eve supprime une room de plus de 24 h', 'eve', 'DELETE', room('', 'VQYZ22'));
    await accepte('eve supprime une room sans meta', 'eve', 'DELETE', room('', 'JUNKJK'));
    await refuse('eve vide une room récente champ par champ', 'eve', 'DELETE', room('/meta'));
    await accepte('l\'hôte supprime sa room', 'bob', 'DELETE', room());
}

await creation();
await arrivees();
await reglagesHote();
await manche();
await chat();
await repriseEtExclusion();
await purge();

console.log(`${reussis}/${reussis + echecs.length} cas conformes`);
for (const e of echecs) console.log(`  ÉCHEC ${e}`);
process.exit(echecs.length ? 1 : 0);
