import { jsx as _jsx } from "preact/jsx-runtime";
// @vitest-environment happy-dom
import { CATALOGUE } from '@a237/engine';
import { render as monter } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Atelier } from '../src/atelier.js';
/**
 * L'atelier : on dit ce dont on a besoin, l'outil s'ouvre.
 *
 * C'est l'étage 1 du brief — **zéro jeton, hors ligne, instantané**. Il n'a
 * jamais rien à voir avec le modèle : il reconnaît, il ouvre, ou il admet
 * qu'il ne sait pas. Ce qu'il fait de cet aveu a changé — il passait la main à
 * une génération unique, il passe maintenant la main à une conversation — mais
 * ce qui est éprouvé ici est le même : **rien ne part sur le réseau tant que
 * personne n'a fait un geste**.
 */
let hote;
let ouverts;
let discussions;
beforeEach(() => {
    hote = document.createElement('div');
    document.body.appendChild(hote);
    ouverts = [];
    discussions = [];
    act(() => {
        monter(_jsx(Atelier, { fiches: CATALOGUE, onCreer: (skeleton) => ouverts.push(skeleton), onDiscuter: (demande) => discussions.push(demande) }), hote);
    });
});
afterEach(() => {
    monter(null, hote);
    hote.remove();
    vi.unstubAllGlobals();
});
function demander(texte) {
    const champ = hote.querySelector('#demande');
    if (champ === null)
        throw new Error('champ introuvable');
    act(() => {
        champ.value = texte;
        champ.dispatchEvent(new Event('input', { bubbles: true }));
    });
}
function cliquer(texte) {
    const b = [...hote.querySelectorAll('button')].find((x) => x.textContent?.includes(texte));
    if (b === undefined)
        throw new Error(`bouton introuvable : ${texte}`);
    act(() => b.click());
}
describe('l’étage 1 ne coûte rien', () => {
    it('n’appelle jamais le réseau pour une demande qu’il comprend', () => {
        const appels = vi.fn();
        vi.stubGlobal('fetch', appels);
        demander('njangi de 20 000 F par mois');
        cliquer('Ouvrir carnet de njangi');
        expect(appels).not.toHaveBeenCalled();
        expect(ouverts[0]).toBe('njangi');
    });
    it('demande lequel quand plusieurs répondent, plutôt que d’en ouvrir un', () => {
        // Ouvrir d'autorité le mauvais outil fait perdre plus de temps qu'une
        // question : il faut comprendre, revenir, recommencer.
        demander('course scolarite');
        expect(hote.textContent).toContain('Lequel veux-tu ?');
    });
    it('et ouvre celui qu’on désigne', () => {
        demander('course scolarite');
        const choix = hote.querySelectorAll('.atelier-option');
        act(() => choix[0]?.click());
        expect(ouverts).toHaveLength(1);
    });
    it('ouvre à la touche Entrée quand il n’y a aucun doute', () => {
        // Le chemin de quelqu'un qui sait ce qu'il veut et tape vite.
        demander('njangi de 20 000 F par mois');
        const form = hote.querySelector('form');
        act(() => {
            form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        });
        expect(ouverts).toEqual(['njangi']);
    });
    it('mais Entrée n’ouvre rien quand il y a un doute', () => {
        demander('course scolarite');
        const form = hote.querySelector('form');
        act(() => {
            form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        });
        expect(ouverts).toHaveLength(0);
    });
    it('propose des exemples tant qu’on n’a rien tapé, et les reprend au clic', () => {
        // Ils montrent ce qu'une phrase peut porter, pas seulement le nom d'un
        // outil : le premier prouve qu'un montant et une période sont entendus.
        const exemples = hote.querySelectorAll('.atelier-exemple');
        expect(exemples.length).toBeGreaterThan(2);
        act(() => exemples[0]?.click());
        expect(hote.textContent).toContain('Ouvrir carnet de njangi');
    });
});
describe('quand aucun outil ne correspond', () => {
    it('propose d’en parler, sans rien lancer : ça part sur un geste', () => {
        const appels = vi.fn();
        vi.stubGlobal('fetch', appels);
        demander('il me faut un contrat de bail');
        expect(hote.textContent).toContain('En parler à l’atelier');
        // Une génération par frappe brûlerait le budget sur des phrases inachevées.
        expect(appels).not.toHaveBeenCalled();
        expect(discussions).toHaveLength(0);
    });
    it('passe la phrase telle quelle à la conversation', () => {
        // Elle a déjà été tapée : la redemander serait la faire taper deux fois.
        demander('il me faut un contrat de bail');
        cliquer('En parler à l’atelier');
        expect(discussions).toEqual(['il me faut un contrat de bail']);
    });
    it('annonce les quatre formes avant qu’on clique', () => {
        demander('il me faut un contrat de bail');
        const dit = hote.textContent ?? '';
        for (const forme of ['registre', 'calculatrice', 'page', 'formulaire']) {
            expect(dit).toContain(forme);
        }
    });
});
describe('le prix se dit avant le clic', () => {
    it('annonce « quelques centimes » pour un outil', () => {
        demander('je veux suivre mes livraisons de gaz');
        expect(hote.textContent).toContain('quelques centimes');
    });
    it('annonce l’abonnement pour une demande qui vaut plusieurs outils', () => {
        // Sans appeler personne : l'étage se calcule hors ligne, gratuitement.
        // C'est ce qui permet d'annoncer un prix plutôt qu'une facture.
        const appels = vi.fn();
        vi.stubGlobal('fetch', appels);
        demander('il me faut tout ce qu il faut pour ma boutique');
        expect(hote.textContent).toContain('plusieurs outils');
        expect(hote.textContent).toContain('abonnement');
        expect(appels).not.toHaveBeenCalled();
    });
});
