// @vitest-environment happy-dom
// Le jeton de l'appareil vit dans IndexedDB : sans lui, aucune requête qui
// engage le compte ne part.
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { composer } from '../src/composer.js';
/**
 * Ce que l'utilisateur voit quand l'étage 2 est sollicité — et surtout quand
 * il rate. Aucun modèle n'est appelé : `fetch` est remplacé, parce que ce
 * qu'on vérifie ici, c'est la porte, pas ce qu'il y a derrière.
 */
const REGISTRE = {
    titre: 'Suivi des livraisons',
    kicker: 'SUIVI DES LIVRAISONS',
    titreNom: 'Nom du dépôt',
    colonnes: [
        { clef: 'client', titre: 'Client', type: 'texte' },
        { clef: 'montant', titre: 'Montant (F CFA)', type: 'montant' },
    ],
    libelleVide: 'Aucune livraison pour l’instant.',
    libelleAjout: 'Ajouter une livraison',
    relancesVides: 'Un suivi se consulte, il ne se relance pas.',
};
function repond(statut, corps) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: statut >= 200 && statut < 300,
        status: statut,
        json: () => Promise.resolve(corps),
    }));
}
afterEach(() => vi.unstubAllGlobals());
describe('quand ça marche', () => {
    it('rend le registre et ce qu’il a coûté', async () => {
        repond(200, { registre: REGISTRE, fcfa: 0.21 });
        const r = await composer('je veux suivre mes livraisons');
        expect(r.sorte).toBe('compose');
        if (r.sorte === 'compose') {
            expect(r.registre.titre).toBe('Suivi des livraisons');
            expect(r.fcfa).toBe(0.21);
        }
    });
});
describe('quand ça ne marche pas', () => {
    it('distingue « pas encore ouvert » d’une panne', async () => {
        // 503 n'est pas une erreur à réessayer : c'est un service pas branché, et
        // l'utilisateur doit lire ça, pas « réessaie ».
        repond(503, { erreur: 'pas encore ouvert' });
        expect((await composer('un registre')).sorte).toBe('pas-ouvert');
    });
    it('dit que la description n’a pas suffi quand le modèle a échoué', async () => {
        repond(422, { erreur: 'pas utilisable' });
        const r = await composer('un truc');
        expect(r.sorte).toBe('echoue');
        if (r.sorte === 'echoue')
            expect(r.pourquoi).toContain('description');
    });
    it('survit à l’absence de réseau, qui est la règle ici', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
        const r = await composer('un registre');
        expect(r.sorte).toBe('echoue');
        if (r.sorte === 'echoue')
            expect(r.pourquoi).toBe('pas de réseau');
    });
});
describe('le client revérifie ce qu’on lui donne', () => {
    it('refuse un registre invalide même en 200', async () => {
        // Le serveur a déjà validé. Mais il peut être d'une version plus ancienne
        // que l'application, et un contrôle qu'on ne fait qu'une fois est un
        // contrôle qu'on finira par ne plus faire.
        repond(200, { registre: { ...REGISTRE, total: { type: 'somme', clef: 'absente', libelle: 'T', unite: 'F' } } });
        expect((await composer('un registre')).sorte).toBe('echoue');
    });
    it.each([
        ['du HTML', '<div>bonjour</div>'],
        ['rien', null],
        ['un objet vide', {}],
    ])('refuse %s', async (_quoi, charge) => {
        repond(200, { registre: charge });
        expect((await composer('un registre')).sorte).toBe('echoue');
    });
});
