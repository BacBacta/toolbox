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

/**
 * Ne garde que le code : commentaires retirés, texte des chaînes retiré, mais
 * **expressions d'interpolation conservées** — `${etat.nom}` est du code.
 *
 * Sans ça le scanner criait sur le mot « document » écrit en français dans une
 * description de schéma. Un garde-fou qui hurle à tort finit par être désactivé.
 * Il est lui-même testé plus bas : un scanner devenu aveugle ne se voit pas.
 */
export function codeSeul(source: string): string {
  let out = ''
  let i = 0
  const n = source.length

  while (i < n) {
    const c = source.charAt(i)
    const suivant = source.charAt(i + 1)

    if (c === '/' && suivant === '*') {
      const fin = source.indexOf('*/', i + 2)
      i = fin === -1 ? n : fin + 2
      out += ' '
      continue
    }

    if (c === '/' && suivant === '/') {
      const fin = source.indexOf('\n', i + 2)
      i = fin === -1 ? n : fin
      out += ' '
      continue
    }

    if (c === "'" || c === '"') {
      i += 1
      while (i < n) {
        const d = source.charAt(i)
        if (d === '\\') {
          i += 2
          continue
        }
        i += 1
        if (d === c || d === '\n') break
      }
      out += ' "" '
      continue
    }

    if (c === '`') {
      i += 1
      while (i < n) {
        const d = source.charAt(i)
        if (d === '\\') {
          i += 2
          continue
        }
        if (d === '`') {
          i += 1
          break
        }
        if (d === '$' && source.charAt(i + 1) === '{') {
          i += 2
          const debut = i
          let profondeur = 1
          while (i < n && profondeur > 0) {
            const e = source.charAt(i)
            if (e === '{') profondeur += 1
            else if (e === '}') profondeur -= 1
            i += 1
          }
          out += ` ${source.slice(debut, Math.max(debut, i - 1))} `
          continue
        }
        i += 1
      }
      continue
    }

    out += c
    i += 1
  }

  return out
}

const FICHIERS = SOURCES.flatMap(fichiers)

describe('le moteur reste pur', () => {
  it('a bien des fichiers à inspecter', () => {
    expect(FICHIERS.length).toBeGreaterThan(10)
  })

  it.each(FICHIERS.map((f) => [relative(RACINE, f), f] as const))(
    '%s n’utilise ni API navigateur, ni horloge, ni hasard',
    (_nom, chemin) => {
      const code = codeSeul(readFileSync(chemin, 'utf8'))
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

describe('le scanner lui-même', () => {
  it('retire les commentaires de ligne et de bloc', () => {
    expect(codeSeul('const a = 1 // document.title')).not.toContain('document')
    expect(codeSeul('/* window.alert */ const a = 1')).not.toContain('window')
  })

  it('retire le texte des chaînes, y compris en français', () => {
    expect(codeSeul("const d = 'Les lignes du document.'")).not.toContain('document')
    expect(codeSeul('const d = "fenêtre : window"')).not.toContain('window')
  })

  it('survit à une apostrophe échappée', () => {
    const code = codeSeul("const a = 'l\\'appelant'\nconst b = 2")
    expect(code).toContain('const b')
  })

  it('garde les expressions interpolées : c’est du code', () => {
    expect(codeSeul('const t = `bonjour ${document.title} !`')).toContain('document')
    expect(codeSeul('const t = `${a} et ${b}`')).toContain('a')
  })

  it('retire le texte autour des interpolations', () => {
    expect(codeSeul('const t = `le document dit ${x}`')).not.toContain('document dit')
  })

  it('laisse passer le code ordinaire', () => {
    expect(codeSeul('const somme = a / b + 1')).toContain('a / b')
  })
})
