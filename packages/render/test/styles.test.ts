import { fichiersSources } from '@a237/outils-test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { COULEURS } from '../src/jetons.js'

/**
 * Les composants, la feuille de style et la palette ne doivent pas diverger.
 *
 * Une classe employée dans le JSX mais absente du CSS ne se voit dans aucun
 * test de rendu — le HTML sort correct, c'est la page qui est cassée. Sur un A4
 * qui part à l'impression, ça se découvre chez l'imprimeur.
 *
 * Même chose pour les couleurs : le canvas les lit dans `jetons.ts`, l'écran
 * dans le CSS. Si les deux listes s'écartent, la carte partagée n'a plus la
 * couleur de l'application qui l'a produite.
 */

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const STYLES = join(SRC, 'styles')

const A4 = readFileSync(join(STYLES, 'a4.css'), 'utf8')
const OUTIL = readFileSync(join(STYLES, 'outil.css'), 'utf8')
const CSS = `${A4}\n${OUTIL}`

const DECLAREES = new Set([...CSS.matchAll(/\.([a-z][a-z0-9-]*)/g)].map((m) => m[1] ?? ''))

/** Les classes employées par le JSX, en `class="…"` comme en `class={…}`. */
function classesEmployees(source: string): string[] {
  return [...source.matchAll(/class=(?:"([^"]*)"|\{([^}]*)\})/g)]
    .flatMap(([, litteral, expression]) => {
      if (litteral !== undefined) return litteral.split(/\s+/)
      const chaines = [...(expression ?? '').matchAll(/['`]([^'`]*)[`']/g)].map((m) => m[1] ?? '')
      return chaines.flatMap((c) => c.split(/\s+/))
    })
    .filter((c) => c !== '' && !c.startsWith('$'))
}

const EMPLOYEES = [
  ...new Set(fichiersSources(SRC).flatMap((f) => classesEmployees(readFileSync(f, 'utf8')))),
].sort()

/** `accentSombre` → `--accent-sombre`, `encre2` → `--encre-2`. */
function variableCss(clef: string): string {
  return `--${clef.replace(/[A-Z]|\d+/g, (bout) => `-${bout.toLowerCase()}`)}`
}

describe('feuille de style et composants', () => {
  it('trouve bien des classes des deux côtés', () => {
    expect(EMPLOYEES.length).toBeGreaterThan(20)
    expect(DECLAREES.size).toBeGreaterThan(20)
  })

  it.each(EMPLOYEES.map((c) => [c]))('« %s » est déclarée dans le CSS', (classe) => {
    expect(DECLAREES.has(classe)).toBe(true)
  })
})

describe('la palette ne diverge pas entre le canvas et l’écran', () => {
  it.each(Object.entries(COULEURS))('%s vaut %s des deux côtés', (clef, valeur) => {
    const motif = new RegExp(`${variableCss(clef)}:\\s*${valeur}\\s*;`, 'i')
    expect(OUTIL).toMatch(motif)
  })

  it('couvre toutes les variables déclarées, sans en oublier', () => {
    const declarees = [...OUTIL.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((m) => m[1] ?? '')
    const connues = Object.keys(COULEURS).map(variableCss)
    expect([...new Set(declarees)].sort()).toEqual([...connues].sort())
  })
})

describe('la feuille A4', () => {
  it('décrit une page en millimètres, pas en pixels d’aperçu', () => {
    expect(A4).toContain('width: 210mm')
    expect(A4).toContain('min-height: 297mm')
    expect(A4).toContain('size: A4')
  })
})

describe('les deux feuilles', () => {
  it('ne chargent aucune police web', () => {
    expect(CSS).not.toContain('@import')
    expect(CSS).not.toContain('@font-face')
    expect(CSS).not.toContain('fonts.googleapis')
  })

  /**
   * Ce qui reçoit le doigt fait 44 px de côté au minimum.
   *
   * Une exception, et une seule : la case à cocher elle-même est petite, mais
   * c'est son étiquette qui reçoit le tap, et l'étiquette fait ses 44 px. Une
   * exception listée avec sa raison vaut mieux qu'un seuil abaissé pour tout
   * le monde.
   */
  const CIBLES_IMBRIQUEES = new Set(['.champ-case input'])

  it('donnent au doigt de quoi viser : 44 px de côté au minimum', () => {
    const regles = [...OUTIL.matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .map(([, selecteur, corps]) => ({
        selecteur: (selecteur ?? '').trim().replace(/\s+/g, ' '),
        hauteur: Number(/min-height:\s*(\d+)px/.exec(corps ?? '')?.[1] ?? Number.NaN),
      }))
      .filter((r) => Number.isFinite(r.hauteur))

    expect(regles.length).toBeGreaterThan(3)
    const trop = regles.filter(
      (r) => r.hauteur < 44 && !CIBLES_IMBRIQUEES.has(r.selecteur),
    )
    expect(trop.map((r) => `${r.selecteur} : ${r.hauteur}px`)).toEqual([])
  })

  it('l’étiquette d’une case à cocher, elle, fait bien 44 px', () => {
    expect(/\.champ-case\s*\{[^}]*min-height:\s*44px/.test(OUTIL)).toBe(true)
  })
})
