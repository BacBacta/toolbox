import { describe, expect, it } from 'vitest'
import { formatNumero, numeroSuivant, parseNumero, trouverAnomalies } from '../src/numerotation.js'

describe('formatNumero', () => {
  it('reprend la forme du prototype', () => {
    expect(formatNumero({ prefixe: 'DV', annee: 2026, sequence: 118 })).toBe('DV-2026-0118')
  })

  it('complète la séquence à quatre chiffres, sans la tronquer au-delà', () => {
    expect(formatNumero({ prefixe: 'FA', annee: 2026, sequence: 1 })).toBe('FA-2026-0001')
    expect(formatNumero({ prefixe: 'FA', annee: 2026, sequence: 12_345 })).toBe('FA-2026-12345')
  })

  it('refuse un préfixe, une année ou une séquence hors gabarit', () => {
    expect(() => formatNumero({ prefixe: 'd', annee: 2026, sequence: 1 })).toThrow()
    expect(() => formatNumero({ prefixe: 'DEVIS', annee: 2026, sequence: 1 })).toThrow()
    expect(() => formatNumero({ prefixe: 'DV', annee: 26, sequence: 1 })).toThrow()
    expect(() => formatNumero({ prefixe: 'DV', annee: 2026, sequence: 0 })).toThrow()
    expect(() => formatNumero({ prefixe: 'DV', annee: 2026, sequence: 1.5 })).toThrow()
  })
})

describe('parseNumero', () => {
  it('fait l’aller-retour', () => {
    expect(parseNumero('DV-2026-0118')).toEqual({ prefixe: 'DV', annee: 2026, sequence: 118 })
    expect(parseNumero(' dv-2026-0118 ')).toEqual({ prefixe: 'DV', annee: 2026, sequence: 118 })
  })

  it('rend null sur ce qui n’est pas un numéro de la maison', () => {
    expect(parseNumero('')).toBeNull()
    expect(parseNumero('DV/2026/118')).toBeNull()
    expect(parseNumero('DV-2026-118')).toBeNull()
    expect(parseNumero('DV-2026-0000')).toBeNull()
  })
})

describe('numeroSuivant — unique, continue et chronologique', () => {
  it('incrémente dans la même année', () => {
    expect(numeroSuivant({ prefixe: 'DV', annee: 2026, sequence: 118 }, 2026, 'DV')).toEqual({
      prefixe: 'DV', annee: 2026, sequence: 119,
    })
  })

  it('repart à 1 au changement d’année civile', () => {
    expect(numeroSuivant({ prefixe: 'DV', annee: 2026, sequence: 118 }, 2027, 'DV')).toEqual({
      prefixe: 'DV', annee: 2027, sequence: 1,
    })
  })

  it('tient un compteur par série : un devis n’avance pas la facture', () => {
    expect(numeroSuivant({ prefixe: 'DV', annee: 2026, sequence: 118 }, 2026, 'FA')).toEqual({
      prefixe: 'FA', annee: 2026, sequence: 1,
    })
  })

  it('démarre à 1 quand il n’y a pas de précédent', () => {
    expect(numeroSuivant(null, 2026, 'DV')).toEqual({ prefixe: 'DV', annee: 2026, sequence: 1 })
  })
})

describe('trouverAnomalies — ce qui casse la continuité', () => {
  it('ne dit rien d’une suite propre', () => {
    expect(trouverAnomalies(['DV-2026-0001', 'DV-2026-0002', 'DV-2026-0003'])).toEqual([])
  })

  it('repère un doublon — deux téléphones hors ligne, même numéro', () => {
    expect(trouverAnomalies(['DV-2026-0001', 'DV-2026-0001'])).toContainEqual({
      type: 'doublon', numero: 'DV-2026-0001',
    })
  })

  it('repère un trou dans la séquence', () => {
    expect(trouverAnomalies(['DV-2026-0001', 'DV-2026-0004'])).toContainEqual({
      type: 'trou', manquants: ['DV-2026-0002', 'DV-2026-0003'],
    })
  })

  it('repère un numéro illisible', () => {
    expect(trouverAnomalies(['DV-2026-0001', 'à refaire'])).toContainEqual({
      type: 'illisible', numero: 'à refaire',
    })
  })

  it('ne confond pas deux séries ni deux années', () => {
    expect(trouverAnomalies(['DV-2026-0001', 'FA-2026-0001', 'DV-2027-0001'])).toEqual([])
  })

  it('accepte une suite désordonnée si elle est complète', () => {
    expect(trouverAnomalies(['DV-2026-0003', 'DV-2026-0001', 'DV-2026-0002'])).toEqual([])
  })

  it('ne dit rien d’une liste vide', () => {
    expect(trouverAnomalies([])).toEqual([])
  })
})
