import { describe, expect, it } from 'vitest'
import type { Expression } from '../src/expression.js'
import { evaluer, verifierExpression } from '../src/expression.js'

/**
 * L'interprète exécute ce que le modèle a décrit. C'est le seul endroit du
 * moteur où une sortie de modèle devient un calcul, donc le seul qui puisse
 * transformer une mauvaise réponse en mauvais chiffre sur l'écran de quelqu'un
 * qui compte sa journée.
 */

const VALEURS: Record<string, number> = { total: 50_000, verse: 20_000, quantite: 3 }
const lire = (c: string): number => VALEURS[c] ?? 0
const CLEFS = Object.keys(VALEURS)

describe('ce qu’un commerçant calcule', () => {
  it.each([
    ['le reste à payer', { op: 'moins', gauche: { ref: 'total' }, droite: { ref: 'verse' } }, 30_000],
    ['un total', { op: 'fois', gauche: { ref: 'quantite' }, droite: { nombre: 1_500 } }, 4_500],
    ['la TVA camerounaise', { op: 'pourcent', gauche: { ref: 'total' }, droite: { nombre: 19.25 } }, 9_625],
    ['une part', { op: 'divise', gauche: { ref: 'total' }, droite: { ref: 'quantite' } }, 50_000 / 3],
    ['un plancher', { op: 'max', gauche: { op: 'moins', gauche: { ref: 'verse' }, droite: { ref: 'total' } }, droite: { nombre: 0 } }, 0],
  ] as const)('%s', (_quoi, e, attendu) => {
    expect(evaluer(e as Expression, lire)).toBeCloseTo(attendu, 4)
  })
})

describe('jamais de NaN devant quelqu’un qui compte', () => {
  it('rend zéro sur une division par zéro', () => {
    // Faux, mais lisible. « NaN » ferait douter de tout le reste de l'écran.
    expect(evaluer({ op: 'divise', gauche: { ref: 'total' }, droite: { nombre: 0 } }, lire)).toBe(0)
  })

  it('rend zéro pour une référence inconnue plutôt que de casser', () => {
    expect(evaluer({ ref: 'inexistante' }, lire)).toBe(0)
  })

  it('borne la profondeur même si la validation a été contournée', () => {
    // Un état enregistré par une version plus laxiste ne doit pas faire
    // exploser la pile sur le téléphone de quelqu'un.
    let e: Expression = { nombre: 1 }
    for (let i = 0; i < 200; i++) e = { op: 'plus', gauche: e, droite: { nombre: 1 } }
    expect(Number.isFinite(evaluer(e, lire))).toBe(true)
  })
})

describe('ce que la validation refuse', () => {
  it('accepte une formule bien formée', () => {
    expect(verifierExpression({ op: 'moins', gauche: { ref: 'total' }, droite: { ref: 'verse' } }, CLEFS))
      .toEqual([])
  })

  it('refuse une référence à une entrée qui n’existe pas, en nommant celles qui existent', () => {
    const e = verifierExpression({ ref: 'benefice' }, CLEFS)
    expect(e[0]?.message).toContain('ne désigne aucune entrée')
    expect(e[0]?.message).toContain('total, verse, quantite')
  })

  it('refuse un nœud qui est deux choses à la fois', () => {
    const e = verifierExpression({ nombre: 3, ref: 'total' }, CLEFS)
    expect(e[0]?.message).toContain('une seule de ces trois formes')
  })

  it('refuse un nœud vide', () => {
    expect(verifierExpression({}, CLEFS).length).toBeGreaterThan(0)
  })

  it('refuse une opération à qui il manque un côté', () => {
    const e = verifierExpression({ op: 'plus', gauche: { nombre: 1 } }, CLEFS)
    expect(e.some((x) => x.message.includes('exige droite'))).toBe(true)
  })

  it.each([
    ['une opération inventée', { op: 'racine', gauche: { nombre: 4 }, droite: { nombre: 2 } }],
    ['du code', "() => process.exit(1)"],
    ['un appel', { op: 'fois', gauche: { ref: 'total' }, droite: { fn: 'fetch' } }],
    ['rien', null],
  ])('refuse %s', (_quoi, valeur) => {
    expect(verifierExpression(valeur, CLEFS).length).toBeGreaterThan(0)
  })

  it('refuse une formule trop profonde', () => {
    let e: unknown = { nombre: 1 }
    for (let i = 0; i < 10; i++) e = { op: 'plus', gauche: e, droite: { nombre: 1 } }
    expect(verifierExpression(e, CLEFS).length).toBeGreaterThan(0)
  })
})
