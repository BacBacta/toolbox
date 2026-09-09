import { AA_INTERFACE, AA_TEXTE, contrasteArrondi } from '@a237/outils-test'
import { describe, expect, it } from 'vitest'
import {
  BORDURES_A_VERIFIER, CLAIR, COULEURS_CARTE, COUPLES_A_VERIFIER, SOMBRE,
} from '../src/jetons.js'
import type { Palette } from '../src/jetons.js'

/**
 * « Lisible » est une mesure, pas une impression.
 *
 * La cible est un Android d'entrée de gamme tenu en plein soleil par quelqu'un
 * qui compte de l'argent. Un gris qui passe sur un écran de bureau calibré peut
 * y disparaître. Ces tests ont dicté la palette, et non l'inverse.
 */

const THEMES: readonly (readonly [string, Palette])[] = [
  ['clair', CLAIR],
  ['sombre', SOMBRE],
]

describe.each(THEMES)('le thème %s', (_nom, palette) => {
  it.each(COUPLES_A_VERIFIER.map((c) => [c[0], c[1]] as const))(
    '« %s » sur « %s » se lit — 4,5:1 au minimum',
    (texte, fond) => {
      expect(contrasteArrondi(palette[texte], palette[fond])).toBeGreaterThanOrEqual(AA_TEXTE)
    },
  )

  it.each(BORDURES_A_VERIFIER.map((c) => [c[0], c[1]] as const))(
    '« %s » sur « %s » se distingue — 3:1 pour une bordure qui informe',
    (bordure, fond) => {
      expect(contrasteArrondi(palette[bordure], palette[fond])).toBeGreaterThanOrEqual(AA_INTERFACE)
    },
  )

  it('sépare vraiment la surface du fond', () => {
    expect(palette.surface).not.toBe(palette.fond)
  })

  it('n’emploie que des couleurs bien formées', () => {
    for (const [clef, valeur] of Object.entries(palette)) {
      expect(valeur, clef).toMatch(/^#[0-9A-F]{6}$/)
    }
  })
})

describe('la carte partagée', () => {
  it('reste claire quel que soit le thème du téléphone', () => {
    // Elle circule dans WhatsApp : elle doit être le même document pour tout le
    // monde, sur n'importe quel appareil.
    expect(COULEURS_CARTE.fond).not.toBe(SOMBRE.fond)
    expect(contrasteArrondi(COULEURS_CARTE.encre, COULEURS_CARTE.fond)).toBeGreaterThanOrEqual(AA_TEXTE)
  })

  it('porte la même identité que l’écran qui la produit', () => {
    expect(COULEURS_CARTE.accent).toBe(CLAIR.accent)
    expect(COULEURS_CARTE.accentSombre).toBe(CLAIR.accentSombre)
    expect(COULEURS_CARTE.alerte).toBe(CLAIR.alerte)
  })

  it.each([
    ['encre', 'fond'],
    ['encre2', 'fond'],
    ['encre3', 'fond'],
    ['accent', 'fond'],
    ['alerte', 'fond'],
    ['encre3', 'bandeau'],
    ['accent', 'bandeau'],
  ] as const)('« %s » se lit sur « %s »', (texte, fond) => {
    expect(contrasteArrondi(COULEURS_CARTE[texte], COULEURS_CARTE[fond]))
      .toBeGreaterThanOrEqual(AA_TEXTE)
  })

  it('garde son filigrane discret mais visible', () => {
    // Le filigrane n'est pas du texte à lire : 3:1 suffit, mais pas moins.
    expect(contrasteArrondi(COULEURS_CARTE.filigrane, COULEURS_CARTE.bandeau))
      .toBeGreaterThanOrEqual(AA_INTERFACE)
  })
})
