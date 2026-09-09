import { describe, expect, it } from 'vitest'
import {
  ALPHABET_LIEN, LONGUEUR_LIEN, NON_PUBLIABLES, SQUELETTES, accepteLaVersion,
  lienPublic, lienValide, pourquoiNonPubliable, publiable,
} from '../src/index.js'

describe('le lien public', () => {
  it('n’emploie aucun caractère qui se confonde avec un autre', () => {
    // Un lien se lit à voix haute au téléphone, se recopie à la main, et
    // s'écrit sur un cahier. `I` et `1`, `O` et `0` ne se distinguent pas.
    for (const interdit of ['I', '1', 'O', '0', 'U']) {
      expect(ALPHABET_LIEN).not.toContain(interdit)
    }
    expect(ALPHABET_LIEN.length).toBe(31)
    expect(new Set(ALPHABET_LIEN).size).toBe(ALPHABET_LIEN.length)
  })

  it('fait douze caractères, et non quatre', () => {
    // Quatre caractères, c'est un million de combinaisons : une liste
    // énumérable en une soirée, sur des documents qui portent des noms de
    // clients et des montants.
    expect(LONGUEUR_LIEN).toBe(12)
    const combinaisons = Math.pow(ALPHABET_LIEN.length, LONGUEUR_LIEN)
    expect(combinaisons).toBeGreaterThan(1e17)
  })

  it('accepte un lien bien formé et refuse tout le reste', () => {
    expect(lienValide('K7M2XQ4BN9PZ')).toBe(true)
    expect(lienValide('K7M2XQ4BN9P')).toBe(false)
    expect(lienValide('K7M2XQ4BN9PZZ')).toBe(false)
    expect(lienValide('k7m2xq4bn9pz')).toBe(false)
    expect(lienValide('K7M2XQ4BN9P0')).toBe(false)
    expect(lienValide('K7M2XQ4BN9PI')).toBe(false)
    expect(lienValide('')).toBe(false)
    // Rien qui puisse servir à sortir du chemin.
    expect(lienValide('../../../etc')).toBe(false)
  })

  it('s’écrit sans schéma, pour tenir sur une ligne de carte', () => {
    expect(lienPublic('atelier237.pages.dev', 'K7M2XQ4BN9PZ'))
      .toBe('atelier237.pages.dev/d/K7M2XQ4BN9PZ')
  })
})

describe('ce qui ne se publie pas', () => {
  it('refuse l’ardoise et le call-box, et dit pourquoi', () => {
    expect(publiable('ardoise')).toBe(false)
    expect(publiable('callbox')).toBe(false)
    expect(pourquoiNonPubliable('ardoise')).toContain('noms et des dettes')
    expect(pourquoiNonPubliable('callbox')).toContain('recette du jour')
  })

  it('publie tout le reste du catalogue', () => {
    // La règle est une exception, pas un réglage : tout se publie sauf deux
    // cahiers, et chacun pour une raison écrite.
    for (const s of SQUELETTES) {
      if (NON_PUBLIABLES.includes(s.id)) continue
      expect(publiable(s.id)).toBe(true)
      expect(pourquoiNonPubliable(s.id)).toBeNull()
    }
  })

  it('les deux exclus existent bel et bien au catalogue', () => {
    // Sans ça, une faute de frappe dans la liste ouvrirait la publication
    // sans que rien n'échoue.
    const ids = SQUELETTES.map((s) => s.id)
    for (const exclu of NON_PUBLIABLES) expect(ids).toContain(exclu)
  })
})

describe('le contrôle de version', () => {
  it('accepte une version strictement supérieure', () => {
    expect(accepteLaVersion(2, 1)).toBe(true)
    expect(accepteLaVersion(1, null)).toBe(true)
  })

  it('refuse un rejeu de la file hors ligne', () => {
    // Republier la même version n'est pas une nouveauté : c'est la file
    // d'attente qui rejoue une requête déjà passée.
    expect(accepteLaVersion(1, 1)).toBe(false)
  })

  it('refuse qu’un vieux téléphone écrase une publication plus récente', () => {
    expect(accepteLaVersion(3, 7)).toBe(false)
  })

  it('refuse ce qui n’est pas une version', () => {
    expect(accepteLaVersion(0, null)).toBe(false)
    expect(accepteLaVersion(-1, null)).toBe(false)
    expect(accepteLaVersion(1.5, null)).toBe(false)
    expect(accepteLaVersion(Number.NaN, null)).toBe(false)
    expect(accepteLaVersion(Number.POSITIVE_INFINITY, null)).toBe(false)
  })
})
