import type { SorteFichier } from './assembler.js'

/**
 * Colorer sans bibliothèque, et sans jamais fabriquer de balisage.
 *
 * Les deux bibliothèques du marché pèsent deux cents kilo-octets et cinq
 * mégaoctets. Sur un forfait compté à l'octet, c'est le prix d'un repas pour
 * lire son propre code en couleurs. Trois langages, pas de complétion ni de
 * repli de blocs à faire : un scanner écrit à la main tient dans quelques
 * kilo-octets, et le budget mesuré à chaque construction est précisément ce qui
 * permet de dire non aux autres.
 *
 * **Il rend des jetons, jamais du HTML.** C'est la décision qui compte.
 * Colorer, c'est fabriquer du balisage à partir du code de quelqu'un ; un
 * `innerHTML` là-dessus serait une faille par construction, et la faille la
 * plus banale qui soit. Ici l'écran affiche les jetons comme du texte — Preact
 * les échappe — et la question ne se pose jamais.
 *
 * Le scanner est délibérément approximatif : il sert à **lire**, pas à
 * compiler. Un cas tordu mal coloré ne casse rien, tandis qu'une grammaire
 * complète coûterait dix fois le poids pour un bénéfice que personne ne voit.
 */

export type SorteJeton =
  | 'texte'
  | 'commentaire'
  | 'chaine'
  | 'nombre'
  | 'motcle'
  | 'balise'
  | 'attribut'
  | 'ponctuation'

export interface Jeton {
  readonly texte: string
  readonly sorte: SorteJeton
}

/**
 * Au-delà, on ne colore plus.
 *
 * Le scanner repasse sur tout le texte à chaque frappe. Sur un téléphone
 * d'entrée de gamme, au-delà de quelques dizaines de milliers de caractères ça
 * se sent sous les doigts — et une saisie qui traîne est bien pire qu'un code
 * en noir et blanc.
 */
export const MAX_COLORE = 20_000

const MOTS_JS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do',
  'break', 'continue', 'new', 'class', 'extends', 'this', 'typeof', 'instanceof',
  'true', 'false', 'null', 'undefined', 'try', 'catch', 'finally', 'throw',
  'switch', 'case', 'default', 'of', 'in', 'async', 'await', 'import', 'export',
])

/*
 * Les mots-clefs de Python, et rien d'autre.
 *
 * Pas « print » ni « len » : ce sont des fonctions, pas des mots du langage.
 * Les colorer pareil apprendrait à quelqu'un une grammaire fausse — et il
 * faudrait la désapprendre le jour où il écrirait sa propre fonction.
 */
const MOTS_PY = new Set([
  'def', 'return', 'if', 'elif', 'else', 'for', 'while', 'break', 'continue',
  'import', 'from', 'as', 'class', 'try', 'except', 'finally', 'raise', 'with',
  'lambda', 'pass', 'and', 'or', 'not', 'in', 'is', 'None', 'True', 'False',
  'global', 'nonlocal', 'assert', 'del', 'yield', 'async', 'await',
])

const LETTRE = /[A-Za-z_$]/
const LETTRE_OU_CHIFFRE = /[A-Za-z0-9_$]/
/*
 * Une seule classe pour le début d'un mot et pour sa suite.
 *
 * En avoir deux différentes est ce qui a produit la boucle : `$` ouvrait un mot
 * CSS et ne pouvait pas le continuer. Une classe unique ne peut pas diverger
 * d'elle-même.
 */
// Sans les deux-points : ils séparent une propriété de sa valeur, et
// « a:hover » d'un sélecteur. Les avaler colorait « color: » d'un bloc.
const MOT_CSS = /[A-Za-z0-9_@.-]/
const MOT_BALISE = /[A-Za-z0-9_:-]/
const CHIFFRE = /[0-9]/
const ESPACE = /\s/

/**
 * Un ramasseur de jetons.
 *
 * Il colle les caractères voisins de même sorte : sans ça, chaque lettre
 * sortirait dans son propre élément, et l'écran en dessinerait des milliers
 * pour une page de code.
 */
export class Ramasseur {
  private readonly jetons: Jeton[] = []
  private encours = ''
  private sorte: SorteJeton = 'texte'

  pousser(texte: string, sorte: SorteJeton): void {
    if (texte === '') return
    if (sorte !== this.sorte) {
      this.clore()
      this.sorte = sorte
    }
    this.encours += texte
  }

  clore(): void {
    if (this.encours !== '') this.jetons.push({ texte: this.encours, sorte: this.sorte })
    this.encours = ''
  }

  fini(): readonly Jeton[] {
    this.clore()
    return this.jetons
  }
}

