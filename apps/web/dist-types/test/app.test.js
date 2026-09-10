import { jsx as _jsx } from "preact/jsx-runtime";
// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { render as monter } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    // L'écran du compte se charge de la même façon, et se préchauffe pour la
    // même raison. Celui de l'agent aussi.
    await import('../src/ecran-compte.js');
    await import('../src/ecran-agent.js');
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
function demander(valeur) {
    saisir('#demande', valeur);
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
});
describe('l’atelier comprend la demande, sans appeler personne', () => {
    it('propose l’outil quand la demande est claire', () => {
        demander('il me faut un devis');
        expect(hote.textContent).toContain('Ouvrir devis');
    });
    it('reconnaît le vocabulaire du terrain', () => {
        demander('noter la tontine du quartier');
        expect(hote.textContent).toContain('Ouvrir carnet de njangi');
    });
    it('montre ce qu’il a compris avant d’ouvrir', () => {
        // Le résumé n'est pas décoratif : si « 20 000 F » avait été pris pour
        // autre chose, ça se verrait ici, avant le clic et non après.
        demander('njangi de 20 000 F par mois');
        expect(hote.textContent).toContain('Ouvrir carnet de njangi');
        expect(hote.textContent).toContain('par mois');
    });
    it('demande plutôt que de parier quand deux outils répondent', () => {
        demander('je veux un devis puis une facture');
        expect(hote.textContent).toContain('Lequel veux-tu ?');
    });
    it('le dit quand c’est hors de sa portée, et propose d’en parler', () => {
        demander('il me faut un contrat de bail');
        expect(hote.textContent).toContain('Aucun de mes outils ne correspond');
        // La conversation part sur un geste, jamais en tapant : chaque tour coûte.
        expect(hote.textContent).toContain('En parler à l’atelier');
    });
    it('garde la grille complète sous la main', () => {
        // La demande ne cache pas les autres outils : on peut toujours parcourir.
        demander('devis');
        expect(hote.textContent).toContain('Carnet de njangi');
    });
});
describe('l’atelier passe la main à l’agent', () => {
    const vraiFetch = globalThis.fetch;
    afterEach(() => {
        globalThis.fetch = vraiFetch;
    });
    const REGISTRE = {
        titre: 'Suivi des livraisons',
        kicker: 'SUIVI DES LIVRAISONS',
        titreNom: 'Nom du dépôt',
        colonnes: [{ clef: 'client', titre: 'Client', type: 'texte' }],
        libelleVide: 'Aucune livraison.',
        libelleAjout: 'Ajouter',
        relancesVides: 'Un suivi ne se relance pas.',
    };
    function agentRepond() {
        const corps = 'data: {"sorte":"fin","tour":{"sorte":"outil","mot":"Voilà ton suivi.",' +
            `"outil":{"sorte":"registre","registre":${JSON.stringify(REGISTRE)}}},` +
            '"fcfa":0.31,"conversation":"c.1.9e15.s","plan":"essai","credits":4}\n\n';
        const octets = new TextEncoder().encode(corps);
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            body: new ReadableStream({
                start(f) {
                    f.enqueue(octets);
                    f.close();
                },
            }),
            json: () => Promise.resolve({}),
        });
    }
    it('ouvre la conversation avec la phrase déjà tapée', async () => {
        agentRepond();
        demander('il me faut un contrat de bail');
        cliquerTexte('En parler à l’atelier');
        await reposer(12);
        expect(hote.textContent).toContain('il me faut un contrat de bail');
        expect(hote.querySelector('.agent-fenetre')).not.toBeNull();
    });
    it('crée l’outil composé, et dit ce qu’il a coûté', async () => {
        agentRepond();
        demander('il me faut un contrat de bail');
        cliquerTexte('En parler à l’atelier');
        await reposer(16);
        cliquerTexte('Ouvrir cet outil');
        await reposer(16);
        const [range] = await listerOutils();
        expect(range?.skeleton).toBe('compose');
        expect(range?.registre).toMatchObject({ titre: 'Suivi des livraisons' });
        // « 0 F » sous une dépense de trente et un centimes est le début d'une
        // facture qu'on découvre à la fin du mois.
        expect(hote.textContent).toContain('0,31');
    });
    it('revient à l’accueil sans rien créer quand on referme', async () => {
        agentRepond();
        demander('il me faut un contrat de bail');
        cliquerTexte('En parler à l’atelier');
        await reposer(12);
        cliquerTexte('Mes outils');
        await reposer();
        expect(await listerOutils()).toHaveLength(0);
        expect(hote.textContent).toContain('Tous les outils');
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
        // Le numéro est figé à la création : le retrouver prouve que c'est bien
        // l'état enregistré qui revient, et non un devis neuf.
        expect(hote.textContent).toContain('DV-2026-0001');
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
describe('diffuser, c’est d’abord publier', () => {
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
    async function ouvrirEtDiffuser(outil) {
        cliquerTexte(outil);
        await reposer();
        cliquer('.outil-action.principale');
        await reposer();
    }
    it('dépose l’outil, puis met l’adresse sur la carte', async () => {
        // L'ordre n'est pas indifférent : la carte porte le lien, donc il faut que
        // le lien existe avant de la dessiner.
        const appel = serveur(200);
        await ouvrirEtDiffuser('Carnet de njangi');
        expect(appel).toHaveBeenCalledOnce();
        expect(appel.mock.calls[0]?.[0]).toBe('/api/publier');
        const [outil] = await listerOutils();
        expect(outil?.lien).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTVWXYZ]{12}$/);
        expect(outil?.versionPubliee).toBe(outil?.version);
        // Le résumé partagé porte l'adresse.
        expect(hote.querySelector('.resume')?.textContent).toContain(`/d/${outil?.lien}`);
    });
    it('ne redépose pas un outil qui n’a pas bougé', async () => {
        const appel = serveur(200);
        await ouvrirEtDiffuser('Carnet de njangi');
        cliquer('.feuille-fermer');
        await reposer();
        cliquer('.outil-action.principale');
        await reposer();
        expect(appel).toHaveBeenCalledOnce();
        expect(hote.querySelector('.resume')?.textContent).toContain('/d/');
    });
    it('partage sans adresse quand le réseau manque, et le dit', async () => {
        // Un lien inscrit d'avance serait une adresse morte, envoyée sous le nom
        // de celui qui la partage.
        globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('hors ligne'));
        await ouvrirEtDiffuser('Carnet de njangi');
        expect(hote.textContent).toContain('la publication attend son tour');
        const [outil] = await listerOutils();
        expect(outil?.lien).toBeUndefined();
        expect(hote.querySelector('.resume')?.textContent).not.toContain('/d/');
    });
    it('dit pourquoi une ardoise ne se publie pas, sans appeler personne', async () => {
        const appel = serveur(200);
        await ouvrirEtDiffuser('Ardoise clients');
        expect(appel).not.toHaveBeenCalled();
        expect(hote.textContent).toContain('noms et des dettes');
        // Elle se partage quand même : ce qu'on lui retire, c'est l'adresse.
        expect(hote.querySelector('.carte-apercu')).not.toBeNull();
    });
    it('annonce le conflit de version avec le numéro du serveur', async () => {
        serveur(409, { erreur: 'version-perimee', versionServeur: 7 });
        await ouvrirEtDiffuser('Carnet de njangi');
        expect(hote.textContent).toContain('version 7');
        expect((await listerOutils())[0]?.lien).toBeUndefined();
    });
});
describe('la ligne du compte', () => {
    /*
     * Elle est en bas, discrète, et n'apparaît qu'une fois qu'on a composé
     * quelque chose. Avant, il n'y a rien à savoir — et une invitation à
     * s'occuper de son abonnement serait la première chose que verrait
     * quelqu'un venu faire un devis. L'atelier marche sans compte (§ 2).
     */
    /*
     * On repose l'application après avoir écrit l'état.
     *
     * Le dernier état connu se lit une fois, au montage : le monter d'abord et
     * l'écrire ensuite ferait lire une base vide, et l'essai ne dirait rien de
     * ce qu'il croit vérifier.
     */
    async function poserEtat(etat) {
        const { retenirEtat } = await import('../src/compte.js');
        await retenirEtat(etat);
        monter(null, hote);
        act(() => monter(_jsx(App, {}), hote));
        await reposer();
    }
    it('ne s’affiche pas tant qu’on n’a rien composé', async () => {
        const { clear, createStore } = await import('idb-keyval');
        await clear(createStore('atelier237-compte', 'compte'));
        monter(null, hote);
        act(() => monter(_jsx(App, {}), hote));
        await reposer();
        expect(hote.querySelector('.compte-ligne')).toBeNull();
    });
    it('dit ce qu’il reste en essai', async () => {
        await poserEtat({ plan: 'essai', credits: 3, expire: null, aUnCode: false });
        expect(hote.querySelector('.compte-ligne')?.textContent).toBe('Essai · 3 compositions');
    });
    it('et le dit au singulier quand il n’en reste qu’une', async () => {
        await poserEtat({ plan: 'essai', credits: 1, expire: null, aUnCode: false });
        expect(hote.querySelector('.compte-ligne')?.textContent).toBe('Essai · 1 composition');
    });
    it('à zéro, elle ne compte pas : elle le dit', async () => {
        // « Essai · 0 composition » se lit mal. Ce qui compte est qu'il n'y en a
        // plus, pas le nombre zéro.
        await poserEtat({ plan: 'essai', credits: 0, expire: null, aUnCode: false });
        expect(hote.querySelector('.compte-ligne')?.textContent).toBe('Essai · plus de composition');
    });
    it('et distingue un abonné', async () => {
        await poserEtat({ plan: 'atelier', credits: 40, expire: Date.now() + 86_400_000, aUnCode: true });
        expect(hote.querySelector('.compte-ligne')?.textContent).toBe('Atelier · 40 compositions');
    });
    it('elle ouvre l’écran du compte, qui n’est pas dans la coquille initiale', async () => {
        await poserEtat({ plan: 'essai', credits: 3, expire: null, aUnCode: false });
        cliquer('.compte-ligne');
        await reposer();
        expect(hote.textContent).toContain('Mon atelier');
    });
});
