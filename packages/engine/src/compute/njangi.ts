import type { XAF } from '../types.js'

/**
 * Calculs du carnet de njangi.
 *
 * Un njangi tourne : chaque période, tout le monde verse sa part et un membre
 * reçoit la cagnotte. Le cycle est fini quand chacun a reçu une fois, et un
 * nouveau cycle repart.
 */

export type Periode = 'semaine' | 'quinzaine' | 'mois'

export interface MembreNjangi {
  readonly nom: string
  /** Numéro pour la relance. Absent quand on ne l'a pas. */
  readonly tel?: string
  /** A versé sa part pour le tour en cours. */
  readonly aVerse: boolean
  /** A déjà reçu la cagnotte dans le cycle en cours. */
  readonly aRecu: boolean
  /** C'est son tour de recevoir. */
  readonly estAuTour: boolean
  /** Nombre de tours où le membre a versé — numérateur de la fiabilité. */
  readonly versements: number
  /** Nombre de tours écoulés depuis son entrée — dénominateur. */
  readonly tours: number
}

export interface EtatNjangi {
  readonly nom: string
  readonly cotisation: XAF
  readonly periode: Periode
  /** Numéro du tour en cours. */
  readonly tour: number
  readonly historique: readonly { readonly tour: number; readonly collecte: XAF }[]
  readonly membres: readonly MembreNjangi[]
}

export interface Collecte {
  readonly attendu: XAF
  readonly collecte: XAF
  readonly reste: XAF
  readonly nbVerse: number
  readonly nbMembres: number
  /** Part de la collecte réalisée, 0 à 1. Vaut 0 quand il n'y a personne. */
  readonly taux: number
  readonly retardataires: readonly MembreNjangi[]
}

/** Où en est la cagnotte du tour en cours. */
export function collecte(etat: EtatNjangi): Collecte {
  const nbMembres = etat.membres.length
  const verses = etat.membres.filter((m) => m.aVerse)
  const attendu = nbMembres * etat.cotisation
  const encaisse = verses.length * etat.cotisation
  return {
    attendu,
    collecte: encaisse,
    reste: attendu - encaisse,
    nbVerse: verses.length,
    nbMembres,
    taux: attendu === 0 ? 0 : encaisse / attendu,
    retardataires: etat.membres.filter((m) => !m.aVerse),
  }
}

/**
 * Fiabilité d'un membre : la part des tours où il a versé.
 *
 * `null` pour un membre qui n'a encore vécu aucun tour — on ne lui invente pas
 * une réputation, ni bonne ni mauvaise.
 */
export function fiabilite(m: MembreNjangi): number | null {
  if (m.tours <= 0) return null
  return m.versements / m.tours
}

/**
 * Au-dessus de ce taux, un membre est présenté comme fiable.
 *
 * C'est une convention d'affichage reprise du prototype, pas une règle de
 * njangi : aucun trésorier ne calcule 80 %. Elle sert à trier une liste et à
 * colorer un badge, jamais à exclure quelqu'un.
 */
export const SEUIL_FIABILITE = 0.8

/** `null` pour un membre sans historique — on ne le juge pas sur rien. */
export function estFiable(m: MembreNjangi): boolean | null {
  const f = fiabilite(m)
  return f === null ? null : f >= SEUIL_FIABILITE
}

/** Les membres du moins fiable au plus fiable. Les nouveaux ferment la marche. */
export function classementFiabilite(etat: EtatNjangi): readonly MembreNjangi[] {
  return [...etat.membres].sort((a, b) => {
    const fa = fiabilite(a)
    const fb = fiabilite(b)
    if (fa === null && fb === null) return 0
    if (fa === null) return 1
    if (fb === null) return -1
    return fa - fb
  })
}

/** Le membre qui reçoit la cagnotte ce tour-ci. */
export function beneficiaireDuTour(etat: EtatNjangi): MembreNjangi | null {
  return etat.membres.find((m) => m.estAuTour) ?? null
}

/**
 * Clôture le tour en cours et ouvre le suivant.
 *
 * Le prototype se contentait de déplacer le drapeau du tour
 * (`reference/atelier-prototype.html:921-923`) : il n'archivait pas la collecte,
 * ne remettait pas les versements à zéro — tout le monde restait donc marqué
 * « a versé » à la période suivante — et ne mettait pas à jour la fiabilité.
 * Le moteur fait les quatre.
 *
 * Le bénéficiaire suivant est le premier membre de la liste, après le sortant,
 * qui n'a pas encore reçu. Quand tout le monde a reçu, le cycle se referme :
 * les compteurs `aRecu` repartent à zéro et le tour revient au premier membre.
 *
 * @throws RangeError sur un njangi sans membre — il n'y a rien à faire tourner.
 */
