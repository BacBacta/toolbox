import { jsx as _jsx } from "preact/jsx-runtime";
// @vitest-environment happy-dom
import { CATALOGUE } from '@a237/engine';
import { render as monter } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Atelier } from '../src/atelier.js';
/**
 * L'atelier de bout en bout, y compris le chemin qui coûte de l'argent.
 *
 * `fetch` est remplacé : ce qu'on vérifie, c'est que la composition ne part
 * jamais toute seule, et que chaque façon d'échouer se dit à l'utilisateur
 * plutôt que de laisser l'écran figé.
 */
const REGISTRE = {
    titre: 'Suivi des livraisons',
    kicker: 'SUIVI DES LIVRAISONS',
    titreNom: 'Nom du dépôt',
    colonnes: [{ clef: 'client', titre: 'Client', type: 'texte' }],
    libelleVide: 'Aucune livraison pour l’instant.',
    libelleAjout: 'Ajouter une livraison',
    relancesVides: 'Un suivi se consulte, il ne se relance pas.',
};
let hote;
let creations;
beforeEach(() => {
    hote = document.createElement('div');
    document.body.appendChild(hote);
    creations = [];
    act(() => {
        monter(_jsx(Atelier, { fiches: CATALOGUE, onCreer: (skeleton, _e, compose) => creations.push({ skeleton, registre: compose }) }), hote);
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
const attendre = () => act(() => new Promise((r) => setTimeout(r, 0)));
function repond(statut, corps) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: statut >= 200 && statut < 300,
        status: statut,
        json: () => Promise.resolve(corps),
    }));
}
describe('l’étage 1 ne coûte rien', () => {
    it('n’appelle jamais le réseau pour une demande qu’il comprend', () => {
        const appels = vi.fn();
        vi.stubGlobal('fetch', appels);
        demander('njangi de 20 000 F par mois');
        cliquer('Ouvrir carnet de njangi');
        expect(appels).not.toHaveBeenCalled();
        expect(creations[0]?.skeleton).toBe('njangi');
    });
    it('propose de composer sans le faire : ça part sur un geste', () => {
        const appels = vi.fn();
        vi.stubGlobal('fetch', appels);
        demander('il me faut un contrat de bail');
        expect(hote.textContent).toContain('Compose-le pour moi');
        // Une génération par frappe brûlerait le budget sur des phrases inachevées.
        expect(appels).not.toHaveBeenCalled();
    });
});
describe('l’étage 2, quand on le demande', () => {
    it('crée le registre composé', async () => {
        repond(200, { registre: REGISTRE, fcfa: 0.21 });
        demander('je veux suivre mes livraisons de gaz');
        cliquer('Compose-le pour moi');
        await attendre();
        expect(creations[0]?.skeleton).toBe('compose');
        expect(creations[0]?.registre).toMatchObject({ registre: { titre: 'Suivi des livraisons' } });
    });
    it('dit que ce n’est pas encore ouvert, sans faire croire à une panne', async () => {
        repond(503, {});
        demander('je veux suivre mes livraisons de gaz');
        cliquer('Compose-le pour moi');
        await attendre();
        expect(hote.textContent).toContain('n’est pas encore ouverte');
        expect(creations).toHaveLength(0);
    });
    it('dit ce qui a raté plutôt que de figer l’écran', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
        demander('je veux suivre mes livraisons de gaz');
        cliquer('Compose-le pour moi');
        await attendre();
        expect(hote.textContent).toContain('pas de réseau');
    });
});
describe('quand la demande n’est pas un registre', () => {
    it('rapporte le refus du modèle, sans créer d’outil', async () => {
        // Le défaut d'origine : « je veux un site internet » créait un registre
        // « Ventes » inventé de bout en bout. Un outil qui ne sait pas dire non
        // finit par mentir.
        repond(200, { impossible: 'Un site internet ne se range pas dans un registre.', fcfa: 0.13 });
        demander('je veux un site internet');
        cliquer('Compose-le pour moi');
        await attendre();
        expect(hote.textContent).toContain('ne se range pas dans un registre');
        expect(creations).toHaveLength(0);
    });
    it('ne propose pas de réessayer : la réponse ne changera pas', async () => {
        repond(200, { impossible: 'Un logo se dessine, il ne se tient pas en lignes.', fcfa: 0.13 });
        demander('fais-moi un logo');
        cliquer('Compose-le pour moi');
        await attendre();
        expect(hote.textContent).not.toContain('Réessaie');
    });
});
describe('l’autre forme composable : une calculatrice', () => {
    const CALCUL = {
        titre: 'Reste à payer',
        kicker: 'RESTE À PAYER',
        titreNom: 'Nom de l’élève',
        entrees: [
            { clef: 'total', titre: 'Total dû', defaut: 0, unite: 'F' },
            { clef: 'verse', titre: 'Déjà versé', defaut: 0, unite: 'F' },
        ],
        sortie: {
            libelle: 'Reste à payer',
            unite: 'F',
            formule: { op: 'moins', gauche: { ref: 'total' }, droite: { ref: 'verse' } },
        },
    };
    it('crée la calculatrice composée', async () => {
        // Tout ce qui n'était pas une liste se heurtait à un refus, alors que le
        // moteur savait déjà dessiner des calculatrices — seule la formule
        // bloquait, parce qu'elle était écrite en TypeScript.
        repond(200, { calcul: CALCUL, fcfa: 0.14 });
        // Une demande que l'étage 1 ne connaît pas : sinon c'est lui qui répond,
        // gratuitement, et on ne testerait pas la composition.
        demander('ma marge sur chaque vente de telephone');
        cliquer('Compose-le pour moi');
        await attendre();
        expect(creations[0]?.skeleton).toBe('compose-calcul');
        expect(creations[0]?.registre).toMatchObject({ calcul: { titre: 'Reste à payer' } });
    });
    it('refuse une formule qui parle d’un champ inexistant', async () => {
        // Elle rendrait zéro sans rien dire — le pire résultat pour une
        // calculatrice, parce qu'un zéro ressemble à une réponse.
        repond(200, {
            calcul: { ...CALCUL, sortie: { ...CALCUL.sortie, formule: { ref: 'benefice' } } },
            fcfa: 0.14,
        });
        demander('ma marge sur chaque vente de telephone');
        cliquer('Compose-le pour moi');
        await attendre();
        expect(creations).toHaveLength(0);
        expect(hote.textContent).toContain('ne décrit pas un outil valide');
    });
});
describe('le crédit épuisé n’est pas une panne', () => {
    it('dit de recharger, sans proposer de réessayer', async () => {
        // « Le modèle n'a pas répondu » enverrait quelqu'un chercher un problème
        // qui n'existe pas pendant que la vraie cause tient en une phrase.
        repond(402, { erreur: 'plus de crédit pour composer' });
        demander('ma marge sur chaque vente de telephone');
        cliquer('Compose-le pour moi');
        await attendre();
        expect(hote.textContent).toContain('plus de crédit');
        expect(hote.textContent).not.toContain('Réessaie');
        expect(creations).toHaveLength(0);
    });
    it('rappelle que le reste continue de marcher', async () => {
        repond(402, {});
        demander('ma marge sur chaque vente de telephone');
        cliquer('Compose-le pour moi');
        await attendre();
        expect(hote.textContent).toContain('continuent de marcher');
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
    it('rapporte le refus du serveur, qui a le dernier mot', async () => {
        // Le navigateur annonce ; le serveur tranche. Un prix qu'on peut
        // contourner depuis les outils de développement n'est pas un prix.
        repond(402, { erreur: 'abonnement-requis', pourquoi: 'Cette demande vaut plusieurs outils.' });
        demander('ma marge sur chaque vente de telephone');
        cliquer('Compose-le pour moi');
        await attendre();
        expect(hote.textContent).toContain('vaut plusieurs outils');
        expect(creations).toHaveLength(0);
    });
});
