/**
 * Montant en toutes lettres, en français.
 *
 * Obligatoire sur une reconnaissance de dette (BRIEF.md § 5) et utilisé sur les
 * reçus. Porté depuis `reference/atelier-prototype.html:524-554`, avec trois
 * corrections : le milliard (le prototype produisait « dix cents millions » pour
 * 10^9), l'accord de « cent » et « vingt » devant « mille », et le refus explicite
 * des entrées non représentables.
 *
 * Convention d'écriture, celle du prototype : « et » soudé par des traits d'union
 * (`vingt-et-un`), mais pas de trait d'union après « cent » ni « mille »
 * (`cent un`, `mille un`). Elle est cohérente d'un bout à l'autre du produit ;
 * la réforme de 1990 hyphénerait tout, l'usage administratif camerounais ne le
 * fait pas.
 *
 * Accord de « cent » et « vingt » : ils prennent le `s` quand ils sont multipliés
 * et que rien ne suit, ou qu'un nom les suit (« deux cents millions »), mais pas
 * devant l'adjectif numéral invariable « mille » (« deux cent mille »,
 * « quatre-vingt mille »). C'est le rôle du paramètre `pluriel`.
 */

const UNITES = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
] as const

const DIZAINES: Readonly<Record<number, string>> = {
  20: 'vingt', 30: 'trente', 40: 'quarante', 50: 'cinquante', 60: 'soixante',
}

function unite(i: number): string {
  const mot = UNITES[i]
  if (mot === undefined) throw new RangeError(`unité hors table : ${i}`)
  return mot
}

function dizaine(i: number): string {
  const mot = DIZAINES[i]
  if (mot === undefined) throw new RangeError(`dizaine hors table : ${i}`)
  return mot
}

/** 0 à 99. */
function c99(n: number, pluriel: boolean): string {
  if (n < 17) return unite(n)
  if (n < 20) return `dix-${unite(n - 10)}`
  if (n < 70) {
    const d = Math.floor(n / 10) * 10
    const r = n % 10
    if (r === 0) return dizaine(d)
    if (r === 1) return `${dizaine(d)}-et-un`
    return `${dizaine(d)}-${unite(r)}`
  }
  if (n < 80) {
    const r = n - 60
    if (r === 11) return 'soixante-et-onze'
    return `soixante-${c99(r, false)}`
  }
  const r = n - 80
  if (r === 0) return pluriel ? 'quatre-vingts' : 'quatre-vingt'
  return `quatre-vingt-${c99(r, false)}`
}

/** 0 à 999. */
function c999(n: number, pluriel: boolean): string {
  if (n < 100) return c99(n, pluriel)
  const c = Math.floor(n / 100)
  const r = n % 100
  const tete = c > 1 ? `${unite(c)} cent` : 'cent'
  if (r === 0) return c > 1 && pluriel ? `${tete}s` : tete
  return `${tete} ${c99(r, pluriel)}`
}

/** 1 à 999 999 999. Le zéro est traité par l'appelant. */
function souMilliard(n: number, pluriel: boolean): string {
  const millions = Math.floor(n / 1_000_000)
  const milliers = Math.floor((n % 1_000_000) / 1000)
  const reste = n % 1000
  const bouts: string[] = []
  // « mille » est invariable et ne se dit jamais « un mille ».
  if (millions > 0) bouts.push(millions === 1 ? 'un million' : `${c999(millions, true)} millions`)
  if (milliers > 0) bouts.push(milliers === 1 ? 'mille' : `${c999(milliers, false)} mille`)
  if (reste > 0) bouts.push(c999(reste, pluriel))
  return bouts.join(' ')
}

/**
 * Écrit un entier en toutes lettres. Le montant est arrondi au franc : le XAF
 * n'a pas de subdivision.
 *
 * @throws RangeError si le nombre est négatif, non fini, ou au-delà de ce que
 *   JavaScript représente exactement — mieux vaut une erreur qu'un acte signé
 *   portant un montant faux.
 */
export function lettres(montant: number): string {
  if (!Number.isFinite(montant)) {
    throw new RangeError(`montant non représentable : ${montant}`)
  }
  const n = Math.round(montant)
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new RangeError(`montant hors bornes : ${montant}`)
  }
  if (n === 0) return 'zéro'

  const milliards = Math.floor(n / 1_000_000_000)
  const reste = n % 1_000_000_000
  const bouts: string[] = []
  if (milliards > 0) {
    bouts.push(milliards === 1 ? 'un milliard' : `${souMilliard(milliards, true)} milliards`)
  }
  if (reste > 0) bouts.push(souMilliard(reste, true))
  return bouts.join(' ')
}

/**
 * La formule telle qu'elle est imprimée sur l'acte : « cent cinquante mille
 * francs CFA ». Zéro et un restent au singulier.
 */
export function montantEnLettres(montant: number): string {
  const mots = lettres(montant)
  const n = Math.round(montant)
  return `${mots} franc${n > 1 ? 's' : ''} CFA`
}
