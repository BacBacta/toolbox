import { jsx as _jsx } from "preact/jsx-runtime";
// @vitest-environment happy-dom
import { SQUELETTES, valider } from '@a237/engine';
import { render as monter } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChampsSchema, valeurNeuve } from '../src/formulaire.js';
let hote;
beforeEach(() => {
    hote = document.createElement('div');
    document.body.appendChild(hote);
});
afterEach(() => {
    monter(null, hote);
    hote.remove();
});
function poser(schema, valeur, onChange = () => undefined, masques) {
    act(() => {
        monter(_jsx(ChampsSchema, { schema: schema, valeur: valeur, onChange: onChange, ...(masques !== undefined ? { masques } : {}) }), hote);
    });
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
describe('les libellés viennent du schéma', () => {
    it('emploie title, pas la clef', () => {
        poser({ type: 'object', properties: { niu: { type: 'string', title: 'NIU' } } }, {});
        expect(hote.textContent).toContain('NIU');
        expect(hote.textContent).not.toContain('niu');
    });
    it('retombe sur le chemin quand le champ n’a pas de libellé', () => {
        poser({ type: 'object', properties: { obscur: { type: 'string' } } }, {});
        expect(hote.textContent).toContain('obscur');
    });
    it('affiche la description en aide', () => {
        poser({ type: 'object', properties: { n: { type: 'string', title: 'N', description: 'Ex. DV-1.' } } }, {});
        expect(hote.textContent).toContain('Ex. DV-1.');
    });
});
describe('le champ dépend du type', () => {
    it('rend une ligne pour un texte court', () => {
        poser({ type: 'string', title: 'Nom', maxLength: 40 }, 'Adèle');
        const champ = hote.querySelector('input[type="text"]');
        expect(champ?.value).toBe('Adèle');
        expect(champ?.maxLength).toBe(40);
    });
    it('rend un paragraphe à partir de cent caractères', () => {
        poser({ type: 'string', title: 'Conditions', maxLength: 200 }, '');
        expect(hote.querySelector('textarea')).not.toBeNull();
        expect(hote.querySelector('input[type="text"]')).toBeNull();
    });
    it('et à cent vingt exactement, ce qui est la taille d’une accroche', () => {
        // Le seuil était « au-delà de cent vingt » : une accroche de page en fait
        // exactement cent vingt et tombait dans un champ d'une ligne, qui n'en
        // montrait que la moitié. On ne relit pas une phrase qu'on ne voit pas.
        poser({ type: 'string', title: 'Accroche', maxLength: 120 }, '');
        expect(hote.querySelector('textarea')).not.toBeNull();
    });
    it('rend une liste déroulante pour un enum', () => {
        poser({ type: 'string', title: 'Encre', enum: ['encre', 'bordeaux'] }, 'bordeaux');
        const select = hote.querySelector('select');
        expect(select?.value).toBe('bordeaux');
        expect(select?.options).toHaveLength(2);
    });
    it('rend une case à cocher pour un booléen', () => {
        poser({ type: 'boolean', title: 'Entreprise' }, true);
        expect(hote.querySelector('input[type="checkbox"]')?.checked).toBe(true);
    });
    it('ouvre un clavier numérique pour un nombre', () => {
        poser({ type: 'integer', title: 'Cotisation' }, 5_000);
        const champ = hote.querySelector('input');
        expect(champ?.value).toBe('5000');
        expect(champ?.inputMode).toBe('decimal');
    });
});
describe('la saisie remonte une nouvelle valeur, sans muter l’ancienne', () => {
    it('remonte le texte tapé', () => {
        const onChange = vi.fn();
        poser({ type: 'string', title: 'Nom' }, '', onChange);
        saisir('input', 'Ets Mbarga');
        expect(onChange).toHaveBeenCalledWith('Ets Mbarga');
    });
    it('accepte les espaces et la virgule d’un clavier Android', () => {
        const onChange = vi.fn();
        poser({ type: 'integer', title: 'Montant' }, 0, onChange);
        saisir('input', '12 500');
        expect(onChange).toHaveBeenLastCalledWith(12_500);
        saisir('input', '2,5');
        expect(onChange).toHaveBeenLastCalledWith(2.5);
    });
    it('retombe sur zéro plutôt que sur NaN', () => {
        const onChange = vi.fn();
        poser({ type: 'integer', title: 'Montant' }, 0, onChange);
        saisir('input', 'beaucoup');
        expect(onChange).toHaveBeenLastCalledWith(0);
        saisir('input', '');
        expect(onChange).toHaveBeenLastCalledWith(0);
    });
    it('recompose l’objet sans toucher à l’original', () => {
        const onChange = vi.fn();
        const valeur = { nom: 'Ets', niu: 'M0221' };
        poser({
            type: 'object',
            properties: { nom: { type: 'string', title: 'Nom' }, niu: { type: 'string', title: 'NIU' } },
        }, valeur, onChange);
        saisir('input', 'Ets Mbarga');
        expect(onChange).toHaveBeenCalledWith({ nom: 'Ets Mbarga', niu: 'M0221' });
        expect(valeur.nom).toBe('Ets');
    });
    it('recompose un objet imbriqué de bout en bout', () => {
        const onChange = vi.fn();
        poser({
            type: 'object',
            properties: {
                emetteur: {
                    type: 'object',
                    title: 'Ton entreprise',
                    properties: { nom: { type: 'string', title: 'Raison sociale' } },
                },
            },
        }, { emetteur: { nom: '' } }, onChange);
        saisir('input', 'Quincaillerie');
        expect(onChange).toHaveBeenCalledWith({ emetteur: { nom: 'Quincaillerie' } });
    });
});
describe('les listes', () => {
    const schema = {
        type: 'array',
        title: 'Lignes',
        maxItems: 2,
        items: {
            type: 'object',
            properties: {
                designation: { type: 'string', title: 'Désignation' },
                prixUnitaire: { type: 'integer', title: 'Prix' },
            },
            required: ['designation', 'prixUnitaire'],
        },
    };
    it('dit qu’il n’y a rien plutôt que de ne rien montrer', () => {
        poser(schema, []);
        expect(hote.textContent).toContain('Rien pour l’instant');
    });
    it('ajoute une ligne conforme au schéma', () => {
        const onChange = vi.fn();
        poser(schema, [], onChange);
        act(() => hote.querySelector('.champ-ajouter')?.click());
        expect(onChange).toHaveBeenCalledWith([{ designation: '', prixUnitaire: 0 }]);
    });
    it('retire la bonne ligne', () => {
        const onChange = vi.fn();
        poser(schema, [{ designation: 'a', prixUnitaire: 1 }, { designation: 'b', prixUnitaire: 2 }], onChange);
        act(() => hote.querySelector('[aria-label="Retirer la ligne 1"]')?.click());
        expect(onChange).toHaveBeenCalledWith([{ designation: 'b', prixUnitaire: 2 }]);
    });
    it('modifie la bonne ligne', () => {
        const onChange = vi.fn();
        poser(schema, [{ designation: 'a', prixUnitaire: 1 }, { designation: 'b', prixUnitaire: 2 }], onChange);
        const champs = hote.querySelectorAll('.champ-element input');
        act(() => {
            const cible = champs[2];
            if (cible === undefined)
                throw new Error('champ absent');
            cible.value = 'bis';
            cible.dispatchEvent(new Event('input', { bubbles: true }));
        });
        expect(onChange).toHaveBeenCalledWith([
            { designation: 'a', prixUnitaire: 1 },
            { designation: 'bis', prixUnitaire: 2 },
        ]);
    });
    it('interdit d’ajouter au-delà du plafond du schéma', () => {
        poser(schema, [{ designation: 'a', prixUnitaire: 1 }, { designation: 'b', prixUnitaire: 2 }]);
        expect(hote.querySelector('.champ-ajouter')?.disabled).toBe(true);
    });
    it('tient sur une valeur qui n’est pas une liste', () => {
        poser(schema, 'pas une liste');
        expect(hote.textContent).toContain('Rien pour l’instant');
    });
});
describe('les champs masqués', () => {
    it('ne montrent pas ce qui est dérivé', () => {
        poser({
            type: 'object',
            properties: {
                numero: { type: 'string', title: 'Numéro' },
                emisLe: { type: 'string', title: 'Date d’émission' },
            },
        }, {}, () => undefined, ['$.emisLe']);
        expect(hote.textContent).toContain('Numéro');
        expect(hote.textContent).not.toContain('Date d’émission');
    });
});
describe('valeurNeuve', () => {
    it.each([
        [{ type: 'string' }, ''],
        [{ type: 'string', enum: ['a', 'b'] }, 'a'],
        [{ type: 'integer' }, 0],
        [{ type: 'integer', minimum: 5 }, 5],
        [{ type: 'boolean' }, false],
        [{ type: 'array', items: { type: 'string' } }, []],
    ])('rend une valeur conforme pour %j', (schema, attendu) => {
        expect(valeurNeuve(schema)).toEqual(attendu);
    });
    it('remplit un objet avec ses champs obligatoires', () => {
        expect(valeurNeuve({
            type: 'object',
            properties: { a: { type: 'string' }, b: { type: 'integer' }, c: { type: 'boolean' } },
            required: ['a', 'b'],
        })).toEqual({ a: '', b: 0 });
    });
    it('remplit tous les champs quand aucun n’est déclaré obligatoire', () => {
        expect(valeurNeuve({ type: 'object', properties: { a: { type: 'string' } } })).toEqual({ a: '' });
    });
});
describe('« Ajouter une ligne » ne doit jamais casser l’outil', () => {
    /**
     * `valeurNeuve` promet « une valeur neuve conforme au schéma ». Si elle ne
     * l'est pas, l'état devient invalide au clic et tout l'écran est remplacé par
     * « cet outil ne correspond pas à ce que l'application sait dessiner » —
     * avant même que la personne ait tapé une lettre.
     *
     * La garde vaut pour les squelettes d'aujourd'hui comme pour ceux de demain :
     * elle parcourt le catalogue, pas une liste écrite à la main.
     */
    /** Les schémas d'élément : les seuls que le bouton « Ajouter » fabrique. */
    function elementsDeListe(schema, chemin = '$') {
        if (schema.type === 'array') {
            return [
                [`${chemin}[]`, schema.items],
                ...elementsDeListe(schema.items, `${chemin}[]`),
            ];
        }
        if (schema.type === 'object') {
            return Object.entries(schema.properties).flatMap(([clef, sous]) => elementsDeListe(sous, `${chemin}.${clef}`));
        }
        return [];
    }
    it.each(SQUELETTES.map((s) => [s.id, s.schema]))('« %s » : chaque valeur neuve satisfait son schéma', (_id, schema) => {
        const fautives = elementsDeListe(schema)
            .map(([chemin, sous]) => [chemin, valider(sous, valeurNeuve(sous))])
            .filter(([, erreurs]) => erreurs.length > 0)
            .map(([chemin, erreurs]) => `${chemin} — ${erreurs[0]?.message ?? ''}`);
        expect(fautives).toEqual([]);
    });
});
describe('deux listes sur le même écran', () => {
    /*
     * Une section de page contient une liste de lignes : les deux sont des
     * listes, et leurs boutons disaient la même chose. Deux boutons identiques
     * qui détruisent des choses différentes se distinguent au moment où on s'est
     * trompé — et sur un téléphone, c'est trop tard.
     */
    const imbrique = {
        type: 'array',
        title: 'Sections',
        ecran: { ajout: 'Ajouter une section', retrait: 'Retirer la section' },
        items: {
            type: 'object',
            properties: {
                titre: { type: 'string', title: 'Titre' },
                lignes: {
                    type: 'array',
                    title: 'Lignes',
                    ecran: { ajout: 'Ajouter une ligne', retrait: 'Retirer la ligne' },
                    items: { type: 'object', properties: { nom: { type: 'string', title: 'Nom' } } },
                },
            },
        },
    };
    it('nomme ce que chaque bouton ajoute et retire', () => {
        poser(imbrique, [{ titre: 'Nos prix', lignes: [{ nom: 'Ciment' }] }]);
        const textes = [...hote.querySelectorAll('button')].map((b) => b.textContent);
        expect(textes).toContain('Ajouter une section');
        expect(textes).toContain('Ajouter une ligne');
        expect(textes).toContain('Retirer la section');
        expect(textes).toContain('Retirer la ligne');
    });
});
describe('un champ qui dépend de son voisin', () => {
    /*
     * Une section porte un texte **ou** des lignes, jamais les deux, et le
     * schéma ne sait dire que « facultatif ». L'éditeur montrait donc une zone
     * de texte vide sous chaque liste de prix : ce qu'on y tape ne s'affiche
     * jamais, et rien ne le dit.
     */
    const conditionnel = {
        type: 'object',
        properties: {
            sorte: { type: 'string', enum: ['texte', 'liste'], title: 'Sorte' },
            texte: { type: 'string', title: 'Texte', ecran: { montrerSi: { champ: 'sorte', vaut: ['texte'] } } },
            lignes: {
                type: 'array',
                title: 'Lignes',
                items: { type: 'string' },
                ecran: { montrerSi: { champ: 'sorte', vaut: ['liste'] } },
            },
        },
    };
    it('cache ce qui ne mènerait nulle part', () => {
        poser(conditionnel, { sorte: 'liste', lignes: [] });
        expect(hote.textContent).toContain('Lignes');
        expect(hote.textContent).not.toContain('Texte');
    });
    it('et le montre dès que le voisin change', () => {
        poser(conditionnel, { sorte: 'texte', texte: '' });
        expect(hote.textContent).toContain('Texte');
        expect(hote.textContent).not.toContain('Lignes');
    });
    it('montre tout quand la règle ne peut pas se lire', () => {
        // Mieux vaut un champ de trop qu'un champ dont on ne soupçonne pas
        // l'existence : celui-là, on ne le cherche jamais.
        poser(conditionnel, null);
        expect(hote.textContent).toContain('Texte');
        expect(hote.textContent).toContain('Lignes');
    });
});
describe('les aides, qui ne se répètent pas', () => {
    it('se disent une fois par liste et non une fois par ligne', () => {
        // Huit lignes de trois champs faisaient vingt-quatre aides identiques :
        // le formulaire d'une page tenait sur cinq mille pixels de haut.
        const avecAide = {
            type: 'array',
            title: 'Lignes',
            items: {
                type: 'object',
                properties: { nom: { type: 'string', title: 'Nom', description: 'Ex. « Ciment ».' } },
            },
        };
        poser(avecAide, [{ nom: 'a' }, { nom: 'b' }, { nom: 'c' }]);
        expect(hote.querySelectorAll('.champ-aide')).toHaveLength(1);
    });
});
