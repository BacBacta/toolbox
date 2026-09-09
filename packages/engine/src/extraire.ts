import type { Periode } from './compute/njangi.js'
import { normaliser } from './format.js'

/**
 * Ce qu'on tire d'une phrase française **sans modèle**, à zéro jeton.
 *
 * C'est l'étage 1 poussé jusqu'au bout (BRIEF.md § 4) : « njangi de 20 000 F
 * par mois » ne doit pas seulement ouvrir un carnet de njangi, il doit
 * l'ouvrir avec la bonne cotisation et la bonne période. Ce que la phrase dit
 * déjà, l'utilisateur ne doit pas avoir à le retaper.
 *
 * Deux règles tiennent tout le fichier.
 *
 * **On ne devine pas les noms propres.** « pour Ets Ngo Bassong » est tentant,
 * mais un nom d'entreprise faux sur un document que la DGI peut contrôler est
 * pire qu'un champ vide : le vide se voit, l'erreur se signe. Les noms se
 * saisissent.
 *
 * **Un nombre nu n'est pas un montant.** Dans « njangi à 8 personnes de 20 000
 * francs », 8 et 20 000 sont deux choses différentes, et c'est ce qui suit le
 * nombre qui le dit. Ce qui n'est pas marqué reste dans `nombres`, et c'est au
 * squelette de décider s'il en veut quelque chose — lui seul sait qu'une
 * cotisation ne vaut jamais 8.
 */

export interface Extrait {
  /** Les sommes explicitement marquées — « 5 000 F », « 2 millions ». */
  readonly montants: readonly number[]
  /** Les nombres sans marque, dans l'ordre. Au squelette d'en juger. */
  readonly nombres: readonly number[]
  readonly periode: Periode | null
  /** « 8 personnes », « 12 membres ». */
  readonly compte: number | null
  /** « acompte de 30 % ». */
  readonly pourcent: number | null
}

export const EXTRAIT_VIDE: Extrait = {
  montants: [], nombres: [], periode: null, compte: null, pourcent: null,
}

/*
 * Un nombre écrit à la camerounaise : « 20 000 », « 20.000 », « 20000 ».
 * L'espace insécable compte — les claviers Android en envoient, et le brief
 * s'en sert lui-même dans les montants formatés.
 */
const NOMBRE = '\\d[\\d\\u00A0.\\u202F ]*'

const MONNAIE = '(?:f\\s*cfa|fcfa|francs?|cfa|xaf|f)\\b'

/** « 20 000 » → 20000. Les séparateurs de milliers sautent. */
function nombreDe(brut: string): number {
  const chiffres = brut.replace(/[^\d]/g, '')
  return chiffres === '' ? Number.NaN : Number(chiffres)
}

/**
 * Les mots de période, du plus spécifique au plus général.
 *
 * L'ordre compte : « tous les 15 jours » contient « jour », et « quinzaine »
 * doit gagner. On teste dans l'ordre et on s'arrête au premier.
 */
const PERIODES: readonly (readonly [RegExp, Periode])[] = [
  [/\b(quinzaine|quinzomadaire|tous les 15 jours|toutes les 2 semaines|bimensuel)\b/, 'quinzaine'],
  [/\b(mois|mensuel|mensuelle|mensuellement|chaque mois|par mois)\b/, 'mois'],
  [/\b(semaine|hebdo|hebdomadaire|chaque semaine|par semaine)\b/, 'semaine'],
]

const PERSONNES = 'personnes?|membres?|participants?|gars|gens|copains?|amis?|eleves?|enfants?'

/**
 * Les multiplicateurs parlés. « 5k » est courant à l'écrit sur téléphone, et
 * « deux millions » s'écrit plus souvent « 2 millions ».
 */
const ECHELLES: readonly (readonly [RegExp, number])[] = [
  [/\bmilliards?\b/, 1_000_000_000],
  [/\bmillions?\b/, 1_000_000],
  [/\bmille\b/, 1_000],
]

export function extraire(demande: string): Extrait {
  const brut = demande.replace(/ /g, ' ')
  const plat = normaliser(demande)

  const montants: number[] = []
  const pris: [number, number][] = []

  const marquer = (i: number, l: number): void => {
    pris.push([i, i + l])
  }
  const dejaPris = (i: number): boolean => pris.some(([a, b]) => i >= a && i < b)

  // ── les sommes à échelle : « 2 millions », « 5k » ─────────────────────────
  for (const [mot, facteur] of ECHELLES) {
    const re = new RegExp(`(${NOMBRE})\\s*${mot.source.replace(/\\b/g, '')}`, 'gi')
    for (const m of brut.matchAll(re)) {
      const n = nombreDe(m[1] ?? '')
      if (Number.isFinite(n) && m.index !== undefined) {
        montants.push(n * facteur)
        marquer(m.index, m[0].length)
      }
    }
  }
  for (const m of brut.matchAll(new RegExp(`(${NOMBRE})\\s*k\\b`, 'gi'))) {
    const n = nombreDe(m[1] ?? '')
    if (Number.isFinite(n) && m.index !== undefined && !dejaPris(m.index)) {
      montants.push(n * 1_000)
      marquer(m.index, m[0].length)
    }
  }

  // ── les sommes marquées par la monnaie : « 5 000 F », « 18500 FCFA » ──────
  for (const m of brut.matchAll(new RegExp(`(${NOMBRE})\\s*${MONNAIE}`, 'gi'))) {
    const n = nombreDe(m[1] ?? '')
    if (Number.isFinite(n) && m.index !== undefined && !dejaPris(m.index)) {
      montants.push(n)
      marquer(m.index, m[0].length)
    }
  }

  // ── le pourcentage ───────────────────────────────────────────────────────
  let pourcent: number | null = null
  const pc = brut.match(new RegExp(`(${NOMBRE})\\s*(?:%|pour ?cent)`, 'i'))
  if (pc?.index !== undefined) {
    const n = nombreDe(pc[1] ?? '')
    if (Number.isFinite(n) && n <= 100) {
      pourcent = n
      marquer(pc.index, pc[0].length)
    }
  }

  // ── le nombre de personnes ───────────────────────────────────────────────
  let compte: number | null = null
  const pers = brut.match(new RegExp(`(${NOMBRE})\\s*(?:${PERSONNES})`, 'i'))
  if (pers?.index !== undefined) {
    const n = nombreDe(pers[1] ?? '')
    if (Number.isFinite(n) && n > 0) {
      compte = n
      marquer(pers.index, pers[0].length)
    }
  }

  // ── ce qui reste : des nombres nus ───────────────────────────────────────
  const nombres: number[] = []
  for (const m of brut.matchAll(new RegExp(NOMBRE, 'g'))) {
    if (m.index === undefined || dejaPris(m.index)) continue
    const n = nombreDe(m[0])
    if (Number.isFinite(n)) nombres.push(n)
  }

  let periode: Periode | null = null
  for (const [re, p] of PERIODES) {
    if (re.test(plat)) {
      periode = p
      break
    }
  }

  return { montants, nombres, periode, compte, pourcent }
}
