import { jsx as _jsx } from "preact/jsx-runtime";
// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { render as monter } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { EcranCompte } from '../src/ecran-compte.js';
/**
 * L'écran du compte, éprouvé pour ce qu'il est : le seul endroit de
 * l'application où l'on parle d'argent et de perte de données.
 *
 * Deux choses y comptent plus que le reste, et elles ne se voient pas dans un
 * rendu statique — le code de récupération n'est montré qu'une fois, et un
 * refus du serveur doit se lire tel quel plutôt que d'être remplacé par une
 * phrase à nous.
 */
const ESSAI = { plan: 'essai', credits: 3, expire: null, aUnCode: false };
const DANS_UN_MOIS = Date.now() + 30 * 24 * 60 * 60 * 1000;
const ATELIER = { plan: 'atelier', credits: 40, expire: DANS_UN_MOIS, aUnCode: true };
let hote;
let vus;
let retours;
const vraiFetch = globalThis.fetch;
beforeAll(async () => {
    const { jetonDeCetAppareil } = await import('../src/appareil.js');
    await jetonDeCetAppareil();
});
function reponses(...suite) {
    const appel = vi.fn();
    for (const { statut, corps } of suite) {
        appel.mockResolvedValueOnce({
            ok: statut >= 200 && statut < 300,
            status: statut,
            json: () => Promise.resolve(corps),
        });
    }
    globalThis.fetch = appel;
    return appel;
}
function poser(etat) {
    hote = document.createElement('div');
    document.body.appendChild(hote);
    vus = [];
    retours = 0;
    act(() => {
        monter(_jsx(EcranCompte, { etat: etat, onEtat: (e) => vus.push(e), onRetour: () => (retours += 1) }), hote);
    });
}
const attendre = async () => {
    await act(() => new Promise((r) => setTimeout(r, 0)));
    await act(() => new Promise((r) => setTimeout(r, 0)));
};
function cliquer(texte) {
    const b = [...hote.querySelectorAll('button')].find((x) => x.textContent?.includes(texte));
    if (b === undefined)
        throw new Error(`bouton introuvable : ${texte}`);
    act(() => b.click());
}
function remplir(id, valeur) {
    const champ = hote.querySelector(`#${id}`);
    if (champ === null)
        throw new Error(`champ introuvable : ${id}`);
    act(() => {
        champ.value = valeur;
        champ.dispatchEvent(new Event('input', { bubbles: true }));
    });
}
beforeEach(() => {
    reponses({ statut: 200, corps: ESSAI });
});
afterEach(() => {
    // Une horloge feinte laissée derrière soi fige le cas suivant.
    vi.useRealTimers();
    monter(null, hote);
    hote.remove();
    globalThis.fetch = vraiFetch;
    vi.unstubAllGlobals();
});
describe('ce que l’écran dit', () => {
    it('en essai, ce qu’il reste et que le reste ne coûte rien', async () => {
        poser(ESSAI);
        await attendre();
        const texte = hote.textContent ?? '';
        expect(texte).toContain('Essai');
        expect(texte).toContain('3 compositions restantes');
        expect(texte).toContain('sans rien payer');
    });
    it('abonné, les jours qui restent', async () => {
        poser(ATELIER);
        await attendre();
        expect(hote.textContent).toContain('Atelier');
        expect(hote.textContent).toMatch(/30 jours restants|29 jours restants/);
    });
    it('et quand on ne sait rien, il le dit au lieu d’inventer un zéro', async () => {
        // Zéro composition et « on ne sait pas » ne sont pas la même nouvelle :
        // la première envoie payer, la seconde envoie chercher du réseau.
        globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('hors ligne'));
        poser(null);
        await attendre();
        expect(hote.textContent).toContain('On ne sait pas encore');
        expect(hote.textContent).not.toContain('0 composition');
    });
    it('hors ligne, il montre ce qu’on savait la dernière fois', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('hors ligne'));
        poser(ATELIER);
        await attendre();
        expect(hote.textContent).toContain('Atelier');
        expect(hote.textContent).toContain('Pas de réseau');
    });
    it('propose un nouveau code quand il y en a déjà un, et le dit', async () => {
        // Tirer un code annule le précédent : c'est exactement ce qu'on veut si on
        // croit l'avoir laissé traîner, et un désastre si on l'ignore.
        poser(ATELIER);
        await attendre();
        expect(hote.textContent).toContain('Un nouveau code');
        expect(hote.textContent).toContain('Le précédent ne marchera plus');
    });
});
describe('ce qui est mis en avant dépend de ce qui manque', () => {
    const principale = () => hote.querySelector('.atelier-option.principale')?.textContent ?? '';
    it('en essai, c’est l’abonnement', async () => {
        poser(ESSAI);
        await attendre();
        expect(principale()).toContain('Prendre un mois');
    });
    it('abonné sans code, c’est le code', async () => {
        /*
         * Il est à un téléphone perdu de perdre ce qu'il vient de payer, et
         * repayer ne le lui rendrait pas : c'est un autre compte qui s'ouvrirait.
         */
        poser({ ...ATELIER, aUnCode: false });
        await attendre();
        expect(principale()).toContain('code de récupération');
        expect(hote.textContent).toContain('Ajouter un mois');
        expect(hote.textContent).toContain('ils s’ajoutent');
    });
    it('abonné avec code, plus rien n’est mis en avant', async () => {
        poser(ATELIER);
        await attendre();
        expect(hote.querySelector('.atelier-option.principale')).toBeNull();
    });
});
describe('le code de récupération', () => {
    it('s’affiche une fois, avec ce qu’il faut en faire', async () => {
        poser(ESSAI);
        await attendre();
        reponses({ statut: 200, corps: { code: 'A2B3-C4D5-E6F7-G8H9', pourquoi: '' } });
        cliquer('Mon code de récupération');
        await attendre();
        expect(hote.querySelector('.compte-code-valeur')?.textContent).toBe('A2B3-C4D5-E6F7-G8H9');
        expect(hote.textContent).toContain('plus jamais affiché');
    });
    it('se copie, pour ne pas le recopier à la main', async () => {
        // Seize lettres se transcrivent mal sur un écran de téléphone. Le cahier
        // reste le meilleur endroit — c'est ce que dit l'écran — mais un carnet de
        // notes en vaut un autre.
        const ecrit = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: ecrit } });
        poser(ESSAI);
        await attendre();
        reponses({ statut: 200, corps: { code: 'A2B3-C4D5-E6F7-G8H9', pourquoi: '' } });
        cliquer('Mon code de récupération');
        await attendre();
        cliquer('Copier le code');
        await attendre();
        expect(ecrit).toHaveBeenCalledWith('A2B3-C4D5-E6F7-G8H9');
        expect(hote.textContent).toContain('Copié');
    });
    it('et dit pourquoi quand le serveur refuse d’en donner un', async () => {
        poser(ESSAI);
        await attendre();
        reponses({ statut: 401, corps: { erreur: 'appareil-inconnu', pourquoi: 'Cet appareil ne s’est pas présenté.' } });
        cliquer('Mon code de récupération');
        await attendre();
        expect(hote.textContent).toContain('ne s’est pas présenté');
    });
    it('et disparaît quand on dit l’avoir noté', async () => {
        poser(ESSAI);
        await attendre();
        reponses({ statut: 200, corps: { code: 'A2B3-C4D5-E6F7-G8H9', pourquoi: '' } });
        cliquer('Mon code de récupération');
        await attendre();
        cliquer('C’est noté');
        await attendre();
        expect(hote.querySelector('.compte-code-valeur')).toBeNull();
    });
});
describe('reprendre un atelier', () => {
    it('rend le compte à cet appareil', async () => {
        poser(ESSAI);
        await attendre();
        cliquer('J’ai déjà un atelier');
        remplir('compte-code', 'A2B3-C4D5-E6F7-G8H9');
        reponses({ statut: 200, corps: ATELIER });
        cliquer('Reprendre mon atelier');
        await attendre();
        expect(vus.at(-1)).toEqual(ATELIER);
        expect(hote.textContent).toContain('revenu sur ce téléphone');
    });
    it('et dit quoi vérifier quand le code ne correspond à rien', async () => {
        poser(ESSAI);
        await attendre();
        cliquer('J’ai déjà un atelier');
        remplir('compte-code', 'A2B3-C4D5-E6F7-G8H8');
        reponses({ statut: 404, corps: { erreur: 'code-inconnu' } });
        cliquer('Reprendre mon atelier');
        await attendre();
        expect(hote.textContent).toContain('seize lettres');
    });
});
describe('payer un mois', () => {
    it('demande un numéro, puis dit ce qu’il faut faire', async () => {
        poser(ESSAI);
        await attendre();
        cliquer('Prendre un mois');
        remplir('compte-tel', '699412708');
        reponses({ statut: 200, corps: { id: 'p1', montantXaf: 1000, consigne: 'Confirme sur ton téléphone.' } });
        cliquer('Payer 1 000 F');
        await attendre();
        expect(hote.textContent).toContain('Confirme sur ton téléphone');
        expect(hote.textContent).toContain('Tu peux fermer');
    });
    it('rapporte le refus du serveur tel quel, sans le remplacer', async () => {
        // Le serveur sait pourquoi il refuse — « neuf chiffres commençant par 6 ».
        // Une phrase à nous à la place serait plus vague, et fausse le jour où la
        // règle change.
        poser(ESSAI);
        await attendre();
        cliquer('Prendre un mois');
        remplir('compte-tel', 'allo');
        reponses({
            statut: 400,
            corps: { erreur: 'telephone-invalide', pourquoi: 'Un numéro camerounais : neuf chiffres commençant par 6.' },
        });
        cliquer('Payer 1 000 F');
        await attendre();
        expect(hote.textContent).toContain('neuf chiffres commençant par 6');
    });
    it('et n’engage rien quand il n’y a pas de réseau', async () => {
        poser(ESSAI);
        await attendre();
        cliquer('Prendre un mois');
        remplir('compte-tel', '699412708');
        globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('hors ligne'));
        cliquer('Payer 1 000 F');
        await attendre();
        expect(hote.textContent).toContain('Pas de réseau');
        expect(hote.textContent).not.toContain('Tu peux fermer');
    });
});
describe('l’attente du paiement', () => {
    /*
     * Un paiement mobile money se confirme sur le téléphone, pas dans
     * l'application : entre le moment où on le démarre et celui où il aboutit,
     * l'écran ne peut que redemander. C'est ce va-et-vient qui transforme un
     * paiement en abonnement affiché, et il ne se voit dans aucun rendu figé.
     */
    async function demarrer() {
        poser(ESSAI);
        await attendre();
        cliquer('Prendre un mois');
        remplir('compte-tel', '699412708');
        reponses({ statut: 200, corps: { id: 'p1', montantXaf: 1000, consigne: 'Confirme.' } });
        cliquer('Payer 1 000 F');
        await attendre();
    }
    it('devient un abonnement quand le paiement aboutit', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        try {
            await demarrer();
            reponses({ statut: 200, corps: { etat: 'attente', plan: 'essai', credits: 3 } }, { statut: 200, corps: { etat: 'reussi', plan: 'atelier', credits: 40 } }, { statut: 200, corps: ATELIER });
            await act(async () => {
                await vi.advanceTimersByTimeAsync(3100);
            });
            // Toujours en attente : rien ne bouge, et surtout on ne dit pas que
            // c'est fait.
            expect(hote.textContent).not.toContain('ouvert pour un mois');
            await act(async () => {
                await vi.advanceTimersByTimeAsync(3100);
            });
            expect(vus.at(-1)?.plan).toBe('atelier');
            expect(hote.textContent).toContain('ouvert pour un mois');
        }
        finally {
            vi.useRealTimers();
        }
    });
    it('et dit que rien n’a été prélevé quand il échoue', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        try {
            await demarrer();
            reponses({ statut: 200, corps: { etat: 'echoue', plan: 'essai', credits: 3 } });
            await act(async () => {
                await vi.advanceTimersByTimeAsync(3100);
            });
            expect(hote.textContent).toContain('Rien n’a été prélevé');
            expect(vus.at(-1)?.plan).not.toBe('atelier');
        }
        finally {
            vi.useRealTimers();
        }
    });
});
describe('le retour', () => {
    it('ramène aux outils', async () => {
        poser(ESSAI);
        await attendre();
        cliquer('Mes outils');
        expect(retours).toBe(1);
    });
});
