import { describe, expect, it } from 'vitest'
import { prochainNumero } from '../src/compute/numerotation.js'

const LE_9_SEPT = new Date('2026-09-09T07:45:00Z')

describe('prochainNumero', () => {
  it('démarre à 1 quand rien n’a été émis cette année', () => {
    expect(prochainNumero('FA', [], LE_9_SEPT)).toBe('FA-2026-0001')
  })

  it('reprend après le plus grand numéro de la série', () => {
    expect(prochainNumero('FA', ['FA-2026-0001', 'FA-2026-0002'], LE_9_SEPT)).toBe('FA-2026-0003')
  })

  it('ne se laisse pas désordonner par l’ordre de la liste', () => {
    expect(prochainNumero('FA', ['FA-2026-0007', 'FA-2026-0002'], LE_9_SEPT)).toBe('FA-2026-0008')
  })

  it('ne rebouche pas un trou : la chronologie prime sur la densité', () => {
    expect(prochainNumero('FA', ['FA-2026-0001', 'FA-2026-0004'], LE_9_SEPT)).toBe('FA-2026-0005')
  })

  it('tient un compteur par série', () => {
    const emis = ['DV-2026-0118', 'FA-2026-0003']
    expect(prochainNumero('FA', emis, LE_9_SEPT)).toBe('FA-2026-0004')
    expect(prochainNumero('DV', emis, LE_9_SEPT)).toBe('DV-2026-0119')
  })

  it('repart à 1 à l’année civile suivante, sans oublier l’ancienne', () => {
    const emis = ['FA-2026-0042']
    expect(prochainNumero('FA', emis, new Date('2027-03-01T09:00:00Z'))).toBe('FA-2027-0001')
  })

  it('bascule d’année au réveillon, heure de Douala', () => {
    // 31 décembre 23 h 30 UTC = 1ᵉʳ janvier 00 h 30 à Douala.
    expect(prochainNumero('FA', ['FA-2026-0042'], new Date('2026-12-31T23:30:00Z')))
      .toBe('FA-2027-0001')
  })

  it('ignore ce qu’il ne sait pas lire', () => {
    expect(prochainNumero('FA', ['brouillon', '', 'FA/2026/1'], LE_9_SEPT)).toBe('FA-2026-0001')
  })
})
