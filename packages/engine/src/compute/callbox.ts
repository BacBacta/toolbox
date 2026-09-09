import type { Encre, XAF } from '../types.js'

/**
 * Le call-box : transfert d'argent à la commission.
 *
 * Le métier tient en une règle — une grille de tranches — et deux gestes :
 * calculer ce qu'on garde sur un montant, enregistrer l'opération. Le reste
 * est du comptage.
 *
 * La grille est modifiable, et c'est le point : chaque opérateur a la sienne,
 * elle change, et un outil qui la fige en dur ne sert qu'une boutique. Le
 * prototype la portait déjà éditable ; on garde ça.
 */

export interface TrancheCommission {
  /**
   * Plafond de la tranche, inclus. `0` signifie « au-delà » : c'est la
   * dernière, elle n'a pas de plafond.
   */
  readonly plafond: XAF
  readonly commission: XAF
}

/**
 * Une opération de la caisse.
 *
 * Le nom porte son suffixe parce que `Operation` est déjà l'opérateur d'un
 * arbre de formule dans `expression.ts` : deux `Operation` sans rapport dans
 * le même paquet public, c'est une confusion garantie à l'import.
 */
export interface OperationCallbox {
  readonly montant: XAF
  readonly commission: XAF
  /** Heure locale de l'opération, `HH h MM`, telle qu'elle s'affiche. */
  readonly heure: string
  /** Jour civil de Douala, `AAAA-MM-JJ`, pour regrouper la semaine. */
  readonly jour: string
}

export interface EtatCallbox {
  readonly nom: string
  readonly encre: Encre
  readonly tranches: readonly TrancheCommission[]
  readonly operations: readonly OperationCallbox[]
}

export const MAX_TRANCHES = 10
export const MAX_OPERATIONS = 400

/**
 * La commission due sur un montant.
 *
 * Les tranches se lisent dans l'ordre : la première dont le plafond couvre le
 * montant gagne. La dernière, de plafond `0`, attrape tout le reste — sans
 * elle, un montant au-dessus de la plus haute tranche ne serait pas tarifé.
 */
export function commissionDe(tranches: readonly TrancheCommission[], montant: XAF): XAF {
  const m = Math.max(0, Math.round(montant))
  for (const t of tranches) {
    if (t.plafond === 0 || m <= t.plafond) return Math.max(0, Math.round(t.commission))
  }
  const derniere = tranches[tranches.length - 1]
  return derniere === undefined ? 0 : Math.max(0, Math.round(derniere.commission))
}

/** Ce que le client reçoit après commission. Jamais négatif. */
export function resteAuClient(tranches: readonly TrancheCommission[], montant: XAF): XAF {
  const m = Math.max(0, Math.round(montant))
  return Math.max(0, m - commissionDe(tranches, m))
}

export interface TotauxCallbox {
  /** Ce que le tenancier garde, sur les opérations retenues. */
  readonly gagne: XAF
  /** Ce qui est passé par la caisse. */
  readonly volume: XAF
  readonly nombre: number
}

export function totauxCallbox(operations: readonly OperationCallbox[]): TotauxCallbox {
  return {
    gagne: operations.reduce((a, o) => a + o.commission, 0),
    volume: operations.reduce((a, o) => a + o.montant, 0),
    nombre: operations.length,
  }
}

/** Les opérations d'un jour civil donné. */
export function operationsDuJour(
  operations: readonly OperationCallbox[],
  jour: string,
): readonly OperationCallbox[] {
  return operations.filter((o) => o.jour === jour)
}

export interface JourneeCallbox {
  readonly jour: string
  readonly gagne: XAF
  readonly nombre: number
}

/**
 * Les journées, de la plus ancienne à la plus récente.
 *
 * Le prototype gardait une semaine figée à côté des opérations du jour ; deux
 * sources pour la même chose finissent toujours par diverger. Ici la semaine
 * se déduit du registre.
 */
export function journees(operations: readonly OperationCallbox[]): JourneeCallbox[] {
  const par = new Map<string, JourneeCallbox>()
  for (const o of operations) {
    const deja = par.get(o.jour)
    par.set(o.jour, {
      jour: o.jour,
      gagne: (deja?.gagne ?? 0) + o.commission,
      nombre: (deja?.nombre ?? 0) + 1,
    })
  }
  return [...par.values()].sort((a, b) => a.jour.localeCompare(b.jour))
}

// ─────────────────────────────── transitions ───────────────────────────────

export function enregistrerOperation(
  etat: EtatCallbox,
  montant: XAF,
  heure: string,
  jour: string,
): EtatCallbox {
  const m = Math.max(0, Math.round(montant))
  if (m === 0 || etat.operations.length >= MAX_OPERATIONS) return etat
  return {
    ...etat,
    operations: [
      ...etat.operations,
      { montant: m, commission: commissionDe(etat.tranches, m), heure, jour },
    ],
  }
}

export function retirerOperation(etat: EtatCallbox, index: number): EtatCallbox {
  if (etat.operations[index] === undefined) return etat
  return { ...etat, operations: etat.operations.filter((_, i) => i !== index) }
}

/**
 * Change le tarif d'une tranche.
 *
 * Les opérations déjà enregistrées gardent la commission qu'elles portaient :
 * un tarif qu'on relève aujourd'hui ne se rattrape pas sur les transferts
 * d'hier, et recalculer tout le registre à chaque correction de grille ferait
 * bouger la recette de la semaine dernière.
 */
export function fixerCommission(
  etat: EtatCallbox,
  index: number,
  commission: XAF,
): EtatCallbox {
  if (etat.tranches[index] === undefined) return etat
  return {
    ...etat,
    tranches: etat.tranches.map((t, i) =>
      i === index ? { ...t, commission: Math.max(0, Math.round(commission)) } : t,
    ),
  }
}
