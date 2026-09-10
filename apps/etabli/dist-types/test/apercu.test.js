import { jsx as _jsx } from "preact/jsx-runtime";
// @vitest-environment happy-dom
import { render as monter } from 'preact';
import { act } from 'preact/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';
import { Apercu } from '../src/apercu.js';
const PROJET = {
    id: 'p1', nom: 'Ma page', maj: 0,
    fichiers: [{ nom: 'index.html', contenu: '<h1>Salut</h1>' }],
};
let hote;
function poser(tour = 0) {
    act(() => { monter(_jsx(Apercu, { projet: PROJET, tour: tour }), hote); });
}
beforeEach(() => {
    hote = document.createElement('div');
    document.body.appendChild(hote);
});
/**
 * L'isolement du cadre est la seule chose qui rend tout le reste acceptable.
 *
 * On exécute ici du code écrit par quelqu'un — le sien, ou celui d'un projet
 * reçu sur WhatsApp. Sans `allow-same-origin`, ce code s'exécute dans une
 * origine opaque : il n'atteint ni le stockage de l'Établi, ni ses cookies, ni
 * son DOM. Avec, il pourrait retirer son propre bac à sable et lire les projets
 * de la personne.
 *
 * L'attribut est vérifié **sur l'élément rendu**, et pas seulement dans la
 * constante : c'est le poser qui compte, et l'oublier ne se voit pas à l'œil —
 * la page s'affiche exactement pareil.
 */
describe('le cadre d’exécution', () => {
    it('porte son bac à sable', () => {
        poser();
        const cadre = hote.querySelector('iframe');
        expect(cadre?.getAttribute('sandbox')).toBe('allow-scripts');
    });
    it('et jamais son origine', () => {
        poser();
        expect(hote.querySelector('iframe')?.getAttribute('sandbox')).not.toContain('allow-same-origin');
    });
    it('porte le projet, et un titre pour qui n’y voit pas', () => {
        poser();
        const cadre = hote.querySelector('iframe');
        expect(cadre?.getAttribute('srcdoc')).toContain('<h1>Salut</h1>');
        expect(cadre?.getAttribute('title')).not.toBe('');
    });
});
/**
 * La console : ce qui fait qu'on voit ses erreurs sur un téléphone.
 *
 * Il n'y a ni touche F12 ni outils de développement sur un Android d'entrée de
 * gamme. Sans cet écran, une page blanche est indiscernable d'une page qui
 * charge, et quelqu'un qui apprend en conclut qu'il n'y arrive pas.
 */
describe('la console', () => {
    function poster(donnees, source) {
        const cadre = hote.querySelector('iframe');
        const evenement = new MessageEvent('message', { data: donnees });
        // `source` est en lecture seule sur l'événement : on le pose à la main,
        // comme le navigateur le ferait pour un message venu du cadre.
        Object.defineProperty(evenement, 'source', {
            value: source === undefined ? cadre.contentWindow : source,
        });
        act(() => { dispatchEvent(evenement); });
    }
    it('affiche ce que le code journalise', () => {
        poser();
        act(() => { hote.querySelector('.console-titre').click(); });
        poster({ a237: 'etabli', sorte: 'journal', texte: 'salut' });
        expect(hote.querySelector('.console')?.textContent).toContain('salut');
    });
    it('signale les erreurs autrement : c’est ce qu’on cherche', () => {
        poser();
        poster({ a237: 'etabli', sorte: 'erreur', texte: 'a is not defined' });
        expect(hote.querySelector('.console-titre')?.className).toContain('a-des-erreurs');
        expect(hote.querySelector('.console-titre')?.textContent).toContain('1 erreur');
    });
    /*
     * N'importe quelle page, n'importe quelle extension peut poster dans cette
     * fenêtre. Sans la vérification de la source, leur texte s'afficherait comme
     * s'il venait du code de la personne — qui chercherait alors une faute qu'elle
     * n'a pas commise.
     */
    it('ignore ce qui ne vient pas de son cadre', () => {
        poser();
        act(() => { hote.querySelector('.console-titre').click(); });
        poster({ a237: 'etabli', sorte: 'journal', texte: 'venu d’ailleurs' }, window);
        expect(hote.querySelector('.console')?.textContent).not.toContain('venu d’ailleurs');
    });
    it('et ignore un message de la bonne source mais de la mauvaise forme', () => {
        poser();
        act(() => { hote.querySelector('.console-titre').click(); });
        poster({ sorte: 'journal', texte: 'sans marque' });
        poster('du texte tout seul');
        expect(hote.querySelector('.console')?.textContent).not.toContain('sans marque');
    });
    /*
     * Mélanger deux exécutions fait chercher une erreur qu'on vient de corriger.
     */
    it('repart vide à chaque lancement', () => {
        poser(1);
        act(() => { hote.querySelector('.console-titre').click(); });
        poster({ a237: 'etabli', sorte: 'journal', texte: 'du tour d’avant' });
        expect(hote.querySelector('.console')?.textContent).toContain('du tour d’avant');
        poser(2);
        expect(hote.querySelector('.console')?.textContent ?? '').not.toContain('du tour d’avant');
    });
});
/**
 * Ce que la console dit quand elle n'a rien à dire.
 *
 * « Rien pour l'instant » plutôt qu'un panneau vide : la différence entre les
 * deux, c'est savoir si la console marche. Et la phrase apprend la seule chose
 * qu'il faut savoir pour s'en servir.
 */
describe('la console vide', () => {
    it('explique comment s’en servir plutôt que de ne rien montrer', () => {
        poser();
        act(() => { hote.querySelector('.console-titre').click(); });
        expect(hote.querySelector('.console-vide')?.textContent).toContain('console.log');
    });
    it('et compte les erreurs au pluriel quand il y en a plusieurs', () => {
        poser();
        const cadre = hote.querySelector('iframe');
        for (const texte of ['une', 'deux']) {
            const e = new MessageEvent('message', { data: { a237: 'etabli', sorte: 'erreur', texte } });
            Object.defineProperty(e, 'source', { value: cadre.contentWindow });
            act(() => { dispatchEvent(e); });
        }
        expect(hote.querySelector('.console-titre')?.textContent).toContain('2 erreurs');
    });
});
