import { jsx as _jsx } from "preact/jsx-runtime";
// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { render as monter } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/app.js';
import { CHARGEURS } from '../src/outils.js';
import { listerOutils, supprimerOutil } from '../src/stockage.js';
let hote;
/**
 * Laisse retomber les effets, les promesses d'IndexedDB et les imports
 * différés. Plusieurs tours : ouvrir un outil enchaîne un import dynamique,
 * une écriture en base et deux rendus, qui ne tiennent pas dans un seul.
 */
async function reposer(tours = 8) {
    for (let i = 0; i < tours; i += 1) {
        await new Promise((r) => setTimeout(r, 0));
    }
    // Un dernier tour dans `act` pour vider la file de rendu de Preact.
    act(() => undefined);
}
beforeEach(async () => {
    // Vitest ne fait pas avancer son chargeur de modules pour un import
    // dynamique lancé depuis un gestionnaire d'événement : la promesse reste
    // pendante indéfiniment. On préchauffe donc le cache. La chaîne exercée par
    // les tests reste la même — clic, création, enregistrement, ouverture — seul
    // le premier chargement du fragment est déplacé hors du chemin mesuré.
    await Promise.all(Object.values(CHARGEURS).map((chargeur) => chargeur()));
    for (const o of await listerOutils())
        await supprimerOutil(o.id);
    hote = document.createElement('div');
    document.body.appendChild(hote);
    act(() => monter(_jsx(App, {}), hote));
    await reposer();
});
afterEach(() => {
    monter(null, hote);
    hote.remove();
});
/**
 * Le clic se fait **hors** `act`, et la vidange vient après.
 *
 * `act` de preact/test-utils empêche une chaîne asynchrone démarrée dans son
 * rappel d'aboutir : un import dynamique lancé depuis un gestionnaire de clic
 * enveloppé dans `act` ne se résout jamais, et le test échoue sans rien dire.
 */
function cliquerTexte(texte) {
    const bouton = [...hote.querySelectorAll('button')].find((b) => b.textContent?.includes(texte));
    if (bouton === undefined)
        throw new Error(`bouton introuvable : ${texte}`);
    bouton.click();
}
function cliquer(selecteur) {
    const bouton = hote.querySelector(selecteur);
    if (bouton === null)
        throw new Error(`bouton introuvable : ${selecteur}`);
    bouton.click();
}
function saisir(selecteur, valeur) {
    const champ = hote.querySelector(selecteur);
    if (champ === null)
        throw new Error(`champ introuvable : ${selecteur}`);
    act(() => {
        champ.value = valeur;
        champ.dispatchEvent(new Event('input', { bubbles: true }));
    });
}
function saisirRecherche(valeur) {
    saisir('#recherche', valeur);
}
describe('l’accueil', () => {
    it('propose les outils qui ont un écran', () => {
        expect(hote.textContent).toContain('Devis');
        expect(hote.textContent).toContain('Facture');
        expect(hote.textContent).toContain('Carnet de njangi');
    });
    it('dit qu’il n’y a rien plutôt que de montrer une liste vide', () => {
        expect(hote.textContent).toContain('Rien pour l’instant');
    });
    it('filtre par mots-clés, sans appeler personne', () => {
        saisirRecherche('il me faut un devis');
        expect(hote.textContent).toContain('Devis');
        expect(hote.textContent).not.toContain('Carnet de njangi');
    });
    it('reconnaît le vocabulaire du terrain', () => {
        saisirRecherche('noter la tontine du quartier');
        expect(hote.textContent).toContain('Carnet de njangi');
        expect(hote.textContent).not.toContain('Facture');
    });
    it('le dit quand rien ne correspond, sans faire semblant', () => {
        saisirRecherche('réparer une mobylette');
        expect(hote.textContent).toContain('Rien ne correspond encore');
    });
    it('revient à la liste complète quand on efface la recherche', () => {
        saisirRecherche('devis');
        saisirRecherche('');
        expect(hote.textContent).toContain('Carnet de njangi');
    });
});
describe('créer et rouvrir un outil', () => {
    it('crée l’outil, l’ouvre, et le garde sur le téléphone', async () => {
        cliquerTexte('Carnet de njangi');
        await reposer();
        expect(hote.textContent).toContain('Aucun membre pour l’instant');
        expect(await listerOutils()).toHaveLength(1);
    });
    it('revient à l’accueil, où l’outil est listé', async () => {
        cliquerTexte('Carnet de njangi');
        await reposer();
        cliquerTexte('Mes outils');
        await reposer();
        expect(hote.textContent).toContain('Carnet de njangi');
        expect(hote.querySelectorAll('.outil-rangee')).toHaveLength(1);
    });
    it('rouvre un outil déjà créé, avec son état', async () => {
        cliquerTexte('Devis');
        await reposer();
        cliquerTexte('Mes outils');
        await reposer();
        cliquer('.lien-outil');
        await reposer();
        expect(hote.textContent).toContain('Sous-total HT');
    });
    it('supprime un outil depuis la liste', async () => {
        cliquerTexte('Facture');
        await reposer();
        cliquerTexte('Mes outils');
        await reposer();
        cliquer('.outil-retirer');
        await reposer();
        expect(await listerOutils()).toHaveLength(0);
        expect(hote.textContent).toContain('Rien pour l’instant');
    });
    it('enregistre chaque modification et fait monter la version', async () => {
        cliquerTexte('Carnet de njangi');
        await reposer();
        // Onglet Membres, puis ajout d'un membre.
        const onglets = hote.querySelectorAll('[role="tab"]');
        act(() => onglets[1]?.click());
        saisir('[aria-label="Nom du membre"]', 'Adèle');
        cliquerTexte('Ajouter au carnet');
        await reposer();
        const [range] = await listerOutils();
        expect(range?.version).toBe(1);
        expect((range?.etat).membres[0]?.nom).toBe('Adèle');
    });
});
