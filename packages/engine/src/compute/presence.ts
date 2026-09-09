import { normaliser } from '../format.js'
import type { Encre } from '../types.js'

/**
 * La feuille de présence.
 *
 * Le seul registre que la fabrique de listes ne sait pas exprimer : ce n'est
 * pas une liste de lignes mais une matrice — les mêmes personnes, séance après
 * séance. Une liste par séance perdrait le taux de présence de chacun, qui est
 * précisément ce qu'on ouvre la feuille pour savoir.
 *
 * Les séances sont un tableau de tableaux de booléens, indexés comme `noms`.
 * Une case absente vaut « pas encore appelé » et ne compte ni au numérateur ni
 * au dénominateur : quelqu'un qui rejoint à la troisième séance n'est pas
 * absent aux deux premières.
 */

export interface Seance {
  /** Comment la séance s'appelle. Vide quand elle n'a que son rang. */
  readonly titre: string
  /** Un présent par personne, dans l'ordre de `noms`. */
  readonly presents: readonly boolean[]
}

export interface EtatPresence {
  readonly nom: string
  readonly encre: Encre
  readonly noms: readonly string[]
  readonly seances: readonly Seance[]
}

export const MAX_NOMS = 120
export const MAX_SEANCES = 60

/** Le nom d'une séance, tel qu'il s'affiche. */
export function nomSeance(etat: EtatPresence, index: number): string {
  const s = etat.seances[index]
  if (s === undefined) return ''
  return s.titre.trim() === '' ? `séance ${index + 1}` : s.titre
}

export function estPresent(etat: EtatPresence, seance: number, personne: number): boolean {
  return etat.seances[seance]?.presents[personne] === true
}

export interface AppelSeance {
  readonly presents: number
  readonly total: number
  /** Part de présents, 0 à 1. Vaut 0 quand il n'y a personne. */
  readonly taux: number
  /** Les noms des absents, dans l'ordre de la feuille. */
  readonly absents: readonly string[]
}

export function appel(etat: EtatPresence, seance: number): AppelSeance {
  const total = etat.noms.length
  const presents = etat.noms.filter((_, i) => estPresent(etat, seance, i)).length
  return {
    presents,
    total,
    taux: total === 0 ? 0 : presents / total,
    absents: etat.noms.filter((_, i) => !estPresent(etat, seance, i)),
  }
}

export interface Assiduite {
  readonly nom: string
  readonly index: number
  /** Séances où la personne était inscrite. */
  readonly seances: number
  readonly presences: number
  /** Taux de présence, ou `null` quand la personne n'a encore aucune séance. */
  readonly taux: number | null
}

/**
 * L'assiduité de chacun sur toutes les séances.
 *
 * Le dénominateur ne compte que les séances où la personne figurait : une case
 * jamais renseignée n'est pas une absence, sans quoi le dernier inscrit
 * ouvrirait la feuille à 20 % et n'y pourrait rien.
 */
export function assiduites(etat: EtatPresence): Assiduite[] {
  return etat.noms.map((nom, index) => {
    let seances = 0
    let presences = 0
    for (const s of etat.seances) {
      const marque = s.presents[index]
      if (marque === undefined) continue
      seances += 1
      if (marque) presences += 1
    }
    return {
      nom,
      index,
      seances,
      presences,
      taux: seances === 0 ? null : presences / seances,
    }
  })
}

/** Sous ce taux, quelqu'un décroche. */
export const SEUIL_ASSIDUITE = 0.6

export function decroche(a: Assiduite): boolean {
  return a.taux !== null && a.taux < SEUIL_ASSIDUITE
}

// ─────────────────────────────── transitions ───────────────────────────────

export function basculerPresence(
  etat: EtatPresence,
  seance: number,
  personne: number,
): EtatPresence {
  const s = etat.seances[seance]
  if (s === undefined || etat.noms[personne] === undefined) return etat
  const presents = etat.noms.map((_, i) =>
    i === personne ? !estPresent(etat, seance, i) : (s.presents[i] ?? false),
  )
  return {
    ...etat,
    seances: etat.seances.map((x, i) => (i === seance ? { ...x, presents } : x)),
  }
}

/**
 * Une nouvelle séance, tout le monde présent.
 *
 * Partir de « tous présents » et décocher les absents demande moins de gestes
 * que l'inverse : dans une classe ou une association, l'assemblée est la règle
 * et l'absence l'exception.
 */
export function nouvelleSeance(etat: EtatPresence, titre = ''): EtatPresence {
  if (etat.seances.length >= MAX_SEANCES) return etat
  return {
    ...etat,
    seances: [...etat.seances, { titre: titre.trim(), presents: etat.noms.map(() => true) }],
  }
}

export function ajouterNom(etat: EtatPresence, nom: string): EtatPresence {
  const propre = nom.trim()
  if (propre === '' || etat.noms.length >= MAX_NOMS) return etat
  // Le nouveau n'a rien à rattraper : sa case reste absente des séances
  // passées, et son taux ne compte qu'à partir d'aujourd'hui.
  if (etat.noms.some((n) => normaliser(n) === normaliser(propre))) return etat
  return { ...etat, noms: [...etat.noms, propre] }
}

export function retirerNom(etat: EtatPresence, index: number): EtatPresence {
  if (etat.noms[index] === undefined) return etat
  return {
    ...etat,
    noms: etat.noms.filter((_, i) => i !== index),
    seances: etat.seances.map((s) => ({
      ...s,
      presents: s.presents.filter((_, i) => i !== index),
    })),
  }
}
