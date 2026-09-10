import { jsx as _jsx } from "preact/jsx-runtime";
// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { EXTRAIT_VIDE } from '@a237/engine';
import { render as monter } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { FORMULAIRE_VIDE, Outil, creer } from '../src/outils/formulaire.js';
/**
 * L'écran d'un formulaire, et surtout son troisième onglet.
 *
 * Les réponses sont tout l'intérêt de l'outil : aujourd'hui, ramasser quinze
 * commandes se fait par quinze messages WhatsApp qu'il faut recopier à la main
 * dans un cahier. Ce qu'on vérifie ici est ce qui rend cet onglet utile sur un
 * téléphone camerounais — qu'il montre ce qu'on avait **avant** d'attendre le
 * réseau, et qu'un réseau absent ne se lise pas « personne n'a répondu ».
 */
const LE_9_SEPT = new Date('2026-09-09T07:45:00.000Z');
const CTX = { lien: 'atl.cm/d/K7M2XQ4BN9PZ', maintenant: LE_9_SEPT };
const FORM = {
    titre: 'Commandes du week-end',
    kicker: 'TRAITEUR MAMA NGO',
    accroche: 'Commande avant vendredi 18 h.',
    champs: [
        { clef: 'nom', titre: 'Ton nom', sorte: 'texte', obligatoire: true },
        { clef: 'plat', titre: 'Quel plat ?', sorte: 'choix', options: ['Ndolè', 'Eru'] },
    ],
    bouton: 'Envoyer ma commande',
    merci: 'C’est noté.',
};
let hote;
beforeAll(async () => {
    const { jetonDeCetAppareil } = await import('../src/appareil.js');
    await jetonDeCetAppareil();
});
beforeEach(() => {
    hote = document.createElement('div');
    document.body.appendChild(hote);
});
afterEach(() => {
    monter(null, hote);
    hote.remove();
    vi.unstubAllGlobals();
});
function poser(etat, lien) {
    const outil = {
        id: 'abc', skeleton: 'compose-formulaire', nom: 'Essai', etat, version: 0,
        ...(lien === undefined ? {} : { lien }),
        creeLe: LE_9_SEPT.getTime(), majLe: LE_9_SEPT.getTime(),
    };
    act(() => {
        monter(_jsx(Outil, { outil: outil, glyphe: "\u2733", ctx: CTX, onChange: () => undefined, onDiffuser: () => undefined }), hote);
    });
}
/**
 * Attend que l'écran dise quelque chose, plutôt qu'un nombre de tours fixe.
 *
 * L'onglet enchaîne deux lectures — ce qu'on avait sur l'appareil, puis ce que
 * le serveur rapporte — dont la première touche IndexedDB. Deux tours de
 * boucle suffisaient d'ordinaire et pas toujours : l'essai est tombé une fois
 * sur mille, ce qui est la pire des fréquences, parce qu'on met l'échec sur le
 * compte du hasard.
 */
