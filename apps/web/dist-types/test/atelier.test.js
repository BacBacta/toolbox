import { jsx as _jsx } from "preact/jsx-runtime";
// @vitest-environment happy-dom
// Le jeton de l'appareil vit dans IndexedDB : sans lui, aucune requête qui
// engage le compte ne part.
import 'fake-indexeddb/auto';
import { CATALOGUE } from '@a237/engine';
import { render as monter } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
/*
 * Deux tours et non un.
 *
 * Une composition ne fait plus qu'un aller-retour réseau : elle présente le
 * jeton de l'appareil, lu dans IndexedDB, et range le solde que la réponse
 * rapporte. Le jeton est tiré une fois avant les cas pour que son premier
 * accès — le plus lent — ne se mêle pas au minutage.
 */
const attendre = async () => {
    await act(() => new Promise((r) => setTimeout(r, 0)));
    await act(() => new Promise((r) => setTimeout(r, 0)));
};
beforeAll(async () => {
    const { jetonDeCetAppareil } = await import('../src/appareil.js');
    await jetonDeCetAppareil();
});
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
describe('la troisième forme : une page', () => {
    const PAGE = {
        titre: 'Quincaillerie Bépanda',
        kicker: 'QUINCAILLERIE',
        accroche: 'Tôles, ciment et outillage, à Bépanda depuis 2012.',
        sections: [
            { titre: 'Quelques prix', sorte: 'prix', lignes: [{ nom: 'Sac de ciment', valeur: '5 800 F' }] },
        ],
        telephone: '699412708',
    };
    it('crée la page composée', async () => {
        /*
         * Le défaut rapporté depuis un téléphone : « je veux un site internet »
         * n'avait aucune issue sinon le refus, parce que rien derrière ne savait
         * en faire une. Le refus était juste ; c'est ce qu'il refusait qui
         * manquait. Neuf demandes de site sur dix demandent une page à envoyer sur
         * WhatsApp — pas un site.
         */
        repond(200, { page: PAGE, fcfa: 0.19 });
        demander('je veux un site internet pour ma quincaillerie');
        cliquer('Compose-le pour moi');
        await attendre();
        expect(creations[0]?.skeleton).toBe('compose-page');
        expect(creations[0]?.registre).toMatchObject({ page: { titre: 'Quincaillerie Bépanda' } });
    });
    it('refuse une page dont une section est un titre suivi de rien', async () => {
        // Elle se publierait sous le nom de quelqu'un, avec un trou dedans.
        repond(200, { page: { ...PAGE, sections: [{ titre: 'Nos prix', sorte: 'prix' }] }, fcfa: 0.19 });
        demander('je veux un site internet pour ma quincaillerie');
        cliquer('Compose-le pour moi');
        await attendre();
        expect(creations).toHaveLength(0);
        expect(hote.textContent).toContain('ne décrit pas un outil valide');
    });
    it('annonce les trois formes avant qu’on clique', () => {
        // Ce que la machine sait faire se dit avant de payer, pas après.
        demander('je veux un site internet pour ma quincaillerie');
        expect(hote.textContent).toContain('une page à envoyer sur');
    });
});
describe('la quatrième forme : un formulaire', () => {
    const FORM = {
        titre: 'Commandes du week-end',
        kicker: 'TRAITEUR MAMA NGO',
        accroche: 'Commande avant vendredi 18 h.',
        champs: [{ clef: 'nom', titre: 'Ton nom', sorte: 'texte', obligatoire: true }],
        bouton: 'Envoyer ma commande',
        merci: 'C’est noté.',
    };
    it('crée le formulaire composé', async () => {
        // La seule des quatre formes qui reçoit. Ce qui se fait aujourd'hui par
        // vingt messages WhatsApp recopiés à la main dans un cahier.
        repond(200, { formulaire: FORM, fcfa: 0.17 });
        demander('savoir qui vient a la fete et ce qu il apporte');
        cliquer('Compose-le pour moi');
        await attendre();
        expect(creations[0]?.skeleton).toBe('compose-formulaire');
        expect(creations[0]?.registre).toMatchObject({
            formulaire: { titre: 'Commandes du week-end' },
        });
    });
    it('refuse un choix dont aucune réponse n’est possible', async () => {
        repond(200, {
            formulaire: { ...FORM, champs: [{ clef: 'plat', titre: 'Quel plat ?', sorte: 'choix' }] },
            fcfa: 0.17,
        });
        demander('savoir qui vient a la fete et ce qu il apporte');
        cliquer('Compose-le pour moi');
        await attendre();
        expect(creations).toHaveLength(0);
        expect(hote.textContent).toContain('ne décrit pas un outil valide');
    });
    it('annonce les quatre formes avant qu’on clique', () => {
        demander('savoir qui vient a la fete et ce qu il apporte');
        expect(hote.textContent).toContain('un formulaire qui ramasse les réponses');
    });
});
describe('quand la demande n’est aucune des quatre', () => {
    it('rapporte le refus du modèle, sans créer d’outil', async () => {
        // Un outil qui ne sait pas dire non finit par mentir : il inventait un
        // registre « Ventes » de bout en bout, et le facturait.
        repond(200, { impossible: 'Un logo se dessine, il ne se tient pas en lignes.', fcfa: 0.13 });
        demander('fais-moi un logo');
        cliquer('Compose-le pour moi');
        await attendre();
        expect(hote.textContent).toContain('il ne se tient pas en lignes');
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
