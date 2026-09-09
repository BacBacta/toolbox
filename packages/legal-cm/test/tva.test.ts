import { describe, expect, it } from 'vitest'
import { TAUX_TVA_CM, TAUX_TVA_CM_POUR_10000, tvaSur } from '../src/tva.js'

describe('le taux', () => {
  it('est de 19,25 %, exprimé en entier pour dix-millièmes', () => {
    expect(TAUX_TVA_CM_POUR_10000).toBe(1925)
    expect(TAUX_TVA_CM).toBeCloseTo(0.1925, 10)
  })
})

describe('tvaSur — arrondi au franc', () => {
  it.each([
    [0, 0],
    [1, 0],
    [3, 1],
    [100, 19],
    [1_000, 193],
    [10_000, 1_925],
    [300_000, 57_750],
    [1_000_000_000, 192_500_000],
  ])('tvaSur(%i) = %i', (ht, attendu) => {
    expect(tvaSur(ht)).toBe(attendu)
  })

  it('arrondit la demie vers le haut, jamais vers un montant plus faible que dû', () => {
    // 1 000 × 19,25 % = 192,5 exactement
    expect(tvaSur(1_000)).toBe(193)
  })

  it('rend toujours un entier : le XAF n’a pas de subdivision', () => {
    for (const ht of [7, 13, 99, 12_345, 987_654]) {
      expect(Number.isInteger(tvaSur(ht))).toBe(true)
    }
  })

  it('ne dérive pas sur les grands montants', () => {
    // Calculé en entiers : 987 654 321 × 1925 / 10000
    expect(tvaSur(987_654_321)).toBe(Math.round((987_654_321 * 1925) / 10_000))
  })

  it('refuse un montant négatif — l’avoir n’est pas au périmètre v1', () => {
    expect(() => tvaSur(-1)).toThrow()
  })

  it('refuse un montant non entier — les lignes sont arrondies avant', () => {
    expect(() => tvaSur(100.5)).toThrow()
  })

  it('refuse NaN et l’infini', () => {
    expect(() => tvaSur(Number.NaN)).toThrow()
    expect(() => tvaSur(Number.POSITIVE_INFINITY)).toThrow()
  })
})
