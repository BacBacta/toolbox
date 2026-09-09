import { jsx as _jsx } from "preact/jsx-runtime";
// @vitest-environment happy-dom
import { EXTRAIT_VIDE, caisse, clients, course, devis, facture, njangi, prix, scolarite, stock, valider, } from '@a237/engine';
import { render as monter } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHARGEURS, outilDisponible } from '../src/outils.js';
const LE_9_SEPT = new Date('2026-09-09T07:45:00.000Z');
const CTX = { lien: 'atl.cm/a/ZBV3', maintenant: LE_9_SEPT };
const SCHEMAS = {
    devis: devis.schema,
    facture: facture.schema,
    njangi: njangi.schema,
    prix: prix.schema,
    caisse: caisse.schema,
    stock: stock.schema,
    clients: clients.schema,
    scolarite: scolarite.schema,
    course: course.schema,
};
let hote;
beforeEach(() => {
    hote = document.createElement('div');
    document.body.appendChild(hote);
});
afterEach(() => {
    monter(null, hote);
    hote.remove();
});
function outil(skeleton, etat) {
    return {
        id: 'abc', skeleton, nom: 'Essai', etat, version: 0,
        creeLe: LE_9_SEPT.getTime(), majLe: LE_9_SEPT.getTime(),
    };
}
function poser(module, o, onDiffuser = vi.fn()) {
    act(() => {
        monter(_jsx(module.Outil, { outil: o, glyphe: "\u25C9", ctx: CTX, onChange: () => undefined, onDiffuser: onDiffuser }), hote);
    });
    return onDiffuser;
}
describe('le registre des outils', () => {
    it('couvre les squelettes qui ont un écran, et le dit', () => {
        expect(Object.keys(CHARGEURS).sort()).toEqual([
            'caisse', 'clients', 'compose', 'compose-calcul', 'course', 'devis', 'facture',
            'njangi', 'prix', 'scolarite', 'stock',
        ]);
        expect(outilDisponible('njangi')).toBe(true);
        expect(outilDisponible('callbox')).toBe(false);
    });
    it('ne se laisse pas interroger sur une clef héritée du prototype d’Object', () => {
        expect(outilDisponible('constructor')).toBe(false);
        expect(outilDisponible('toString')).toBe(false);
    });
});
describe.each([
    'devis', 'facture', 'njangi', 'prix', 'caisse', 'stock', 'clients', 'scolarite', 'course',
])('l’outil « %s »', (id) => {
    it('fabrique un état neuf conforme à son propre schéma', async () => {
        const module = await CHARGEURS[id]();
        const neuf = module.creer(id, LE_9_SEPT, EXTRAIT_VIDE);
        expect(neuf.nom.length).toBeGreaterThan(0);
        expect(valider(SCHEMAS[id], neuf.etat)).toEqual([]);
    });
    it('se dessine à partir de cet état', async () => {
        const module = await CHARGEURS[id]();
        poser(module, outil(id, module.creer(id, LE_9_SEPT, EXTRAIT_VIDE).etat));
        expect(hote.textContent?.length).toBeGreaterThan(20);
        // Un document neuf signale ses mentions manquantes, mais son état est bon.
        expect(hote.querySelector('.etat-invalide')).toBeNull();
    });
    it('refuse de dessiner un état qui ne valide pas, et le dit', async () => {
        const module = await CHARGEURS[id]();
        poser(module, outil(id, { nimporte: 'quoi' }));
        expect(hote.querySelector('.etat-invalide')).not.toBeNull();
        expect(hote.textContent).toContain('l’état est toujours enregistré');
    });
    it('remonte une spécification de partage quand on diffuse', async () => {
        const module = await CHARGEURS[id]();
        const onDiffuser = poser(module, outil(id, module.creer(id, LE_9_SEPT, EXTRAIT_VIDE).etat));
        act(() => hote.querySelector('.outil-action.principale')?.click());
        const partage = onDiffuser.mock.calls[0]?.[0];
        expect(partage?.card.link).toBe('atl.cm/a/ZBV3');
    });
});
/** Le même état, avec une entreprise renseignée : le document n'est plus vierge. */
function avecEmetteur(etat) {
    const doc = etat;
    return { ...doc, emetteur: { ...doc.emetteur, nom: 'Ets Ngo Bassong' } };
}
describe('les documents ont un onglet d’édition', () => {
    it.each(['devis', 'facture'])('« %s » s’ouvre sur le formulaire tant qu’il est vierge', async (id) => {
        const module = await CHARGEURS[id]();
        poser(module, outil(id, module.creer(id, LE_9_SEPT, EXTRAIT_VIDE).etat));
        // Une page blanche surmontée de sept mentions manquantes n'apprend rien :
        // un document neuf s'ouvre là où on le remplit.
        expect(hote.textContent).toContain('Raison sociale');
        expect(hote.textContent).not.toContain('Sous-total HT');
    });
    it.each(['devis', 'facture'])('« %s » s’ouvre sur le document dès qu’il porte un nom', async (id) => {
        const module = await CHARGEURS[id]();
        poser(module, outil(id, avecEmetteur(module.creer(id, LE_9_SEPT, EXTRAIT_VIDE).etat)));
        expect(hote.textContent).toContain('Sous-total HT');
    });
    it.each(['devis', 'facture'])('« %s » bascule vers le document', async (id) => {
        const module = await CHARGEURS[id]();
        poser(module, outil(id, module.creer(id, LE_9_SEPT, EXTRAIT_VIDE).etat));
        act(() => hote.querySelector('[role="tab"][aria-selected="false"]')?.click());
        expect(hote.textContent).toContain('Sous-total HT');
    });
    it.each(['devis', 'facture'])('« %s » énumère les mentions qui manquent', async (id) => {
        const module = await CHARGEURS[id]();
        poser(module, outil(id, avecEmetteur(module.creer(id, LE_9_SEPT, EXTRAIT_VIDE).etat)));
        // Un document sans NIU ni RCCM ne passe pas un contrôle : on le liste au
        // lieu de l'écrire en prose, et on offre le geste qui le répare.
        const alerte = hote.querySelector('.alerte');
        expect(alerte?.textContent).toContain('NIU');
        expect(alerte?.querySelectorAll('li').length).toBeGreaterThan(1);
        act(() => alerte?.querySelector('.alerte-action')?.click());
        expect(hote.textContent).toContain('Raison sociale');
    });
    it('ne montre pas les champs dérivés à la création', async () => {
        const module = await CHARGEURS.devis();
        poser(module, outil('devis', module.creer('devis', LE_9_SEPT, EXTRAIT_VIDE).etat));
        expect(hote.textContent).toContain('Numéro');
        expect(hote.textContent).not.toContain('Date d’émission');
    });
});
describe('les outils composés par le modèle', () => {
    const CALCUL = {
        titre: 'Marge',
        kicker: 'MARGE',
        titreNom: 'Nom du produit',
        entrees: [
            { clef: 'prixAchat', titre: 'Prix d’achat', defaut: 0, unite: 'F' },
            { clef: 'prixVente', titre: 'Prix de vente', defaut: 0, unite: 'F' },
        ],
        sortie: {
            libelle: 'Marge',
            unite: 'F',
            formule: { op: 'moins', gauche: { ref: 'prixVente' }, droite: { ref: 'prixAchat' } },
        },
    };
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
    it('ouvre une calculatrice composée, et sa formule calcule', async () => {
        const module = await CHARGEURS['compose-calcul']();
        const neuf = module.creer('compose-calcul', LE_9_SEPT, EXTRAIT_VIDE, { calcul: CALCUL });
        expect(neuf.nom).toBe('Marge');
        const etat = { ...neuf.etat };
        poser(module, { ...outil('compose-calcul', { ...etat, valeurs: { prixAchat: 18_000, prixVente: 25_000 } }), calcul: CALCUL });
        // 25 000 moins 18 000 : l'arbre déclaré passe par l'interprète.
        expect(hote.textContent?.replace(/\s/g, ' ')).toContain('7 000 F');
    });
    it('ouvre un registre composé', async () => {
        const module = await CHARGEURS.compose();
        const neuf = module.creer('compose', LE_9_SEPT, EXTRAIT_VIDE, { registre: REGISTRE });
        expect(neuf.nom).toBe('Suivi des livraisons');
        poser(module, { ...outil('compose', neuf.etat), registre: REGISTRE });
        expect(hote.textContent).toContain('Aucune livraison');
    });
});
