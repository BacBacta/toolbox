import { describe, expect, it } from 'vitest'
import { changerValeur, valeurDe } from '../src/compute/calc.js'
import type { EtatCalc } from '../src/compute/calc.js'
import { ESPACE_INSECABLE } from '../src/format.js'
import { course, scolarite } from '../src/skeletons/calculs.js'
import type { RenderContext } from '../src/types.js'
import { valider } from '../src/valider.js'

const E = ESPACE_INSECABLE
const CTX: RenderContext = { lien: '', maintenant: new Date('2026-09-09T07:45:00Z') }

function etat(nom: string, valeurs: Record<string, number>): EtatCalc {
  return { nom, valeurs }
}

describe('valeurDe — une calculatrice ne rend jamais NaN', () => {
  it('nettoie ce qui n’est pas un nombre positif fini', () => {
    const e = etat('x', { a: 12 })
    expect(valeurDe(e, 'a')).toBe(12)
    expect(valeurDe(e, 'absent')).toBe(0)
    expect(valeurDe(etat('x', { a: Number.NaN }), 'a')).toBe(0)
    expect(valeurDe(etat('x', { a: -5 }), 'a')).toBe(0)
    expect(valeurDe(etat('x', { a: Number.POSITIVE_INFINITY }), 'a')).toBe(0)
  })
})

describe('changerValeur', () => {
  it('remplace sans toucher à l’original', () => {
    const avant = etat('Scolarité', { total: 75_000, verse: 30_000 })
    const apres = changerValeur(avant, 'verse', 45_000)
    expect(apres.valeurs['verse']).toBe(45_000)
    expect(avant.valeurs['verse']).toBe(30_000)
  })

  it('refuse une valeur négative ou non finie', () => {
    const e = etat('x', { a: 1 })
    expect(() => changerValeur(e, 'a', -1)).toThrow(RangeError)
    expect(() => changerValeur(e, 'a', Number.NaN)).toThrow(RangeError)
  })
})

describe('les frais scolaires', () => {
  it('calcule le reste à payer et la part réglée', () => {
    const e = etat('Aïcha', { total: 75_000, verse: 30_000 })
    const carte = scolarite.card(e, CTX)
    expect(carte.bigLabel).toBe('RESTE À PAYER')
    expect(carte.big).toBe(`45${E}000${E}F`)
    expect(carte.subline).toBe('40 % réglé.')
    expect(carte.pct).toBeCloseTo(0.4, 10)
  })

  it('ne rend jamais un reste négatif : au-delà, c’est un trop-versé', () => {
    const carte = scolarite.card(etat('Boris', { total: 50_000, verse: 60_000 }), CTX)
    expect(carte.big).toBe(`0${E}F`)
    expect(carte.subline).toContain('Trop versé de 10000 F CFA')
    expect(carte.pct).toBe(1)
  })

  it('tient sur un total à zéro sans diviser par zéro', () => {
    const carte = scolarite.card(etat('Chantal', { total: 0, verse: 0 }), CTX)
    expect(carte.big).toBe(`0${E}F`)
    expect(carte.pct).toBeNull()
    expect(carte.subline).toBe('Frais scolaires')
  })

  it('démarre sur des valeurs par défaut qui valident', () => {
    expect(scolarite.defaults.valeurs).toEqual({ total: 75_000, verse: 30_000 })
    expect(valider(scolarite.schema, scolarite.defaults)).toEqual([])
  })
})

describe('le partage de course', () => {
  it('arrondit au franc supérieur, comme on le fait vraiment', () => {
    const carte = course.card(etat('Retour du marché', { montant: 3_000, personnes: 4 }), CTX)
    expect(carte.big).toBe(`750${E}F`)
  })

  it('signale ce que l’arrondi ajoute', () => {
    const carte = course.card(etat('Moto', { montant: 1_000, personnes: 3 }), CTX)
    expect(carte.big).toBe(`334${E}F`)
    expect(carte.subline).toContain('2 F de plus que la course')
  })

  it('ne dit rien quand ça tombe juste', () => {
    expect(course.card(etat('Taxi', { montant: 2_000, personnes: 4 }), CTX).subline)
      .toBe('Partage de course')
  })

  it('demande combien vous êtes plutôt que de diviser par zéro', () => {
    const carte = course.card(etat('Taxi', { montant: 3_000, personnes: 0 }), CTX)
    expect(carte.big).toBe(`0${E}F`)
    expect(carte.subline).toBe('Indique combien vous êtes.')
  })

  it('ignore une fraction de personne', () => {
    expect(course.card(etat('Taxi', { montant: 3_000, personnes: 2.7 }), CTX).big)
      .toBe(`1${E}500${E}F`)
  })
})

describe('le partage d’un calcul', () => {
  it('écrit ce qui a été saisi et ce qui en sort', () => {
    const partage = scolarite.share(etat('Aïcha', { total: 75_000, verse: 30_000 }), CTX)
    expect(partage.txt).toContain('AÏCHA — frais scolaires')
    expect(partage.txt).toContain(`Total de l’année : 75${E}000${E}F`)
    expect(partage.txt).toContain(`Reste à payer : 45${E}000${E}F`)
    expect(partage.txt).toContain('40 % réglé.')
    expect(partage.relances).toEqual([])
    expect(partage.relancesVides).toContain('se montre')
  })
})
