// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { entetesDAppareil, jetonDeCetAppareil, oublierEnMemoire } from '../src/appareil.js';
describe('le jeton de cet appareil', () => {
    beforeEach(oublierEnMemoire);
    it('se tire une fois et ne change plus', async () => {
        // C'est lui qui porte l'abonnement : le retirer à chaque lancement ferait
        // repartir tout le monde en essai à chaque ouverture.
        const un = await jetonDeCetAppareil();
        oublierEnMemoire();
        expect(await jetonDeCetAppareil()).toBe(un);
    });
    it('fait cent vingt-huit bits', async () => {
        expect(await jetonDeCetAppareil()).toMatch(/^[0-9a-f]{32}$/);
    });
    it('voyage dans un en-tête que le serveur sait lire', async () => {
        const entetes = await entetesDAppareil();
        expect(entetes.authorization).toBe(`Appareil ${await jetonDeCetAppareil()}`);
    });
});
