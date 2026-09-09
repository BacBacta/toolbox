import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * L'invariant du moteur pur (BRIEF.md § 3.3) : `packages/engine` n'importe
 * aucune API navigateur. Le compilateur le garantit déjà — le tsconfig du
 * paquet déclare `"lib": ["ES2022"]` sans `"DOM"` et `"types": []`, donc
 * `document` ou `fetch` ne compilent pas. Ce test le double à la lecture, pour
 * que la règle survive à quelqu'un qui « corrigerait » le tsconfig.
 *
 * Il interdit en plus les deux sources de non-déterminisme qui rendraient les
 * calculs intestables et feraient diverger le téléphone du serveur : la lecture
 * de l'horloge et le hasard. Tout ce dont un calcul a besoin lui est passé en
 * argument, `RenderContext.maintenant` compris.
 */

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const SOURCES = [join(RACINE, 'engine', 'src'), join(RACINE, 'legal-cm', 'src')]

const INTERDITS: readonly (readonly [RegExp, string])[] = [
  [/\bdocument\b/, 'API navigateur : document'],
  [/\bwindow\b/, 'API navigateur : window'],
  [/\bnavigator\b/, 'API navigateur : navigator'],
  [/\blocalStorage\b/, 'API navigateur : localStorage'],
  [/\bsessionStorage\b/, 'API navigateur : sessionStorage'],
  [/\bindexedDB\b/, 'API navigateur : indexedDB'],
  [/\bXMLHttpRequest\b/, 'API navigateur : XMLHttpRequest'],
  [/\bHTMLCanvasElement\b/, 'API navigateur : HTMLCanvasElement'],
  [/\bCanvasRenderingContext2D\b/, 'API navigateur : CanvasRenderingContext2D'],
  [/\brequestAnimationFrame\b/, 'API navigateur : requestAnimationFrame'],
  [/\bgetComputedStyle\b/, 'API navigateur : getComputedStyle'],
  [/\bfetch\s*\(/, 'réseau : fetch'],
  [/\bWebSocket\b/, 'réseau : WebSocket'],
  [/\bprocess\.\w/, 'API Node : process'],
  [/\brequire\s*\(/, 'API Node : require'],
  [/\bnew\s+Date\s*\(\s*\)/, 'lecture de l’horloge : new Date() sans argument'],
  [/\bDate\.now\s*\(/, 'lecture de l’horloge : Date.now()'],
  [/\bperformance\.now\s*\(/, 'lecture de l’horloge : performance.now()'],
  [/\bMath\.random\s*\(/, 'hasard : Math.random()'],
]

/** Les seuls paquets que le moteur a le droit d'importer. */
const IMPORTS_AUTORISES = new Set(['@a237/legal-cm'])

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((entree) => {
    const chemin = join(dossier, entree)
    if (statSync(chemin).isDirectory()) return fichiers(chemin)
    return chemin.endsWith('.ts') ? [chemin] : []
  })
}

/** Retire commentaires de bloc et de ligne, en épargnant les `https://`. */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

const FICHIERS = SOURCES.flatMap(fichiers)

describe('le moteur reste pur', () => {
  it('a bien des fichiers à inspecter', () => {
    expect(FICHIERS.length).toBeGreaterThan(10)
  })

  it.each(FICHIERS.map((f) => [relative(RACINE, f), f] as const))(
    '%s n’utilise ni API navigateur, ni horloge, ni hasard',
    (_nom, chemin) => {
      const code = sansCommentaires(readFileSync(chemin, 'utf8'))
      const trouves = INTERDITS.filter(([motif]) => motif.test(code)).map(([, quoi]) => quoi)
      expect(trouves).toEqual([])
    },
  )

  it.each(FICHIERS.map((f) => [relative(RACINE, f), f] as const))(
    '%s n’importe que du relatif ou @a237/legal-cm',
    (_nom, chemin) => {
      const code = readFileSync(chemin, 'utf8')
      const specificateurs = [...code.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1] ?? '')
      const externes = specificateurs.filter(
        (s) => !s.startsWith('.') && !IMPORTS_AUTORISES.has(s),
      )
      expect(externes).toEqual([])
    },
  )
})
