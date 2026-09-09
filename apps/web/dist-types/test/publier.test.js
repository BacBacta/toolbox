// @vitest-environment happy-dom
import { ALPHABET_LIEN, LONGUEUR_LIEN, lienValide } from '@a237/engine';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { publier, tirerLien } from '../src/publier.js';
const LE_9_SEPT = new Date('2026-09-09T07:45:00.000Z');
function outil(modif = {}) {
    return {
        id: 'o1', skeleton: 'devis', nom: 'Devis', etat: { numero: 'DV-2026-0001' },
        version: 1, creeLe: 0, majLe: 0, ...modif,
    };
}
const vraiFetch = globalThis.fetch;
afterEach(() => {
    globalThis.fetch = vraiFetch;
    vi.restoreAllMocks();
});
function repond(statut, corps = {}) {
    globalThis.fetch = vi.fn().mockResolvedValue({
        ok: statut >= 200 && statut < 300,
        status: statut,
        json: () => Promise.resolve(corps),
    });
}
describe('le lien tiré sur le téléphone', () => {
    it('a la bonne forme, à chaque fois', () => {
        for (let i = 0; i < 200; i++)
            expect(lienValide(tirerLien())).toBe(true);
    });
    it('ne se répète pas', () => {
        // Ce qui protège une facture qui porte un nom de client et des montants,
        // c'est que son adresse ne se devine pas.
        const tires = new Set(Array.from({ length: 500 }, tirerLien));
        expect(tires.size).toBe(500);
    });
    it('n’emploie que l’alphabet du moteur', () => {
        const lien = tirerLien();
        expect(lien.length).toBe(LONGUEUR_LIEN);
        for (const c of lien)
            expect(ALPHABET_LIEN).toContain(c);
    });
});
describe('publier', () => {
    it('refuse l’ardoise sans même toucher au réseau', async () => {
        // La raison est connue d'avance : la dire tout de suite vaut mieux que de
        // la faire dire par un serveur, et évite une requête inutile.
        const appel = vi.fn();
        globalThis.fetch = appel;
        const issue = await publier(outil({ skeleton: 'ardoise' }), LE_9_SEPT);
        expect(issue.sorte).toBe('refuse');
        if (issue.sorte === 'refuse')
            expect(issue.pourquoi).toContain('noms et des dettes');
        expect(appel).not.toHaveBeenCalled();
    });
    it('rend l’adresse quand le dépôt est accepté', async () => {
        repond(200);
        const issue = await publier(outil(), LE_9_SEPT);
        expect(issue.sorte).toBe('publie');
        if (issue.sorte === 'publie')
            expect(lienValide(issue.lien)).toBe(true);
    });
    it('garde le lien qu’un outil avait déjà', async () => {
        // Sans ça, chaque correction d'une facture enverrait le client sur une
        // adresse morte.
        repond(200);
        const issue = await publier(outil(), LE_9_SEPT, 'K7M2XQ4BN9PZ');
        if (issue.sorte === 'publie')
            expect(issue.lien).toBe('K7M2XQ4BN9PZ');
        const corps = JSON.parse((vi.mocked(globalThis.fetch).mock.calls[0]?.[1]).body);
        expect(corps.lien).toBe('K7M2XQ4BN9PZ');
    });
    it('n’envoie que ce qui sert à l’affichage', async () => {
        repond(200);
        await publier(outil(), LE_9_SEPT);
        const corps = JSON.parse((vi.mocked(globalThis.fetch).mock.calls[0]?.[1]).body);
        expect(Object.keys(corps.instantane).sort()).toEqual([
            'etat', 'nom', 'publieLe', 'skeleton', 'version',
        ]);
        // Ni identifiant d'appareil, ni dates de vie de l'outil.
        expect(JSON.stringify(corps)).not.toContain('creeLe');
        expect(JSON.stringify(corps)).not.toContain('"id"');
    });
    it('rend le conflit avec la version du serveur', async () => {
        repond(409, { erreur: 'version-perimee', versionServeur: 7 });
        const issue = await publier(outil(), LE_9_SEPT);
        expect(issue.sorte).toBe('conflit');
        if (issue.sorte === 'conflit')
            expect(issue.versionServeur).toBe(7);
    });
    it('diffère quand le réseau manque, sans lancer', async () => {
        // Une panne de réseau n'est pas une erreur du programme : ce qui a besoin
        // du réseau peut attendre (§ 2.7).
        globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('hors ligne'));
        expect((await publier(outil(), LE_9_SEPT)).sorte).toBe('differe');
    });
    it('diffère aussi quand le serveur bafouille', async () => {
        for (const statut of [400, 413, 500, 502]) {
            repond(statut, { erreur: 'peu importe' });
            expect((await publier(outil(), LE_9_SEPT)).sorte).toBe('differe');
        }
    });
    it('survit à un corps d’erreur illisible', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false, status: 409, json: () => Promise.reject(new Error('pas du json')),
        });
        const issue = await publier(outil(), LE_9_SEPT);
        expect(issue.sorte).toBe('conflit');
    });
});
