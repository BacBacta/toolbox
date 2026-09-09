import { fichiersSources } from '@a237/outils-test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CLAIR, SOMBRE } from '../src/jetons.js'
import type { Palette } from '../src/jetons.js'

/**
 * Les composants, les feuilles de style et la palette ne doivent pas diverger.
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

/** Les déclarations d'un bloc `@palette <nom>` … `@fin-palette`. */
function blocPalette(nom: string): ReadonlyMap<string, string> {
  const debut = OUTIL.indexOf(`/* @palette ${nom} */`)
  const fin = OUTIL.indexOf('/* @fin-palette */', debut)
  if (debut === -1 || fin === -1) throw new Error(`bloc de palette « ${nom} » introuvable`)
  const bloc = OUTIL.slice(debut, fin)
  return new Map(
    [...bloc.matchAll(/(--[a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)].map(
      (m) => [m[1] ?? '', (m[2] ?? '').toUpperCase()],
    ),
  )
}

describe('feuille de style et composants', () => {
  it('trouve bien des classes des deux côtés', () => {
    expect(EMPLOYEES.length).toBeGreaterThan(24)
    expect(DECLAREES.size).toBeGreaterThan(24)
  })

  it.each(EMPLOYEES.map((c) => [c]))('« %s » est déclarée dans le CSS', (classe) => {
    expect(DECLAREES.has(classe)).toBe(true)
  })
})

describe.each([
  ['clair', CLAIR] as const,
  ['sombre', SOMBRE] as const,
])('la palette %s ne diverge pas entre le canvas et l’écran', (nom, palette: Palette) => {
  const declarees = blocPalette(nom)

  it.each(Object.entries(palette))('%s vaut %s des deux côtés', (clef, valeur) => {
    expect(declarees.get(variableCss(clef))).toBe(valeur.toUpperCase())
  })

  it('ne déclare rien de plus, ni rien de moins', () => {
    const attendues = Object.keys(palette).map(variableCss).sort()
    expect([...declarees.keys()].sort()).toEqual(attendues)
  })
})

describe('le thème sombre', () => {
  it('suit le réglage du téléphone', () => {
    expect(OUTIL).toContain('@media (prefers-color-scheme: dark)')
  })

  it('ne touche pas aux documents A4 : ils vont à l’impression', () => {
    expect(A4).not.toContain('prefers-color-scheme')
  })
})

describe('le mouvement', () => {
  it('s’efface quand le système en demande moins', () => {
    const debut = OUTIL.indexOf('@media (prefers-reduced-motion: reduce)')
    expect(debut).toBeGreaterThan(-1)
    // La vitesse tombe à zéro : une transition de 0 ms ne s'exécute pas, et
    // rien d'autre n'a besoin d'être neutralisé puisqu'on n'anime que par elle.
    expect(OUTIL.slice(debut, debut + 200)).toContain('--vitesse: 0ms')
  })

  it('n’anime que ce qui ne coûte rien à recalculer', () => {
    const proprietes = [...OUTIL.matchAll(/transition:\s*([^;]+);/g)]
      .flatMap((m) => (m[1] ?? '').split(','))
      .map((t) => t.trim().split(/\s+/)[0] ?? '')
      .filter((p) => p !== '')
    expect(proprietes.length).toBeGreaterThan(3)
    const couteuses = proprietes.filter(
      (p) => !['opacity', 'transform', 'background', 'border-color', 'color', 'box-shadow', 'width'].includes(p),
    )
    expect(couteuses).toEqual([])
  })
})

describe('la mise au point', () => {
  it('se voit au clavier, sans harceler le doigt', () => {
    expect(OUTIL).toContain(':focus-visible')
    expect(OUTIL).not.toMatch(/outline:\s*none/)
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
   * Ce qui reçoit le doigt fait 48 px de côté. Deux exceptions, listées avec
   * leur raison : la case à cocher est petite mais son étiquette fait la
   * cible, et la pastille d'initiales ne se touche pas.
   */
  const HORS_CIBLE = new Set(['.champ-case input', '.outil-rangee .ini', '.outil-pastille'])

  it('donne au doigt de quoi viser : 48 px', () => {
    expect(OUTIL).toContain('--cible: 48px')
    const regles = [...OUTIL.matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .map(([, selecteur, corps]) => ({
        selecteur: (selecteur ?? '').trim().replace(/\s+/g, ' '),
        hauteur: Number(/min-height:\s*(\d+)px/.exec(corps ?? '')?.[1] ?? Number.NaN),
      }))
      .filter((r) => Number.isFinite(r.hauteur))

    const trop = regles.filter((r) => r.hauteur < 48 && !HORS_CIBLE.has(r.selecteur))
    expect(trop.map((r) => `${r.selecteur} : ${r.hauteur}px`)).toEqual([])
  })

  it('l’étiquette d’une case à cocher vise la cible, même si la case est petite', () => {
    expect(/\.champ-case\s*\{[^}]*min-height:\s*var\(--cible\)/.test(OUTIL)).toBe(true)
  })
})
