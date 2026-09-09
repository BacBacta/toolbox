import { codeSeul, fichiersSources } from '@a237/outils-test'
import { readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * L'invariant § 2.1 tenu là où il se joue vraiment : le rendu.
 *
 * « Pas d'`eval`, pas d'`innerHTML` sur une sortie de modèle, pas de HTML
 * arbitraire hébergé. » Preact échappe tout ce qu'on lui passe en enfant — sauf
 * si on lui demande explicitement de ne pas le faire. Ce test interdit qu'on le
 * lui demande.
 */

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')

const INTERDITS: readonly (readonly [RegExp, string])[] = [
  [/dangerouslySetInnerHTML/, 'injection de HTML : dangerouslySetInnerHTML'],
  [/\binnerHTML\b/, 'injection de HTML : innerHTML'],
  [/\bouterHTML\b/, 'injection de HTML : outerHTML'],
  [/\beval\s*\(/, 'exécution de code : eval'],
  [/new\s+Function\s*\(/, 'exécution de code : new Function'],
  [/\bdocument\.write\b/, 'injection de HTML : document.write'],
  [/\bnew\s+Date\s*\(\s*\)/, 'lecture de l’horloge : new Date() sans argument'],
  [/\bDate\.now\s*\(/, 'lecture de l’horloge : Date.now()'],
  [/\bMath\.random\s*\(/, 'hasard : Math.random()'],
]

const FICHIERS = fichiersSources(SRC)

describe('le rendu n’injecte jamais de HTML', () => {
  it('a bien des fichiers à inspecter', () => {
    expect(FICHIERS.length).toBeGreaterThan(4)
  })

  it.each(FICHIERS.map((f) => [relative(SRC, f), f] as const))(
    '%s passe tout par du JSX échappé',
    (_nom, chemin) => {
      const code = codeSeul(readFileSync(chemin, 'utf8'))
      const trouves = INTERDITS.filter(([motif]) => motif.test(code)).map(([, quoi]) => quoi)
      expect(trouves).toEqual([])
    },
  )
})
