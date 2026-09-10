import { describe, expect, it } from 'vitest'
import { MAX_COLORE, colorer, parcourir } from '../src/colorer.js'
import type { SorteJeton } from '../src/colorer.js'

/**
 * Colorer sans bibliothèque, et sans jamais fabriquer de balisage.
 *
 * Les deux bibliothèques du marché pèsent deux cents kilo-octets et cinq
 * mégaoctets. Sur un forfait compté à l'octet, c'est le prix d'un repas pour
 * lire son propre code en couleurs. Trois langages et pas de complétion à
 * faire : un scanner écrit à la main tient dans quelques kilo-octets.
 *
 * **Il rend des jetons, jamais du HTML.** C'est la décision qui compte :
 * colorer, c'est fabriquer du balisage à partir du code de quelqu'un, et un
 * `innerHTML` là-dessus est une faille par construction. Preact échappe les
 * jetons en les affichant ; la question ne se pose donc jamais.
 */

/**
 * L'invariant qui tient tout le reste : **rien ne se perd, rien ne se
 * duplique**.
 *
 * Recoller les jetons doit rendre le texte d'origine, au caractère près. Un
 * scanner qui avale un caractère décale toute la suite, et la couche colorée
 * cesse d'être alignée sur la zone de saisie — le curseur se met alors à
 * mentir de plus en plus à mesure qu'on descend.
 */
function recolle(texte: string, sorte: 'js' | 'css' | 'html'): string {
  return colorer(texte, sorte).map((j) => j.texte).join('')
}

const ECHANTILLONS: readonly [string, 'js' | 'css' | 'html'][] = [
  ['const prix = 5800 // le sac\nlet nom = "Ndolé"', 'js'],
  ['/* rien */\nfunction f() { return `a${b}c` }', 'js'],
  ["if (a === 1) { console.log('oui') }", 'js'],
  ['body { color: #14532d; padding: 16px }', 'css'],
  ['/* titre */\nh1, h2 { font-size: 2em }\n@media print { a { color: black } }', 'css'],
  ['<h1 class="titre">Bonjour</h1>\n<!-- rien -->', 'html'],
  ['<input id="prix" type="number" value="1750">', 'html'],
  ['', 'js'],
  ['\n\n\n', 'css'],
  ['texte sans rien de particulier', 'html'],
  ["const s = 'chaîne jamais fermée", 'js'],
  ['/* commentaire jamais fermé', 'css'],
  ['<div class="jamais fermé', 'html'],
  ['é€🙂 des caractères hors ASCII', 'js'],
]

describe('recoller les jetons rend le texte d’origine', () => {
  it.each(ECHANTILLONS)('« %s » (%s)', (texte, sorte) => {
    expect(recolle(texte, sorte)).toBe(texte)
  })

  it('même sur du code long et bariolé', () => {
    const long = ECHANTILLONS.map(([t]) => t).join('\n').repeat(20)
    for (const sorte of ['js', 'css', 'html'] as const) {
      expect(recolle(long, sorte), sorte).toBe(long)
    }
  })
})

/** Ce qu'on attend de voir coloré, langage par langage. */
function sortes(texte: string, sorte: 'js' | 'css' | 'html'): Set<SorteJeton> {
  return new Set(colorer(texte, sorte).map((j) => j.sorte))
}

describe('le JavaScript', () => {
  it('distingue les mots-clefs, les chaînes, les nombres et les commentaires', () => {
    const vus = sortes('const prix = 5800 // le sac\nlet nom = "Ndolé"', 'js')
    expect(vus).toContain('motcle')
    expect(vus).toContain('nombre')
    expect(vus).toContain('chaine')
    expect(vus).toContain('commentaire')
  })

  it('ne prend pas un mot qui contient un mot-clef pour un mot-clef', () => {
    const jetons = colorer('constante', 'js')
    expect(jetons.every((j) => j.sorte !== 'motcle')).toBe(true)
  })

  it('et un « // » dans une chaîne ne démarre pas un commentaire', () => {
    const jetons = colorer('const a = "http://exemple.cm" ; const b = 1', 'js')
    expect(jetons.filter((j) => j.sorte === 'commentaire')).toHaveLength(0)
    expect(jetons.filter((j) => j.sorte === 'nombre')).toHaveLength(1)
  })
})

describe('le CSS', () => {
  it('distingue les propriétés, les valeurs et les commentaires', () => {
    const vus = sortes('/* titre */ body { color: #14532d; padding: 16px }', 'css')
    expect(vus).toContain('commentaire')
    expect(vus).toContain('attribut')
    expect(vus).toContain('nombre')
  })
})

describe('le HTML', () => {
  it('distingue les balises, les attributs, les valeurs et les commentaires', () => {
    const vus = sortes('<h1 class="titre">Bonjour</h1><!-- rien -->', 'html')
    expect(vus).toContain('balise')
    expect(vus).toContain('attribut')
    expect(vus).toContain('chaine')
    expect(vus).toContain('commentaire')
  })

  it('et le texte entre les balises reste du texte', () => {
    const jetons = colorer('<p>Bonjour Douala</p>', 'html')
    expect(jetons.some((j) => j.sorte === 'texte' && j.texte.includes('Douala'))).toBe(true)
  })
})

