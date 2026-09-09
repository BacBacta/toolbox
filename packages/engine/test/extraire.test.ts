import { describe, expect, it } from 'vitest'
import { extraire } from '../src/extraire.js'

/**
 * Les cas sont écrits comme quelqu'un les tape vraiment sur un téléphone à
 * Douala : minuscules, accents oubliés, « F » collé au nombre, espaces dans
 * les milliers. Pas comme on aimerait qu'ils soient tapés.
 */

describe('les sommes', () => {
  it.each([
    ['njangi de 5 000 F par semaine', 5_000],
    ['cotisation 20000 FCFA', 20_000],
    ['un devis de 18.500 francs', 18_500],
    ['facture 250000f', 250_000],
    ['il me faut 2 millions', 2_000_000],
    ['une avance de 5k', 5_000],
    ['vente de 1 500 000 XAF', 1_500_000],
  ])('lit « %s » comme %i F', (phrase, attendu) => {
    expect(extraire(phrase).montants).toEqual([attendu])
  })

  it('garde l’ordre quand il y en a plusieurs', () => {
    expect(extraire('sac de riz 18 500 F et savon 4 800 F').montants).toEqual([18_500, 4_800])
  })

  it('accepte l’espace insécable, que les claviers envoient', () => {
    expect(extraire('cotisation de 20 000 F').montants).toEqual([20_000])
  })
})

describe('ce qui n’est pas une somme', () => {
  it('ne prend pas un nombre de personnes pour de l’argent', () => {
    const e = extraire('njangi avec 8 personnes')
    expect(e.montants).toEqual([])
    expect(e.compte).toBe(8)
  })

  it('ne prend pas un pourcentage pour de l’argent', () => {
    const e = extraire('acompte de 30 %')
    expect(e.montants).toEqual([])
    expect(e.pourcent).toBe(30)
  })

  it('sépare les trois dans la même phrase', () => {
    const e = extraire('njangi de 20 000 F à 8 membres, acompte 50 %')
    expect(e.montants).toEqual([20_000])
    expect(e.compte).toBe(8)
    expect(e.pourcent).toBe(50)
  })

  it('laisse un nombre nu de côté plutôt que d’en faire un montant', () => {
    // « 12 » ne dit pas ce qu'il est. Au squelette d'en juger, pas à nous.
    const e = extraire('je note 12')
    expect(e.montants).toEqual([])
    expect(e.nombres).toEqual([12])
  })

  it('refuse un pourcentage au-dessus de cent', () => {
    expect(extraire('une remise de 150 %').pourcent).toBeNull()
  })
})

describe('la période', () => {
  it.each([
    ['njangi par semaine', 'semaine'],
    ['cotisation hebdomadaire', 'semaine'],
    ['tontine chaque mois', 'mois'],
    ['versement mensuel', 'mois'],
    ['njangi par quinzaine', 'quinzaine'],
    ['on cotise tous les 15 jours', 'quinzaine'],
  ] as const)('lit « %s » comme %s', (phrase, attendu) => {
    expect(extraire(phrase).periode).toBe(attendu)
  })

  it('préfère la quinzaine à la semaine quand les deux mots sont là', () => {
    // « toutes les 2 semaines » contient « semaine » : le plus spécifique gagne.
    expect(extraire('on cotise toutes les 2 semaines').periode).toBe('quinzaine')
  })

  it('ne rend rien quand la phrase ne dit rien', () => {
    expect(extraire('il me faut un devis').periode).toBeNull()
  })
})

describe('les phrases qui ne disent rien', () => {
  it.each(['', '   ', 'bonjour', 'il me faut un outil'])('« %s » ne donne rien', (phrase) => {
    const e = extraire(phrase)
    expect(e.montants).toEqual([])
    expect(e.nombres).toEqual([])
    expect(e.periode).toBeNull()
    expect(e.compte).toBeNull()
    expect(e.pourcent).toBeNull()
  })
})
