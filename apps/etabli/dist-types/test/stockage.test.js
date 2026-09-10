import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { clear, createStore, set } from 'idb-keyval';
import { enregistrer, lireProjets, supprimer } from '../src/stockage.js';
const PROJETS = createStore('etabli-projets', 'projets');
const projet = (id, maj) => ({
    id, nom: `Projet ${id}`, maj,
    fichiers: [{ nom: 'index.html', contenu: '<p>x</p>' }],
});
describe('les projets sur le téléphone', () => {
    beforeEach(async () => {
        await clear(PROJETS);
    });
    it('se rangent et se relisent', async () => {
        await enregistrer(projet('a', 1));
        const lus = await lireProjets();
        expect(lus).toHaveLength(1);
        expect(lus[0]?.fichiers[0]?.contenu).toBe('<p>x</p>');
    });
    it('reviennent du plus récemment touché au plus ancien', async () => {
        await enregistrer(projet('vieux', 100));
        await enregistrer(projet('neuf', 900));
        expect((await lireProjets()).map((p) => p.id)).toEqual(['neuf', 'vieux']);
    });
    it('s’effacent', async () => {
        await enregistrer(projet('a', 1));
        await supprimer('a');
        expect(await lireProjets()).toHaveLength(0);
    });
    /**
     * Une entrée abîmée ne doit pas emporter la liste.
     *
     * La liste est tout ce que la personne possède : un projet écrit par une
     * version d'avant, ou à moitié, ne peut pas faire disparaître les autres.
     */
    it('laissent tomber ce qui est abîmé, et gardent le reste', async () => {
        await enregistrer(projet('bon', 5));
        await set('cassé', { id: 'cassé', nom: 'x' }, PROJETS);
        await set('vide', null, PROJETS);
        await set('fichiers-faux', { id: 'f', nom: 'f', fichiers: [{ nom: 42 }], maj: 1 }, PROJETS);
        const lus = await lireProjets();
        expect(lus.map((p) => p.id)).toEqual(['bon']);
    });
    it('et un projet sans date se range en dernier plutôt que de faire tomber le tri', async () => {
        await enregistrer(projet('daté', 10));
        await set('sans', { id: 'sans', nom: 'Sans date', fichiers: [] }, PROJETS);
        expect((await lireProjets()).map((p) => p.id)).toEqual(['daté', 'sans']);
    });
});
/**
 * Le lien et la clef survivent à la fermeture de l'application.
 *
 * Sans ça, rouvrir l'Établi ferait repartir la sauvegarde sur un lien neuf :
 * celui déjà envoyé à quelqu'un cesserait de recevoir les modifications, et
 * personne ne s'en apercevrait — ni celui qui écrit, ni celui qui regarde.
 */
describe('le lien d’un projet déjà partagé', () => {
    beforeEach(async () => {
        await clear(PROJETS);
    });
    it('se range et se relit avec lui', async () => {
        await enregistrer({ ...projet('a', 1), lien: 'ABCDEFGHJK', clef: 'c'.repeat(32) });
        const [lu] = await lireProjets();
        expect(lu?.lien).toBe('ABCDEFGHJK');
        expect(lu?.clef).toBe('c'.repeat(32));
    });
    it('et un projet jamais partagé n’en invente pas', async () => {
        await enregistrer(projet('b', 1));
        const [lu] = await lireProjets();
        expect(lu?.lien).toBeUndefined();
    });
});
