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

  it('donnent au doigt de quoi viser : 44 px de côté au minimum', () => {
    const cibles = [...OUTIL.matchAll(/min-height:\s*(\d+)px/g)].map((m) => Number(m[1]))
    expect(cibles.length).toBeGreaterThan(3)
    expect(Math.min(...cibles)).toBeGreaterThanOrEqual(44)
  })
})
