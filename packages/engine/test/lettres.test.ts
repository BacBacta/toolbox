import { describe, expect, it } from 'vitest'
import { lettres, montantEnLettres } from '../src/lettres.js'

describe('lettres — les cas exigés par le brief', () => {
  it.each([
    [0, 'zéro'],
    [71, 'soixante-et-onze'],
    [80, 'quatre-vingts'],
    [81, 'quatre-vingt-un'],
    [91, 'quatre-vingt-onze'],
    [100, 'cent'],
    [1_000_000, 'un million'],
    [2_100_000, 'deux millions cent mille'],
  ])('lettres(%i) = %s', (n, attendu) => {
    expect(lettres(n)).toBe(attendu)
  })
})

describe('lettres — les pièges du français', () => {
  it.each([
    [1, 'un'],
    [11, 'onze'],
    [16, 'seize'],
    [17, 'dix-sept'],
    [20, 'vingt'],
    [21, 'vingt-et-un'],
    [31, 'trente-et-un'],
    [60, 'soixante'],
    [61, 'soixante-et-un'],
    [70, 'soixante-dix'],
    [72, 'soixante-douze'],
    [79, 'soixante-dix-neuf'],
    [82, 'quatre-vingt-deux'],
    [90, 'quatre-vingt-dix'],
    [99, 'quatre-vingt-dix-neuf'],
    [101, 'cent un'],
    [180, 'cent quatre-vingts'],
    [200, 'deux cents'],
    [201, 'deux cent un'],
    [999, 'neuf cent quatre-vingt-dix-neuf'],
    [1_000, 'mille'],
    [1_001, 'mille un'],
    [2_000, 'deux mille'],
    [80_000, 'quatre-vingt mille'],
    [100_000, 'cent mille'],
    [200_000, 'deux cent mille'],
    [999_999, 'neuf cent quatre-vingt-dix-neuf mille neuf cent quatre-vingt-dix-neuf'],
    [1_000_001, 'un million un'],
    [2_000_000, 'deux millions'],
    [150_000, 'cent cinquante mille'],
  ])('lettres(%i) = %s', (n, attendu) => {
    expect(lettres(n)).toBe(attendu)
  })
})

describe('lettres — au-delà du million (le prototype était faux ici)', () => {
  it.each([
    [1_000_000_000, 'un milliard'],
    [2_000_000_000, 'deux milliards'],
    [1_234_567_890, 'un milliard deux cent trente-quatre millions cinq cent soixante-sept mille huit cent quatre-vingt-dix'],
    [1_000_000_000_000, 'mille milliards'],
  ])('lettres(%i) = %s', (n, attendu) => {
    expect(lettres(n)).toBe(attendu)
  })

  it('refuse au-delà de ce qui est représentable exactement', () => {
    expect(() => lettres(Number.MAX_SAFE_INTEGER + 1)).toThrow()
  })
})

describe('lettres — entrées hostiles', () => {
  it('arrondit au franc : le XAF n’a pas de subdivision', () => {
    expect(lettres(80.4)).toBe('quatre-vingts')
    expect(lettres(80.6)).toBe('quatre-vingt-un')
  })

  it('refuse le négatif, NaN et l’infini', () => {
    expect(() => lettres(-1)).toThrow()
    expect(() => lettres(Number.NaN)).toThrow()
    expect(() => lettres(Number.POSITIVE_INFINITY)).toThrow()
  })
})

describe('montantEnLettres — la formule qui va sur le document', () => {
  it('accorde le franc au singulier et au pluriel', () => {
    expect(montantEnLettres(1)).toBe('un franc CFA')
    expect(montantEnLettres(150_000)).toBe('cent cinquante mille francs CFA')
    expect(montantEnLettres(0)).toBe('zéro franc CFA')
  })
})
