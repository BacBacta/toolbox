import { fichiersSources } from '@a237/outils-test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Les composants et la feuille de style ne doivent pas diverger.
 *
 * Une classe employée dans le JSX mais absente de `a4.css` ne se voit pas dans
 * un test de rendu — le HTML sort correct, c'est la page qui est cassée. Sur un
 * document A4 qui part à l'impression, ça se découvre chez l'imprimeur.
 */

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const CSS = readFileSync(join(SRC, 'styles', 'a4.css'), 'utf8')

/** Les classes déclarées dans la feuille, y compris dans les sélecteurs composés. */
const DECLAREES = new Set(
  [...CSS.matchAll(/\.([a-z][a-z0-9-]*)/g)].map((m) => m[1] ?? ''),
)

/** Les classes employées par le JSX, en `class="…"` comme en `class={…}`. */
function classesEmployees(source: string): string[] {
  const attributs = [...source.matchAll(/class=(?:"([^"]*)"|\{([^}]*)\})/g)]
  return attributs.flatMap(([, litteral, expression]) => {
    if (litteral !== undefined) return litteral.split(/\s+/)
    const chaines = [...(expression ?? '').matchAll(/'([^']*)'/g)].map((m) => m[1] ?? '')
    return chaines.flatMap((c) => c.split(/\s+/))
  }).filter((c) => c !== '')
}

const EMPLOYEES = [
  ...new Set(fichiersSources(SRC).flatMap((f) => classesEmployees(readFileSync(f, 'utf8')))),
].sort()

describe('feuille de style et composants', () => {
  it('trouve bien des classes des deux côtés', () => {
    expect(EMPLOYEES.length).toBeGreaterThan(8)
    expect(DECLAREES.size).toBeGreaterThan(8)
  })

  it.each(EMPLOYEES.map((c) => [c]))('« %s » est déclarée dans a4.css', (classe) => {
    expect(DECLAREES.has(classe)).toBe(true)
  })

  it('décrit une page A4 en millimètres, pas en pixels d’aperçu', () => {
    expect(CSS).toContain('width: 210mm')
    expect(CSS).toContain('min-height: 297mm')
    expect(CSS).toContain('size: A4')
  })

  it('ne charge aucune police web', () => {
    expect(CSS).not.toContain('@import')
    expect(CSS).not.toContain('@font-face')
    expect(CSS).not.toContain('fonts.googleapis')
  })
})