export function prochainTour(etat: EtatNjangi): EtatNjangi {
  const n = etat.membres.length
  if (n === 0) throw new RangeError('njangi sans membre : aucun tour à clôturer')

  const idxSortant = etat.membres.findIndex((m) => m.estAuTour)
  const encaisse = collecte(etat).collecte

  // Le tour est vécu par tout le monde : la fiabilité avance pour chacun.
  let membres: MembreNjangi[] = etat.membres.map((m, i) => ({
    ...m,
    versements: m.versements + (m.aVerse ? 1 : 0),
    tours: m.tours + 1,
    aVerse: false,
    estAuTour: false,
    aRecu: m.aRecu || i === idxSortant,
  }))

  // Le suivant qui n'a pas encore reçu, en repartant après le sortant.
  let idxEntrant = -1
  for (let pas = 1; pas <= n; pas += 1) {
    const i = (idxSortant + pas + n) % n
    if (membres[i]?.aRecu === false) {
      idxEntrant = i
      break
    }
  }

  // Personne : le cycle est complet, on en ouvre un nouveau.
  if (idxEntrant === -1) {
    membres = membres.map((m) => ({ ...m, aRecu: false }))
    idxEntrant = 0
  }

  membres = membres.map((m, i) => (i === idxEntrant ? { ...m, estAuTour: true } : m))

  return {
    ...etat,
    tour: etat.tour + 1,
    historique: [...etat.historique, { tour: etat.tour, collecte: encaisse }],
    membres,
  }
}

// ───────────────────── transitions d'état, toutes pures ─────────────────────
//
// Elles vivent ici et non dans le composant : le moteur est testé sans DOM, et
// l'écran n'a plus qu'à les appeler. C'est ce qui rend l'interface remplaçable
// sans toucher à ce que le trésorier considère comme son cahier.

function remplacerMembre(
  etat: EtatNjangi,
  index: number,
  transforme: (m: MembreNjangi) => MembreNjangi,
): EtatNjangi {
  const cible = etat.membres[index]
  if (cible === undefined) throw new RangeError(`aucun membre à l'index ${index}`)
  return {
    ...etat,
    membres: etat.membres.map((m, i) => (i === index ? transforme(m) : m)),
  }
}

/** Marque ou démarque le versement d'un membre pour le tour en cours. */
export function basculerVersement(etat: EtatNjangi, index: number): EtatNjangi {
  return remplacerMembre(etat, index, (m) => ({ ...m, aVerse: !m.aVerse }))
}

/**
 * Ajoute un membre au njangi.
 *
 * Il entre sans historique : `versements` et `tours` à zéro, donc une fiabilité
 * indéterminée jusqu'au premier tour vécu. Il n'a pas encore reçu, ce qui le
 * place naturellement dans la rotation.
 *
 * **Le premier membre prend le tour.** Un njangi qui a des membres a forcément
 * quelqu'un qui reçoit : sans ça l'écran affichait « Tour : — » et la carte
 * partagée aussi, ce qui ne veut rien dire pour un trésorier.
 *
 * @throws RangeError sur un nom vide — un carnet de njangi sans nom ne sert à rien.
 */
export function ajouterMembre(etat: EtatNjangi, nom: string, tel?: string): EtatNjangi {
  const propre = nom.trim()
  if (propre === '') throw new RangeError('nom de membre vide')
  const personneAuTour = etat.membres.every((m) => !m.estAuTour)
  const membre: MembreNjangi = {
    nom: propre,
    ...(tel !== undefined && tel.trim() !== '' ? { tel: tel.trim() } : {}),
    aVerse: false,
    aRecu: false,
    estAuTour: personneAuTour,
    versements: 0,
    tours: 0,
  }
  return { ...etat, membres: [...etat.membres, membre] }
}

/**
 * Retire un membre.
 *
 * Si c'était lui qui devait recevoir ce tour-ci, le drapeau passe au suivant
 * qui n'a pas encore reçu — sinon le njangi se retrouverait sans bénéficiaire
 * et `prochainTour` repartirait du début, ce qui ferait passer quelqu'un deux
 * fois dans le même cycle.
 */
export function retirerMembre(etat: EtatNjangi, index: number): EtatNjangi {
  const partant = etat.membres[index]
  if (partant === undefined) throw new RangeError(`aucun membre à l'index ${index}`)

  const restants = etat.membres.filter((_, i) => i !== index)
  if (!partant.estAuTour || restants.length === 0) return { ...etat, membres: restants }

  const repreneur = restants.findIndex((m) => !m.aRecu)
  const cible = repreneur === -1 ? 0 : repreneur
  return {
    ...etat,
    membres: restants.map((m, i) => (i === cible ? { ...m, estAuTour: true } : m)),
  }
}

/**
 * Change la cotisation.
 * @throws RangeError sur un montant négatif ou fractionnaire — le XAF n'a pas
 *   de subdivision, et une cotisation négative n'a pas de sens.
 */
export function changerCotisation(etat: EtatNjangi, montant: number): EtatNjangi {
  if (!Number.isSafeInteger(montant) || montant < 0) {
    throw new RangeError(`cotisation invalide : ${montant}`)
  }
  return { ...etat, cotisation: montant }
}
