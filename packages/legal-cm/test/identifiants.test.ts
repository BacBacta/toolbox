import { describe, expect, it } from 'vitest'
import { estNiuBienForme, estRccmBienForme, normaliserIdentifiant } from '../src/identifiants.js'

describe('NIU', () => {
  it('accepte les exemplaires du prototype', () => {
    expect(estNiuBienForme('M022114873829Y')).toBe(true)
    expect(estNiuBienForme('M019887641203K')).toBe(true)
  })

  it('tolère la saisie humaine : minuscules et espaces', () => {
    expect(estNiuBienForme(' m022114873829y ')).toBe(true)
    expect(estNiuBienForme('M0221 1487 3829 Y')).toBe(true)
  })

  it('refuse les formes hors gabarit', () => {
    expect(estNiuBienForme('')).toBe(false)
    expect(estNiuBienForme('M02211487382')).toBe(false)
    expect(estNiuBienForme('M0221148738299Y')).toBe(false)
    expect(estNiuBienForme('0022114873829Y')).toBe(false)
    expect(estNiuBienForme('M02211487382 9')).toBe(false)
  })
})

describe('RCCM', () => {
  it('accepte l’exemplaire du prototype', () => {
    expect(estRccmBienForme('RC/DLA/2022/A/1487')).toBe(true)
  })

  it('refuse les formes hors gabarit', () => {
    expect(estRccmBienForme('DLA/2022/A/1487')).toBe(false)
    expect(estRccmBienForme('RC/DLA/22/A/1487')).toBe(false)
    expect(estRccmBienForme('RC/DLA/2022//1487')).toBe(false)
  })
})

describe('normaliserIdentifiant', () => {
  it('met en majuscules et retire les espaces', () => {
    expect(normaliserIdentifiant(' rc/dla/2022/a/1487 ')).toBe('RC/DLA/2022/A/1487')
  })
})