/** Avance jusqu'à `fin` incluse, ou jusqu'au bout si elle ne vient jamais. */
function jusqua(texte: string, debut: number, fin: string): number {
  const trouve = texte.indexOf(fin, debut)
  return trouve === -1 ? texte.length : trouve + fin.length
}

/** Une chaîne, avec ses échappements. Non fermée, elle court jusqu'au bout. */
function finDeChaine(texte: string, debut: number, guillemet: string): number {
  let i = debut + 1
  while (i < texte.length) {
    if (texte[i] === '\\') { i += 2; continue }
    if (texte[i] === guillemet) return i + 1
    i += 1
  }
  return texte.length
}

/**
 * Le moteur commun, et la seule chose qui garantisse qu'on avance.
 *
 * Chaque scanner dit, pour une position, jusqu'où il a lu. S'il rend une
 * position qui n'avance pas, **on avance d'un caractère quand même**.
 *
 * Ce n'est pas de la prudence de principe : `$` passait le test « est-ce une
 * lettre » du scanner CSS — parce que `$` est une lettre en JavaScript — mais
 * pas sa classe de continuation. Sur un `${…}` égaré dans une feuille de style,
 * l'indice restait sur place et la boucle ne finissait jamais. Dans l'éditeur,
 * ça fige le téléphone sous les doigts, sans message et sans recours.
 *
 * Corriger la classe de caractères aurait réglé ce cas-là. Le garantir ici les
 * règle tous, y compris celui qu'on écrira dans six mois — un scanner qui
 * n'avance pas est une faute qu'on ne remarque qu'en production.
 *
 * Exporté pour être éprouvé directement. C'est le seul moyen : les scanners
 * réels ont aussi des classes de caractères cohérentes, donc saboter l'une des
 * deux protections laisse l'autre tenir — et aucun essai ne prouve alors le
 * garde-fou. Ici on lui donne un scanner qui refuse d'avancer, et on vérifie
 * qu'il rend quand même la main.
 */
export function parcourir(
  texte: string,
  pas: (i: number, r: Ramasseur) => number,
): readonly Jeton[] {
  const r = new Ramasseur()
  let i = 0
  while (i < texte.length) {
    const avant = i
    const suivant = pas(i, r)
    if (suivant > avant) {
      i = suivant
      continue
    }
    // Le scanner n'a pas avancé : on prend le caractère tel quel et on passe.
    r.pousser(texte[i] ?? '', 'texte')
    i = avant + 1
  }
  return r.fini()
}

function colorerJs(texte: string): readonly Jeton[] {
  return parcourir(texte, (i, r) => {
    const c = texte[i] ?? ''
    const deux = texte.slice(i, i + 2)

    if (deux === '//') {
      const fin = texte.indexOf('\n', i)
      const stop = fin === -1 ? texte.length : fin
      r.pousser(texte.slice(i, stop), 'commentaire')
      return stop
    }
    if (deux === '/*') {
      const stop = jusqua(texte, i + 2, '*/')
      r.pousser(texte.slice(i, stop), 'commentaire')
      return stop
    }
    if (c === '"' || c === "'" || c === '`') {
      const stop = finDeChaine(texte, i, c)
      r.pousser(texte.slice(i, stop), 'chaine')
      return stop
    }
    if (CHIFFRE.test(c)) {
      let j = i
      while (j < texte.length && /[0-9._]/.test(texte[j] ?? '')) j += 1
      r.pousser(texte.slice(i, j), 'nombre')
      return j
    }
    if (LETTRE.test(c)) {
      let j = i
      while (j < texte.length && LETTRE_OU_CHIFFRE.test(texte[j] ?? '')) j += 1
      const mot = texte.slice(i, j)
      // Le mot entier, jamais un morceau : « constante » n'est pas « const ».
      r.pousser(mot, MOTS_JS.has(mot) ? 'motcle' : 'texte')
      return j
    }
    r.pousser(c, ESPACE.test(c) ? 'texte' : 'ponctuation')
    return i + 1
  })
}

function colorerCss(texte: string): readonly Jeton[] {
  // Dans un bloc, un mot avant « : » est une propriété ; dehors, un sélecteur.
  let dansBloc = false
  return parcourir(texte, (i, r) => {
    const c = texte[i] ?? ''

    if (texte.slice(i, i + 2) === '/*') {
      const stop = jusqua(texte, i + 2, '*/')
      r.pousser(texte.slice(i, stop), 'commentaire')
      return stop
    }
    if (c === '"' || c === "'") {
      const stop = finDeChaine(texte, i, c)
      r.pousser(texte.slice(i, stop), 'chaine')
      return stop
    }
    if (c === '{' || c === '}') {
      dansBloc = c === '{'
      r.pousser(c, 'ponctuation')
      return i + 1
    }
    if (c === '#' || CHIFFRE.test(c)) {
      let j = i + 1
      while (j < texte.length && /[0-9a-fA-F._%a-z]/.test(texte[j] ?? '')) j += 1
      r.pousser(texte.slice(i, j), 'nombre')
      return j
    }
    if (MOT_CSS.test(c)) {
      let j = i
      while (j < texte.length && MOT_CSS.test(texte[j] ?? '')) j += 1
      r.pousser(texte.slice(i, j), dansBloc ? 'attribut' : 'balise')
      return j
    }
    r.pousser(c, ESPACE.test(c) ? 'texte' : 'ponctuation')
    return i + 1
  })
}

