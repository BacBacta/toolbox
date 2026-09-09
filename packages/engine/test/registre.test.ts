import { describe, expect, it } from 'vitest'
import { verifierRegistre } from '../src/registre.js'

/**
 * Ce fichier est la frontière du § 2.1 : rien de ce que le modèle a dit
 * n'atteint l'écran sans passer par `verifierRegistre`. Les cas sont donc des
 * sorties de modèle plausibles — pas des objets absurdes, mais des
 * configurations presque bonnes, qui sont celles qui font mal.
 */

/*
 * `total` s'omet, il ne se met pas à `undefined` : le schéma refuse une clef
 * présente dont la valeur ne tient pas, et le contrôle s'arrêterait là — on
 * testerait alors le schéma au lieu des accords qu'il ne voit pas.
 */
const { total: TOTAL, ...SANS_TOTAL } = {
  titre: 'Suivi des livraisons',
  kicker: 'SUIVI DES LIVRAISONS',
  titreNom: 'Nom du dépôt',
  colonnes: [
    { clef: 'client', titre: 'Client', type: 'texte' },
    { clef: 'montant', titre: 'Montant (F CFA)', type: 'montant' },
    { clef: 'livre', titre: 'Livré', type: 'bascule' },
  ],
  libelleVide: 'Aucune livraison pour l’instant.',
  libelleAjout: 'Ajouter une livraison',
  relancesVides: 'Un suivi de livraisons se consulte, il ne se relance pas.',
  total: { type: 'somme', clef: 'montant', libelle: 'Total', unite: 'F' },
}

const BON = { ...SANS_TOTAL, total: TOTAL }

describe('ce qui passe', () => {
  it('accepte une configuration complète et cohérente', () => {
    expect(verifierRegistre(BON)).toEqual([])
  })

  it('accepte un registre sans total : tout ne se totalise pas', () => {
    expect(verifierRegistre(SANS_TOTAL)).toEqual([])
  })
})

describe('ce que le schéma seul laisserait passer', () => {
  it('refuse un total qui désigne une colonne absente', () => {
    // Le cas qui fait le plus de dégâts : la configuration valide, le registre
    // affiche un zéro, et personne ne sait pourquoi.
    const e = verifierRegistre({ ...BON, total: { type: 'somme', clef: 'prix', libelle: 'Total', unite: 'F' } })
    expect(e).toHaveLength(1)
    expect(e[0]?.message).toContain('ne désigne aucune colonne')
    // Le message repart au modèle : il doit lui dire quoi corriger.
    expect(e[0]?.message).toContain('client, montant, livre')
  })

  it('refuse une somme sans colonne à sommer', () => {
    const e = verifierRegistre({ ...BON, total: { type: 'somme', libelle: 'Total', unite: 'F' } })
    expect(e.some((x) => x.message.includes('exige clef'))).toBe(true)
  })

  it('refuse deux interrupteurs sur la même ligne', () => {
    const e = verifierRegistre({
      ...SANS_TOTAL,
      colonnes: [...BON.colonnes, { clef: 'paye', titre: 'Payé', type: 'bascule' }],
    })
    expect(e.some((x) => x.message.includes('une seule colonne de type bascule'))).toBe(true)
  })

  it('refuse une première colonne qui ne nomme pas la ligne', () => {
    const e = verifierRegistre({
      ...SANS_TOTAL,
      colonnes: [{ clef: 'montant', titre: 'Montant', type: 'montant' }],
    })
    expect(e.some((x) => x.chemin === '$.colonnes[0].type')).toBe(true)
  })

  it('refuse une clef qui n’en est pas une', () => {
    const e = verifierRegistre({
      ...SANS_TOTAL,
      colonnes: [{ clef: 'Nom du client', titre: 'Client', type: 'texte' }],
    })
    expect(e.some((x) => x.message.includes('n’est pas un identifiant'))).toBe(true)
  })

  it('refuse deux colonnes qui portent la même clef', () => {
    const e = verifierRegistre({
      ...SANS_TOTAL,
      colonnes: [
        { clef: 'client', titre: 'Client', type: 'texte' },
        { clef: 'client', titre: 'Autre', type: 'texte' },
      ],
    })
    expect(e.some((x) => x.message.includes('apparaît deux fois'))).toBe(true)
  })
})

describe('ce que le schéma refuse déjà', () => {
  it.each([
    ['du HTML au lieu d’une configuration', '<div>bonjour</div>'],
    ['un tableau', []],
    ['rien', null],
    ['un objet vide', {}],
  ])('refuse %s', (_quoi, valeur) => {
    expect(verifierRegistre(valeur).length).toBeGreaterThan(0)
  })

  it('refuse un type de colonne inventé', () => {
    const e = verifierRegistre({
      ...SANS_TOTAL,
      colonnes: [{ clef: 'quand', titre: 'Date', type: 'date' }],
    })
    expect(e.length).toBeGreaterThan(0)
  })

  it('refuse un registre à rallonge', () => {
    const trop = Array.from({ length: 9 }, (_, i) => ({
      clef: `c${i}`, titre: `C${i}`, type: 'texte' as const,
    }))
    expect(verifierRegistre({ ...BON, colonnes: trop, total: undefined }).length).toBeGreaterThan(0)
  })
})
