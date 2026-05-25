/**
 * abbreviations.js -- table des contractions/raccourcis acceptes en plus
 * des titres officiels pour matcher une reponse.
 *
 * Extrait de gamesDatabase.js pour permettre aux pages qui n'ont pas
 * besoin du catalogue complet (index.html, hub.html, chamber.html) de
 * charger seulement ce petit fichier au lieu des 190 KB de la base.
 * gameUtils.js (importe partout via les profils) consomme cette table
 * via checkAnswerValue().
 *
 * Cle : titre canonique du jeu en minuscules.
 * Valeur : tableau de raccourcis acceptes pour ce jeu (egalement en minuscules).
 */

export const abbreviations = {
    'animal crossing': ['ac'],
    'counter strike': ['cs'],
    'league of legends': ['lol'],
    'call of duty': ['cod'],
    'world of warcraft': ['wow'],
    'grand theft auto': ['gta'],
    'final fantasy': ['ff'],
    'the last of us': ['tlou'],
    'the legend of zelda': ['zelda'],
    'plants vs zombies': ['pvz'],
    'spider-man': ['spider man', 'spiderman'],
    'clash of clans': ['coc'],
    'apex legends': ['apex'],
    'rocket league': ['rl'],
    'mortal kombat': ['mk'],
    'detroit: become human': ['detroit become human', 'dbh', 'detroit'],
    'ori and the blind forest': ['ori'],
    'age of empires': ['aoe'],
    'rainbow six siege': ['r6'],
    'five night at freddy\'s': ['fnaf'],
    'osu': ['osu!'],
    'trackmania': ['tm'],
    'baldur\'s gate': ['bg'],
    'sea of thieves': ['sot'],
    'pubg: battlegrounds': ['pubg'],
    'the binding of isaac': ['isaac'],
    'horizon zero dawn': ['horizon'],
    'resident evil': ['re'],
    'r.e.p.o.': ['repo'],
    'red dead redemption': ['rdr'],
    'sekiro: shadows die twice': ['sekiro'],
    't. rex game': ['t rex game'],
    'star wars battlefront': ['battlefront'],
    'magic: the gathering arena': ['magic', 'mtg arena', 'mtga', 'mtg'],
    'little big planet': ['lbp'],
    'ark: survival evolved': ['ark'],
    'the sims': ['sims', 'les sims'],
    'cyberpunk 2077': ['cyberpunk'],
    'assassin\'s creed': ['ac'],
    'clair obscur : expedition 33': ['clair obscur'],
    'undertale': ['ut'],
    'dark souls': ['ds'],
    'valorant': ['valo'],
    'hollow knight': ['hk'],
    'slender': ['slenderman', 'slender man'],
    'battlefield': ['bf'],
    'death stranding': ['ds'],
    'professeur layton': ['layton'],
};
