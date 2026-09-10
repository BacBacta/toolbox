// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { viderLaFile } from '../src/file.js';
import { creerOutil, enregistrerOutil, filerPublication, lireFile, lireOutil, listerOutils, noterPublication, nouvelIdentifiant, retirerDeLaFile, supprimerOutil, } from '../src/stockage.js';
const LE_9_SEPT = new Date('2026-09-09T07:45:00.000Z');
async function viderTout() {
    for (const o of await listerOutils())
        await supprimerOutil(o.id);
    for (const e of await lireFile())
        await retirerDeLaFile(e.id);
}
beforeEach(viderTout);
const vraiFetch = globalThis.fetch;
afterEach(() => {
    globalThis.fetch = vraiFetch;
});
function serveur(statut, corps = {}) {
    const appel = vi.fn().mockResolvedValue({
        ok: statut >= 200 && statut < 300,
        status: statut,
        json: () => Promise.resolve(corps),
    });
    globalThis.fetch = appel;
    return appel;
}
function horsLigne() {
    const appel = vi.fn().mockRejectedValue(new TypeError('hors ligne'));
    globalThis.fetch = appel;
    return appel;
}
async function enFile(skeleton = 'devis') {
    const outil = await creerOutil(skeleton, 'Devis', { numero: 'DV-2026-0001' }, LE_9_SEPT);
    await filerPublication({
        id: nouvelIdentifiant(), outilId: outil.id, version: outil.version, creeLe: 0,
    });
    return outil.id;
}
describe('rejouer la file', () => {
    it('ne redépense rien pour un outil déjà publié dans sa version actuelle', async () => {
        // L'écran, lui, court-circuite : si le lien existe et que la version
        // publiée est la version courante, il ne demande rien au serveur. La file
        // appelle `publier` directement et sautait ce raisonnement — elle envoyait
        // une requête vouée au 409, puis comptait le refus comme un abandon.
        const outil = await creerOutil('devis', 'Devis', { numero: 'DV-2026-0001' }, LE_9_SEPT);
        await noterPublication(outil, 'ABCDEFGH2345', outil.version);
        await filerPublication({
            id: nouvelIdentifiant(), outilId: outil.id, version: outil.version, creeLe: 0,
        });
        const appel = serveur(409, { versionServeur: outil.version });
        const bilan = await viderLaFile(LE_9_SEPT);
        expect(appel).not.toHaveBeenCalled();
        expect(bilan.publies).toBe(1);
        expect(bilan.abandonnes).toBe(0);
        expect(await lireFile()).toHaveLength(0);
        expect((await lireOutil(outil.id))?.lien).toBe('ABCDEFGH2345');
    });
    it('publie ce qui attendait, et vide l’entrée', async () => {
        // Une file dans laquelle on dépose sans jamais rien retirer n'est pas une
        // file d'attente, c'est un tiroir.
        const id = await enFile();
        serveur(200);
        const bilan = await viderLaFile(LE_9_SEPT);
        expect(bilan.publies).toBe(1);
        expect(await lireFile()).toHaveLength(0);
        const outil = await lireOutil(id);
        expect(outil?.lien).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTVWXYZ]{12}$/);
        expect(outil?.versionPubliee).toBe(outil?.version);
    });
    it('envoie l’état d’aujourd’hui, pas celui du jour de la mise en attente', async () => {
        // Quelqu'un qui a continué de travailler hors ligne veut voir partir son
        // carnet tel qu'il est.
        const id = await enFile();
        const outil = await lireOutil(id);
        await enregistrerOutil({ ...outil, etat: { numero: 'DV-2026-0001', client: 'Ngo Bell' }, version: 9 });
        const appel = serveur(200);
        await viderLaFile(LE_9_SEPT);
        const corps = JSON.parse((appel.mock.calls[0]?.[1]).body);
        expect(corps.instantane.version).toBe(9);
        expect(corps.instantane.etat.client).toBe('Ngo Bell');
    });
    it('ne publie qu’une fois un outil mis en file plusieurs fois', async () => {
        const outil = await creerOutil('devis', 'Devis', { numero: 'DV-2026-0001' }, LE_9_SEPT);
        for (let i = 0; i < 3; i++) {
            await filerPublication({
                id: nouvelIdentifiant(), outilId: outil.id, version: 1, creeLe: i,
            });
        }
        const appel = serveur(200);
        const bilan = await viderLaFile(LE_9_SEPT);
        expect(appel).toHaveBeenCalledOnce();
        expect(bilan.publies).toBe(1);
        expect(await lireFile()).toHaveLength(0);
    });
    it('garde l’entrée tant que le réseau manque, et n’insiste pas', async () => {
        // Insister sur les suivantes ferait autant de requêtes vouées à échouer.
        await enFile();
        await enFile();
        const appel = horsLigne();
        const bilan = await viderLaFile(LE_9_SEPT);
        expect(appel).toHaveBeenCalledOnce();
        expect(bilan.publies).toBe(0);
        expect(bilan.attendent).toBe(2);
        expect(await lireFile()).toHaveLength(2);
    });
    it('abandonne un outil supprimé depuis', async () => {
        const id = await enFile();
        await supprimerOutil(id);
        const appel = serveur(200);
        const bilan = await viderLaFile(LE_9_SEPT);
        expect(appel).not.toHaveBeenCalled();
        expect(bilan.abandonnes).toBe(1);
        expect(await lireFile()).toHaveLength(0);
    });
    it('abandonne ce que le serveur refuse, plutôt que de rejouer sans fin', async () => {
        // Un refus tient à ce qu'est l'outil, un conflit à ce que le serveur
        // détient déjà : réessayer n'y changera rien.
        await enFile();
        serveur(409, { erreur: 'version-perimee', versionServeur: 7 });
        const bilan = await viderLaFile(LE_9_SEPT);
        expect(bilan.abandonnes).toBe(1);
        expect(await lireFile()).toHaveLength(0);
    });
    it('ne publie jamais une ardoise, même mise en file', async () => {
        const appel = serveur(200);
        await enFile('ardoise');
        const bilan = await viderLaFile(LE_9_SEPT);
        expect(appel).not.toHaveBeenCalled();
        expect(bilan.abandonnes).toBe(1);
    });
    it('ne se marche pas dessus quand deux vidanges partent ensemble', async () => {
        // Le montage et le retour du réseau se suivent de près.
        await enFile();
        const appel = serveur(200);
        const [a, b] = await Promise.all([viderLaFile(LE_9_SEPT), viderLaFile(LE_9_SEPT)]);
        expect(appel).toHaveBeenCalledOnce();
        expect(a.publies + b.publies).toBe(1);
    });
    it('ne fait rien quand la file est vide', async () => {
        const appel = serveur(200);
        expect(await viderLaFile(LE_9_SEPT)).toEqual({ publies: 0, attendent: 0, abandonnes: 0 });
        expect(appel).not.toHaveBeenCalled();
    });
});