function colorerHtml(texte: string): readonly Jeton[] {
  return parcourir(texte, (i, r) => {
    if (texte.slice(i, i + 4) === '<!--') {
      const stop = jusqua(texte, i + 4, '-->')
      r.pousser(texte.slice(i, stop), 'commentaire')
      return stop
    }
    if (texte[i] === '<') {
      const fin = texte.indexOf('>', i)
      const stop = fin === -1 ? texte.length : fin + 1
      for (const j of jetonsDeBalise(texte.slice(i, stop))) r.pousser(j.texte, j.sorte)
      return stop
    }
    const fin = texte.indexOf('<', i)
    const stop = fin === -1 ? texte.length : fin
    r.pousser(texte.slice(i, stop), 'texte')
    return stop
  })
}

/** L'intérieur d'une balise : son nom, ses attributs, ses valeurs. */
function jetonsDeBalise(balise: string): readonly Jeton[] {
  let nomVu = false
  return parcourir(balise, (i, r) => {
    const c = balise[i] ?? ''
    if (c === '"' || c === "'") {
      const stop = finDeChaine(balise, i, c)
      r.pousser(balise.slice(i, stop), 'chaine')
      return stop
    }
    if (MOT_BALISE.test(c)) {
      let j = i
      while (j < balise.length && MOT_BALISE.test(balise[j] ?? '')) j += 1
      r.pousser(balise.slice(i, j), nomVu ? 'attribut' : 'balise')
      nomVu = true
      return j
    }
    r.pousser(c, ESPACE.test(c) ? 'texte' : 'balise')
    return i + 1
  })
}

function colorerPy(texte: string): readonly Jeton[] {
  return parcourir(texte, (i, r) => {
    const c = texte[i] ?? ''

    if (c === '#') {
      const fin = texte.indexOf('\n', i)
      const stop = fin === -1 ? texte.length : fin
      r.pousser(texte.slice(i, stop), 'commentaire')
      return stop
    }
    /*
     * Les triples guillemets d'abord, sinon la chaîne simple mange les deux
     * premiers et le reste du fichier part en couleur de chaîne.
     */
    const trois = texte.slice(i, i + 3)
    if (trois === '"""' || trois === "'''") {
      const stop = jusqua(texte, i + 3, trois)
      r.pousser(texte.slice(i, stop), 'chaine')
      return stop
    }
    if (c === '"' || c === "'") {
      const stop = finDeChaine(texte, i, c)
      r.pousser(texte.slice(i, stop), 'chaine')
      return stop
    }
    if (CHIFFRE.test(c)) {
      let j = i
      while (j < texte.length && /[0-9._]/.test(texte[j] ?? '')) j += 1
      r.pousser(texte.slice(i, j), 'nombre')
      return j
    }
    if (LETTRE.test(c)) {
      let j = i
      while (j < texte.length && LETTRE_OU_CHIFFRE.test(texte[j] ?? '')) j += 1
      const mot = texte.slice(i, j)
      r.pousser(mot, MOTS_PY.has(mot) ? 'motcle' : 'texte')
      return j
    }
    r.pousser(c, ESPACE.test(c) ? 'texte' : 'ponctuation')
    return i + 1
  })
}

const PAR_SORTE: Readonly<Record<string, (t: string) => readonly Jeton[]>> = {
  js: colorerJs,
  css: colorerCss,
  html: colorerHtml,
  py: colorerPy,
}

/**
 * Le texte, découpé en jetons.
 *
 * Rien ne se perd et rien ne se duplique : recoller les jetons rend le texte
 * d'origine au caractère près. C'est l'invariant qui tient tout le reste — un
 * scanner qui avale un caractère décale la couche colorée, et le curseur se met
 * alors à mentir de plus en plus à mesure qu'on descend.
 */
export function colorer(texte: string, sorte: SorteFichier): readonly Jeton[] {
  const scanner = PAR_SORTE[sorte]
  if (scanner === undefined || texte.length > MAX_COLORE) {
    return texte === '' ? [] : [{ texte, sorte: 'texte' }]
  }
  return scanner(texte)
}
