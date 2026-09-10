import { describe, expect, it } from 'vitest'
import {
  anneeDe, arreteLe, coutF, dateCourte, dateLongue, ESPACE_INSECABLE, heureCourte,
  initiales, montantF, nf, normaliser,
} from '../src/format.js'

const E = ESPACE_INSECABLE

describe('nf', () => {
  it.each([
    [0, '0'],
    [7, '7'],
    [999, '999'],
    [1_000, `1${E}000`],
    [12_500, `12${E}500`],
    [353_000, `353${E}000`],
    [1_000_000, `1${E}000${E}000`],
    [-1_500, `-1${E}500`],
  ])('nf(%i) = %s', (n, attendu) => {
    expect(nf(n)).toBe(attendu)
  })

  it('arrondit au franc', () => {
    expect(nf(1_499.6)).toBe(`1${E}500`)
  })

  it('refuse NaN et l’infini', () => {
    expect(() => nf(Number.NaN)).toThrow()
    expect(() => nf(Number.POSITIVE_INFINITY)).toThrow()
  })
})

describe('montantF', () => {
  it('colle le F au montant par une espace insécable', () => {
    expect(montantF(353_000)).toBe(`353${E}000${E}F`)
  })
})

describe('les dates sont dans le fuseau de Douala, pas dans celui de la machine', () => {
  // 9 septembre 2026, 23 h 30 UTC = 10 septembre, 00 h 30 à Douala (UTC+1).
  const nuit = new Date('2026-09-09T23:30:00Z')

  it('bascule au lendemain à Douala', () => {
    expect(dateCourte(nuit)).toBe('10/09/2026')
    expect(dateLongue(nuit)).toBe('10 septembre 2026')
    expect(heureCourte(nuit)).toBe('00h30')
  })

  it('donne la bonne année civile au passage du nouvel an', () => {
    expect(anneeDe(new Date('2025-12-31T23:30:00Z'))).toBe(2026)
    expect(anneeDe(new Date('2026-12-31T22:30:00Z'))).toBe(2026)
  })

  it('met en forme les douze mois', () => {
    expect(dateLongue(new Date('2026-01-15T09:00:00Z'))).toBe('15 janvier 2026')
    expect(dateLongue(new Date('2026-08-01T09:00:00Z'))).toBe('1 août 2026')
    expect(dateLongue(new Date('2026-12-25T09:00:00Z'))).toBe('25 décembre 2026')
  })

  it('horodate le pied de carte', () => {
    expect(arreteLe(new Date('2026-09-09T07:45:00Z'))).toBe('Arrêté le 9 septembre 2026 à 08h45')
  })

  it('refuse une date invalide', () => {
    expect(() => dateCourte(new Date('n’importe quoi'))).toThrow()
  })
})

describe('initiales', () => {
  it.each([
    ['Njangi Nkolbisson', 'NN'],
    ['Quincaillerie Bépanda', 'QB'],
    ['  Serge   Mbarga  ', 'SM'],
    ['Callbox', 'C'],
  ])('initiales(%s) = %s', (s, attendu) => {
    expect(initiales(s)).toBe(attendu)
  })
})

describe('normaliser', () => {
  it.each([
    ['Njangi', 'njangi'],
    ['Reçu', 'recu'],
    ['PRÉSENCE', 'presence'],
    ['call-box', 'call box'],
    ['il me faut un devis !', 'il me faut un devis'],
    ['  Écran   cassé  ', 'ecran casse'],
  ])('normaliser(%s) = %s', (s, attendu) => {
    expect(normaliser(s)).toBe(attendu)
  })
})

describe('ce qu’une génération a coûté', () => {
  /*
   * `montantF` arrondit au franc — juste pour un prix, faux pour une dépense
   * de dix-neuf centimes, qui s'affichait « 0 F ». Toutes les compositions se
   * sont annoncées gratuites depuis qu'elles existent, alors que cette ligne
   * est là pour qu'une dépense ne se découvre pas à la fin du mois.
   */
  it('montre les centimes, que le franc arrondissait à zéro', () => {
    expect(coutF(0.19)).toBe(`0,19${ESPACE_INSECABLE}F`)
    expect(montantF(0.19)).toBe(`0${ESPACE_INSECABLE}F`)
  })

  it('garde deux décimales même quand la seconde est nulle', () => {
    // « 0,2 F » se lit comme un chiffre tronqué ; « 0,20 F » comme un prix.
    expect(coutF(0.2)).toBe(`0,20${ESPACE_INSECABLE}F`)
    expect(coutF(1)).toBe(`1,00${ESPACE_INSECABLE}F`)
  })

  it('groupe les milliers comme partout ailleurs', () => {
    expect(coutF(1234.5)).toBe(`1${ESPACE_INSECABLE}234,50${ESPACE_INSECABLE}F`)
  })

  it('arrondit au centime plutôt que d’étaler un flottant', () => {
    expect(coutF(0.005)).toBe(`0,01${ESPACE_INSECABLE}F`)
    expect(coutF(0.344)).toBe(`0,34${ESPACE_INSECABLE}F`)
  })

  it('refuse un nombre qui n’en est pas un', () => {
    expect(() => coutF(Number.NaN)).toThrow(RangeError)
  })
})
