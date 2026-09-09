import { describe, expect, it } from 'vitest'
import { calculerLignes, montantAcompte } from '../src/compute/tva.js'
import type { Ligne } from '../src/types.js'

const LIGNES: readonly Ligne[] = [
  { designation: 'Fourniture de tôles bac 30/100', quantite: 24, prixUnitaire: 12_500 },
  { designation: 'Pointes et accessoires de pose', quantite: 1, prixUnitaire: 38_000 },
  { designation: 'Livraison sur chantier Akwa', quantite: 1, prixUnitaire: 15_000 },
]

describe('calculerLignes — le devis du prototype', () => {
  const t = calculerLignes(LIGNES)

  it('calcule chaque ligne', () => {
    expect(t.lignes.map((l) => l.montantHT)).toEqual([300_000, 38_000, 15_000])
    expect(t.lignes.map((l) => l.tva)).toEqual([57_750, 7_315, 2_888])
    expect(t.lignes.map((l) => l.montantTTC)).toEqual([357_750, 45_315, 17_888])
  })

  it('totalise à partir des lignes arrondies', () => {
    expect(t.totalHT).toBe(353_000)
    expect(t.totalTVA).toBe(67_953)
    expect(t.totalTTC).toBe(420_953)
  })

  it('tombe juste sous le stylo d’un contrôleur', () => {
    expect(t.lignes.reduce((a, l) => a + l.montantHT, 0)).toBe(t.totalHT)
    expect(t.lignes.reduce((a, l) => a + l.tva, 0)).toBe(t.totalTVA)
    expect(t.totalHT + t.totalTVA).toBe(t.totalTTC)
  })
})

describe('la règle d’arrondi est un choix, et il est testé', () => {
  it('arrondit à la ligne puis somme, et non l’inverse', () => {
    // Deux lignes à 100 F : 19,25 F de TVA chacune.
    // Par ligne  : 19 + 19 = 38.  Globalement : arrondi(38,5) = 39.
    // On imprime 38, parce que c’est ce que le lecteur recalcule ligne à ligne.
    const t = calculerLignes([
      { designation: 'a', quantite: 1, prixUnitaire: 100 },
      { designation: 'b', quantite: 1, prixUnitaire: 100 },
    ])
    expect(t.totalTVA).toBe(38)
    expect(t.totalTVA).not.toBe(Math.round(200 * 0.1925))
  })
})

describe('calculerLignes — cas limites', () => {
  it('accepte un devis vide', () => {
    const t = calculerLignes([])
    expect(t).toMatchObject({ totalHT: 0, totalTVA: 0, totalTTC: 0 })
    expect(t.lignes).toHaveLength(0)
  })

  it('accepte une ligne à quantité nulle', () => {
    const t = calculerLignes([{ designation: 'offert', quantite: 0, prixUnitaire: 9_000 }])
    expect(t.totalHT).toBe(0)
    expect(t.totalTVA).toBe(0)
  })

  it('accepte une ligne à prix nul', () => {
    const t = calculerLignes([{ designation: 'geste commercial', quantite: 3, prixUnitaire: 0 }])
    expect(t.totalTTC).toBe(0)
  })

  it('arrondit une quantité fractionnaire au franc, une seule fois', () => {
    // 2,5 sacs à 1 001 F = 2 502,5 → 2 503 F, puis la TVA sur ce montant.
    const t = calculerLignes([{ designation: 'ciment au kg', quantite: 2.5, prixUnitaire: 1_001 }])
    expect(t.totalHT).toBe(2_503)
    expect(t.totalTVA).toBe(482)
  })

  it('refuse une quantité négative', () => {
    expect(() => calculerLignes([{ designation: 'x', quantite: -1, prixUnitaire: 100 }])).toThrow()
  })

  it('refuse un prix unitaire négatif', () => {
    expect(() => calculerLignes([{ designation: 'x', quantite: 1, prixUnitaire: -100 }])).toThrow()
  })
})

describe('montantAcompte', () => {
  it('calcule le pourcentage demandé sur le TTC', () => {
    expect(montantAcompte(420_953, 50)).toBe(210_477)
    expect(montantAcompte(420_953, 0)).toBe(0)
    expect(montantAcompte(420_953, 100)).toBe(420_953)
  })

  it('refuse un pourcentage hors de 0–100', () => {
    expect(() => montantAcompte(1_000, -1)).toThrow()
    expect(() => montantAcompte(1_000, 101)).toThrow()
  })
})