const jusqua = async (dit) => {
    for (let i = 0; i < 100 && !dit(); i++) {
        await act(() => new Promise((r) => setTimeout(r, 1)));
    }
};
const attendre = async () => {
    await act(() => new Promise((r) => setTimeout(r, 0)));
    await act(() => new Promise((r) => setTimeout(r, 0)));
};
function cliquer(texte) {
    const b = [...hote.querySelectorAll('button')].find((x) => x.textContent?.trim() === texte);
    if (b === undefined)
        throw new Error(`bouton introuvable : ${texte}`);
    act(() => b.click());
}
describe('la création', () => {
    it('prend ce que le modèle a écrit', () => {
        expect(creer('compose-formulaire', LE_9_SEPT, EXTRAIT_VIDE, { formulaire: FORM })).toEqual({
            nom: 'Commandes du week-end',
            etat: FORM,
        });
    });
    it('ouvre un formulaire vide qui passe son propre contrôle', () => {
        // Un outil qui s'ouvre sur l'écran d'erreur de son propre validateur n'est
        // pas un outil.
        const neuf = creer('compose-formulaire', LE_9_SEPT, EXTRAIT_VIDE);
        expect(neuf.etat).toEqual(FORMULAIRE_VIDE);
        poser(neuf.etat);
        expect(hote.textContent).toContain('Mon formulaire');
    });
});
describe('l’onglet des réponses', () => {
    it('dit quoi faire tant que le formulaire n’est pas publié', () => {
        poser(FORM);
        expect(hote.textContent).toContain('n’est pas encore publié');
    });
    it('montre les réponses rapportées', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                reponses: [{ contenu: { nom: 'Awa', plat: 'Ndolè' }, recuLe: LE_9_SEPT.getTime() }],
            }),
        }));
        poser(FORM, 'K7M2XQ4BN9PZ');
        await jusqua(() => (hote.textContent ?? '').includes('Awa'));
        expect(hote.textContent).toContain('Awa');
        expect(hote.textContent).toContain('Ndolè');
        // Les questions donnent l'ordre et les libellés, pas les clefs reçues.
        expect(hote.textContent).toContain('Ton nom');
        expect(hote.textContent).not.toContain('nom :');
        // Le compte d'abord : c'est la première chose qu'on vient voir.
        expect(hote.textContent).toContain('1 réponse');
    });
    it('dit qu’il n’y a pas de réseau, au lieu de laisser croire à zéro réponse', async () => {
        // Un écran vide se lit « personne n'a répondu », et c'est le pire des
        // malentendus pour quelqu'un qui attend des commandes.
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
        poser(FORM, 'K7M2XQ4BN9PZ');
        await jusqua(() => (hote.textContent ?? '').includes('Pas de réseau'));
        expect(hote.textContent).toContain('Pas de réseau');
    });
    it('propose de renvoyer le lien quand personne n’a répondu', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true, json: () => Promise.resolve({ reponses: [] }),
        }));
        poser(FORM, 'K7M2XQ4BN9PZ');
        await jusqua(() => (hote.textContent ?? '').includes('Renvoie le lien'));
        expect(hote.textContent).toContain('Renvoie le lien');
    });
    it('écarte une ligne abîmée sans faire tomber les autres', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                reponses: [
                    'pas un objet',
                    { contenu: { nom: 'Awa' }, recuLe: LE_9_SEPT.getTime() },
                    { recuLe: 'hier' },
                ],
            }),
        }));
        poser(FORM, 'K7M2XQ4BN9PZ');
        await jusqua(() => (hote.textContent ?? '').includes('Awa'));
        expect(hote.textContent).toContain('Awa');
    });
});
describe('l’aperçu', () => {
    it('montre le formulaire tel qu’un visiteur le verra', async () => {
        poser(FORM);
        cliquer('Aperçu');
        await attendre();
        expect(hote.textContent).toContain('Ton nom');
        expect(hote.textContent).toContain('Envoyer ma commande');
        expect([...hote.querySelectorAll('option')].map((o) => o.textContent)).toContain('Ndolè');
    });
    it('mais ne poste nulle part, et ses champs sont inertes', async () => {
        /*
         * Un aperçu qui envoie vraiment ajouterait la réponse de celui qui a
         * fabriqué le formulaire à celles qu'il attend.
         */
        poser(FORM);
        cliquer('Aperçu');
        await attendre();
        expect(hote.querySelector('form')?.getAttribute('action')).toBe('');
        expect(hote.querySelector('.form-champ input')?.disabled).toBe(true);
    });
});
describe('un état qui ne tient pas le contrat', () => {
    it('se dit, au lieu d’ouvrir un formulaire qu’on ne peut pas remplir', () => {
        poser({ ...FORM, champs: [{ clef: 'plat', titre: 'Quel plat ?', sorte: 'choix' }] });
        expect(hote.textContent).toContain('ne correspond pas à ce que l’application sait dessiner');
    });
});
