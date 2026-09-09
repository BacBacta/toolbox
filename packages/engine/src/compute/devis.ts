import type { Client, Emetteur, Manquement } from '@a237/legal-cm'
import { mentionsManquantes } from '@a237/legal-cm'
import type { Encre, Ligne, Totaux, XAF } from '../types.js'
import { calculerLignes, montantAcompte } from './tva.js'

/** L'état d'un devis. Autonome : la page de lecture le rend sans rien d'autre. */
export interface EtatDevis {
  readonly nom: string
  readonly encre: Encre
  /** Numéro unique et continu. Voir `@a237/legal-cm` → `numerotation`. */
  readonly numero: string
  /**
   * Date d'émission, ISO 8601, **figée à la création**. Ce n'est pas « maintenant » :
   * un devis réédité six mois plus tard porte toujours sa date d'origine.
   */
  readonly emisLe: string
  readonly emetteur: Emetteur
  readonly client: Client
  readonly objet?: string
  /** Durée de validité, telle qu'elle s'imprime. Ex. « 15 jours ». */
  readonly validite: string
  /** Acompte demandé à la commande, en pourcentage du TTC. */
  readonly acompte: number
  readonly lignes: readonly Ligne[]
}

export interface ChiffrageDevis extends Totaux {
  readonly acompteDu: XAF
  readonly soldeDu: XAF
}

/** Le chiffrage complet : lignes, TVA, totaux, acompte et solde. */
export function chiffrer(etat: EtatDevis): ChiffrageDevis {
  const totaux = calculerLignes(etat.lignes)
  const acompteDu = montantAcompte(totaux.totalTTC, etat.acompte)
  return { ...totaux, acompteDu, soldeDu: totaux.totalTTC - acompteDu }
}

/**
 * Date d'émission analysée.
 * @throws RangeError si `emisLe` n'est pas une date ISO exploitable.
 */
export function dateEmission(etat: EtatDevis): Date {
  const d = new Date(etat.emisLe)
  if (Number.isNaN(d.getTime())) {
    throw new RangeError(`date d'émission illisible : « ${etat.emisLe} »`)
  }
  return d
}

/** Ce qui manque au devis pour être présentable à un contrôle. */
export function controleLegal(etat: EtatDevis): Manquement[] {
  return mentionsManquantes(etat.emetteur, etat.client)
}

export type { Client, Emetteur }
