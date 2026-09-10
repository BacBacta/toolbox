import { describe, expect, it } from 'vitest'
import { LANGUES, expliquer, langueDuNavigateur } from '../src/expliquer.js'
import type { Langue } from '../src/expliquer.js'

/**
 * Traduire l'erreur, hors ligne et tout de suite.
 *
 * La console affichait `Uncaught SyntaxError: Unexpected token '{'`. Pour
 * quelqu'un qui apprend, cette phrase ne dit rien — et s'il ne lit pas
 * l'anglais, elle ne dit rien du tout. Or c'est exactement le moment où il
 * conclut qu'il n'y arrive pas.
 *
 * Les erreurs d'un débutant forment un ensemble fermé : une trentaine de
 * messages couvrent presque tout. Un dictionnaire les explique sans réseau,
 * sans clef et sans coût — ce qui vaut mieux qu'un appel au modèle pour dire
 * qu'il manque une parenthèse.
 *
 * **Deux langues, parce que le pays en a deux.** Le français et l'anglais sont
 * tous deux officiels au Cameroun, et le Nord-Ouest et le Sud-Ouest sont
 * anglophones. Un outil d'apprentissage qui ne parle qu'une des deux en exclut
 * une partie.
 */

const CAS: readonly [string, RegExp, RegExp][] = [
  ["Uncaught SyntaxError: Unexpected token '{'", /parenthèse|accolade|virgule/i, /bracket|brace|comma/i],
  ['Uncaught SyntaxError: Unexpected end of input', /ferm/i, /clos|close/i],
  ['Uncaught ReferenceError: prix is not defined', /prix/, /prix/],
  ['Uncaught TypeError: calculer is not a function', /calculer/, /calculer/],
  ["Uncaught TypeError: Cannot read properties of null (reading 'value')", /null|introuvable|n’existe/i, /null|not found|doesn’t exist/i],
  ['Uncaught SyntaxError: missing ) after argument list', /parenthèse/i, /bracket|paren/i],
  ['Uncaught TypeError: Assignment to constant variable.', /const/, /const/],
  ['Uncaught RangeError: Maximum call stack size exceeded', /boucle|elle-même|infini/i, /loop|itself|infinite/i],
  ["Uncaught SyntaxError: Identifier 'a' has already been declared", /déjà/i, /already/i],
]

describe('les erreurs qu’un débutant rencontre vraiment', () => {
  it.each(CAS)('« %s » s’explique dans les deux langues', (message, fr, en) => {
    const f = expliquer(message, 'fr')
    const a = expliquer(message, 'en')
    expect(f, `fr : ${message}`).not.toBe(null)
    expect(a, `en : ${message}`).not.toBe(null)
    expect(`${f?.quoi} ${f?.faire}`).toMatch(fr)
    expect(`${a?.quoi} ${a?.faire}`).toMatch(en)
  })

  /*
   * Le nom que la personne a écrit se retrouve dans l'explication.
   *
   * « prix n'est pas défini » vaut mieux que « une variable n'est pas
   * définie » : c'est le mot qu'elle vient de taper, et elle le reconnaît.
   */
  it('reprend le nom que la personne a écrit', () => {
    expect(expliquer('Uncaught ReferenceError: totalDuPanier is not defined', 'fr')?.quoi)
      .toContain('totalDuPanier')
  })

  it('dit toujours quoi faire, pas seulement ce qui s’est passé', () => {
    for (const [message] of CAS) {
      for (const langue of LANGUES) {
        const e = expliquer(message, langue)
        expect(e?.faire.length, `${langue} : ${message}`).toBeGreaterThan(15)
      }
    }
  })

  it('et ne prétend rien savoir de ce qu’il ne connaît pas', () => {
    expect(expliquer('Uncaught WeirdError: quelque chose de très inhabituel', 'fr')).toBe(null)
    expect(expliquer('', 'fr')).toBe(null)
  })
})

describe('les deux langues', () => {
  it('sont le français et l’anglais, les deux langues officielles du pays', () => {
    expect([...LANGUES].sort()).toEqual(['en', 'fr'])
  })

  it('se devinent au navigateur, et retombent sur le français', () => {
    expect(langueDuNavigateur('en-US')).toBe('en')
    expect(langueDuNavigateur('en')).toBe('en')
    expect(langueDuNavigateur('fr-CM')).toBe('fr')
    expect(langueDuNavigateur('es-ES')).toBe('fr')
    expect(langueDuNavigateur(undefined)).toBe('fr')
  })

  /*
   * Une explication vide serait pire qu'absente : elle laisserait croire que la
   * console a répondu.
   */
  it('et chaque explication est écrite dans les deux, jamais à moitié', () => {
    for (const [message] of CAS) {
      const paires = LANGUES.map((l: Langue) => expliquer(message, l))
      expect(paires.every((p) => p !== null && p.quoi !== '' && p.faire !== '')).toBe(true)
      // Les deux versions disent la même chose, pas la même phrase.
      expect(paires[0]?.quoi).not.toBe(paires[1]?.quoi)
    }
  })
})