/**
 * Un fichier très long ne se colore pas.
 *
 * Le scanner repasse sur tout le texte à chaque frappe. Sur un téléphone
 * d'entrée de gamme, au-delà de quelques milliers de caractères, ça se sent
 * sous les doigts — et une saisie qui traîne est bien pire qu'un code en noir
 * et blanc.
 */
describe('les très gros fichiers', () => {
  it('sortent en un seul jeton neutre, plutôt que de faire ramer la frappe', () => {
    const enorme = 'const a = 1\n'.repeat(MAX_COLORE)
    const jetons = colorer(enorme, 'js')
    expect(jetons).toHaveLength(1)
    expect(jetons[0]?.sorte).toBe('texte')
    expect(jetons[0]?.texte).toBe(enorme)
  })
})

describe('une sorte de fichier qu’on ne sait pas colorer', () => {
  it('rend le texte tel quel, sans rien inventer', () => {
    const jetons = colorer('n’importe quoi', 'inconnu' as 'js')
    expect(jetons).toHaveLength(1)
    expect(jetons[0]?.sorte).toBe('texte')
  })
})

/**
 * Un scanner qui n'avance pas fige le téléphone sous les doigts.
 *
 * C'est arrivé, et pas sur un cas tordu : `$` passait le test « est-ce une
 * lettre » du scanner CSS — parce que `$` est une lettre en JavaScript — mais
 * pas sa classe de continuation. Un `${…}` égaré dans une feuille de style, et
 * l'indice restait sur place : boucle infinie, écran gelé, sans message et sans
 * recours.
 *
 * Les essais par échantillon ne l'avaient pas vu, parce que chacun n'était
 * scanné que dans son propre langage. C'est en passant **le même texte dans les
 * trois scanners** que c'est sorti — et c'est réaliste : personne ne colle un
 * fichier propre, on tape dans le mauvais onglet.
 */
describe('aucun scanner ne peut rester sur place', () => {
  const MELANGE = [
    'const a = `x${y}z`',
    'body { $: 1; --var: 2 }',
    '<p $=1 class="a">x</p>',
    '$$$ €€€ ### @@@ ... --- ::: %%%',
    '\\\\ /* /// `` \'\' "" {} <> $_',
  ].join('\n')

  it.each(['js', 'css', 'html'] as const)('même du charabia, en %s', (sorte) => {
    const jetons = colorer(MELANGE, sorte)
    expect(jetons.map((j) => j.texte).join('')).toBe(MELANGE)
  })

  /*
   * Chaque caractère du texte pris un par un, dans les trois scanners : si l'un
   * d'eux boucle, l'essai ne rend jamais la main — et c'est exactement ce qu'on
   * veut voir échouer ici plutôt que sur un téléphone.
   */
  it('sur chaque caractère isolé, dans les trois langages', () => {
    const suspects = '$_@#.:-{}<>"\'`/\\%€é🙂\n\t '
    for (const c of suspects) {
      for (const sorte of ['js', 'css', 'html'] as const) {
        expect(colorer(c, sorte).map((j) => j.texte).join(''), `${sorte} ${c}`).toBe(c)
        expect(colorer(`a${c}b`, sorte).map((j) => j.texte).join(''), `${sorte} a${c}b`).toBe(`a${c}b`)
      }
    }
  })
})

/**
 * Le garde-fou lui-même, éprouvé sur un scanner qui refuse d'avancer.
 *
 * Il fallait le prendre à part : les scanners réels ont **aussi** des classes
 * de caractères cohérentes, donc saboter l'une des deux protections laisse
 * l'autre tenir, et aucun essai ne prouve alors celle qu'on visait. Ici on
 * donne à `parcourir` un scanner qui rend toujours la même position — ce qu'un
 * futur scanner mal écrit fera — et on vérifie qu'il rend quand même la main.
 *
 * Sans lui, cet essai ne finirait jamais : c'est exactement ce qui figeait
 * l'éditeur sur un `${…}` égaré dans une feuille de style.
 */
describe('le garde-fou d’avancement', () => {
  it('rend la main même si le scanner reste sur place', () => {
    const jetons = parcourir('abc', () => 0)
    expect(jetons.map((j) => j.texte).join('')).toBe('abc')
  })

  it('même s’il recule', () => {
    expect(parcourir('abcdef', (i) => i - 1).map((j) => j.texte).join('')).toBe('abcdef')
  })

  it('et il laisse passer un scanner qui avance normalement', () => {
    const jetons = parcourir('abc', (i, r) => {
      r.pousser('abc'[i] ?? '', 'motcle')
      return i + 1
    })
    expect(jetons).toEqual([{ texte: 'abc', sorte: 'motcle' }])
  })
})
