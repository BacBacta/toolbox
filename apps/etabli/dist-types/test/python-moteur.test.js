// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clear, createStore, get, set } from 'idb-keyval';
import { dejaDescendu, manifestePython, moteurPython, posterMoteur } from '../src/python-moteur.js';
/**
 * Cinq mégaoctets, descendus une seule fois.
 *
 * Tout ce fichier tourne autour de deux fautes qui coûteraient de l'argent à
 * quelqu'un : redescendre ce qu'on a déjà, et garder un fichier tronqué — qui
 * ferait échouer Python à chaque lancement sans que rien ne suggère de
 * recommencer.
 */
const MOTEUR = createStore('etabli-python', 'moteur');
const CORPS = {
    'pyodide.js': 'la façade',
    'pyodide.asm.js': 'le moteur',
    'pyodide-lock.json': '{"paquets":[]}',
    'pyodide.asm.wasm': 'du wasm',
    'python_stdlib.zip': 'la bibliothèque',
};
async function empreinteDe(texte) {
    const brut = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texte));
    return [...new Uint8Array(brut)].map((o) => o.toString(16).padStart(2, '0')).join('');
}
let manifeste;
let demandes = [];
/** Un serveur qui rend les corps ci-dessus, et qui note ce qu'on lui demande. */
function serveur(abime = []) {
    return ((url) => {
        const nom = String(url).replace('pyodide/', '');
        demandes.push(nom);
        if (nom === 'manifeste.json') {
            return Promise.resolve(new Response(JSON.stringify(manifeste)));
        }
        const corps = CORPS[nom];
        if (corps === undefined)
            return Promise.resolve(new Response('rien', { status: 404 }));
        // Un fichier « abîmé » arrive tronqué, comme sur un réseau qui coupe.
        return Promise.resolve(new Response(abime.includes(nom) ? corps.slice(0, 2) : corps));
    });
}
beforeEach(async () => {
    await clear(MOTEUR);
    demandes = [];
    const fichiers = await Promise.all(Object.entries(CORPS).map(async ([nom, corps]) => ({
        nom,
        forme: (nom.endsWith('.wasm') || nom.endsWith('.zip') ? 'octets' : 'texte'),
        octets: new TextEncoder().encode(corps).byteLength,
        surLeFil: 3,
        empreinte: await empreinteDe(corps),
    })));
    manifeste = {
        version: '0.28.3',
        fichiers,
        octets: fichiers.reduce((t, f) => t + f.octets, 0),
        surLeFil: fichiers.reduce((t, f) => t + f.surLeFil, 0),
    };
    vi.stubGlobal('fetch', serveur());
});
afterEach(() => vi.unstubAllGlobals());
describe('le manifeste', () => {
    it('se lit quand il est là', async () => {
        expect((await manifestePython())?.version).toBe('0.28.3');
    });
    /*
     * Pas de manifeste est un cas normal, pas une panne : les fichiers de Pyodide
     * ne sont pas versionnés, et une installation qui n'a pas lancé
     * `pnpm pyodide` n'en a pas. L'Établi doit alors marcher comme avant.
     */
    it('vaut « rien » quand cette installation n’a pas Python', async () => {
        vi.stubGlobal('fetch', () => Promise.resolve(new Response('', { status: 404 })));
        expect(await manifestePython()).toBe(null);
    });
    it('vaut « rien » aussi quand le réseau tombe', async () => {
        vi.stubGlobal('fetch', () => Promise.reject(new Error('coupure')));
        expect(await manifestePython()).toBe(null);
    });
});
describe('descendre le moteur', () => {
    it('donne une adresse absolue : un cadre « srcdoc » n’a pas de base', async () => {
        expect((await moteurPython(manifeste)).base).toMatch(/^https?:\/\/.*pyodide\/$/);
    });
    it('rend les textes en texte et le reste en octets', async () => {
        const envoi = await moteurPython(manifeste);
        expect(envoi.textes['pyodide.asm.js']).toBe('le moteur');
        expect(envoi.octets['pyodide.asm.wasm']).toBeInstanceOf(ArrayBuffer);
        expect(envoi.textes['pyodide.asm.wasm']).toBeUndefined();
    });
    /* Le point du module : le second lancement ne coûte rien. */
    it('ne redemande rien une fois que tout est gardé', async () => {
        await moteurPython(manifeste);
        expect(demandes).toHaveLength(5);
        demandes = [];
        const envoi = await moteurPython(manifeste);
        expect(demandes).toEqual([]);
        expect(envoi.textes['pyodide.js']).toBe('la façade');
    });
    /*
     * Un réseau qui coupe ne rate pas bruyamment : il rend un fichier court.
     * Gardé tel quel, Python échouerait à chaque lancement avec une erreur
     * incompréhensible, pour toujours.
     */
    it('refuse un fichier arrivé tronqué, et ne le garde pas', async () => {
        vi.stubGlobal('fetch', serveur(['python_stdlib.zip']));
        await expect(moteurPython(manifeste)).rejects.toThrow(/python_stdlib/);
        expect(await get('0.28.3/python_stdlib.zip', MOTEUR)).toBeUndefined();
    });
    it('mais garde ce qui est bien arrivé : reprendre ne repart pas de zéro', async () => {
        vi.stubGlobal('fetch', serveur(['python_stdlib.zip']));
        await expect(moteurPython(manifeste)).rejects.toThrow();
        expect(await get('0.28.3/pyodide.asm.wasm', MOTEUR)).toBeDefined();
        vi.stubGlobal('fetch', serveur());
        demandes = [];
        await moteurPython(manifeste);
        expect(demandes).toEqual(['python_stdlib.zip']);
    });
    it('redescend un fichier gardé qui ne correspond plus à son empreinte', async () => {
        await moteurPython(manifeste);
        await set('0.28.3/pyodide.js', new TextEncoder().encode('abîmé').buffer, MOTEUR);
        demandes = [];
        const envoi = await moteurPython(manifeste);
        expect(demandes).toEqual(['pyodide.js']);
        expect(envoi.textes['pyodide.js']).toBe('la façade');
    });
    it('fait avancer l’aiguille jusqu’au bout', async () => {
        const vus = [];
        await moteurPython(manifeste, (a) => vus.push(a.recus));
        expect(vus.length).toBeGreaterThan(0);
        expect(vus[vus.length - 1]).toBe(manifeste.octets);
        // Elle ne recule jamais : une jauge qui recule fait croire à une panne.
        expect([...vus].sort((a, b) => a - b)).toEqual(vus);
    });
});
describe('savoir si Python est déjà là', () => {
    it('non avant, oui après', async () => {
        expect(await dejaDescendu(manifeste)).toBe(false);
        await moteurPython(manifeste);
        expect(await dejaDescendu(manifeste)).toBe(true);
    });
    it('non quand la version a changé : l’ancien moteur ne sert plus', async () => {
        await moteurPython(manifeste);
        expect(await dejaDescendu({ ...manifeste, version: '0.29.0' })).toBe(false);
    });
});
/**
 * Le moteur se recopie, il ne se transfère pas.
 *
 * La première version passait les tampons en transférables, pour éviter de
 * recopier douze mégaoctets. Elle marchait au premier lancement et pas au
 * second : transférer détache les tampons du côté du parent, et « Relancer »
 * échouait sur « ArrayBuffer at index 0 is already detached ». Il a fallu
 * lancer deux fois dans un vrai navigateur pour le voir.
 *
 * Ce que cet essai garde n'est pas une taille ni un délai : c'est **l'absence
 * de liste de transférables**, c'est-à-dire la décision elle-même.
 */
describe('poster le moteur au cadre', () => {
    it('sans liste de transférables : sinon le second lancement échoue', async () => {
        const envoi = await moteurPython(manifeste);
        const recus = [];
        const fenetre = { postMessage: (...args) => { recus.push(args); } };
        posterMoteur(fenetre, envoi);
        posterMoteur(fenetre, envoi);
        expect(recus).toHaveLength(2);
        expect(recus[0]).toHaveLength(2);
        // Et les tampons sont toujours lisibles après le premier envoi.
        expect(envoi.octets['pyodide.asm.wasm']?.byteLength).toBeGreaterThan(0);
    });
});
