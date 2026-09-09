import { describe, expect, it } from 'vitest'
import { composantes, contraste, contrasteArrondi, luminance } from '../src/contraste.js'

describe('composantes', () => {
  it('lit la forme longue et la forme courte', () => {
    expect(composantes('#1B5E43')).toEqual([27, 94, 67])
    expect(composantes('1b5e43')).toEqual([27, 94, 67])
    expect(composantes('#fff')).toEqual([255, 255, 255])
  })

  it('refuse ce qui n’est pas une couleur', () => {
    expect(() => composantes('vert')).toThrow(RangeError)
    expect(() => composantes('#12345')).toThrow(RangeError)
    expect(() => composantes('')).toThrow(RangeError)
  })
})

describe('luminance', () => {
  it('place le noir à 0 et le blanc à 1', () => {
    expect(luminance('#000000')).toBe(0)
    expect(luminance('#FFFFFF')).toBeCloseTo(1, 10)
  })
})

describe('contraste', () => {
  it('donne 21 entre le noir et le blanc', () => {
    expect(contrasteArrondi('#000000', '#FFFFFF')).toBe(21)
  })

  it('donne 1 entre une couleur et elle-même', () => {
    expect(contraste('#1B5E43', '#1B5E43')).toBe(1)
  })

  it('ne dépend pas de l’ordre des arguments', () => {
    expect(contraste('#1B5E43', '#FBFCF8')).toBe(contraste('#FBFCF8', '#1B5E43'))
  })

  it('retrouve une valeur connue', () => {
    // Gris moyen sur blanc : valeur de référence des tables WCAG.
    expect(contrasteArrondi('#767676', '#FFFFFF')).toBe(4.5)
  })
})
