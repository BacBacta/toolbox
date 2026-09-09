import type { Client, Emetteur } from '@a237/legal-cm'
import { joursEntre } from '../format.js'
import { MOYENS_PAIEMENT } from '../schema/facture.js'
import type { Encre, Ligne, Totaux, XAF } from '../types.js'
import { controleLegal, dateEmission, dateIso } from './document.js'
import { calculerLignes } from './tva.js'

export type MoyenPaiement = (typeof MOYENS_PAIEMENT)[number]

/** Un versement reçu. Enregistré, jamais deviné. */
export interface Reglement {
  readonly date: string
  readonly montant: XAF
  readonly moyen: MoyenPaiement
  readonly reference?: string
}

/**
 * L'état d'une facture. Autonome : la page de lecture la rend sans rien d'autre.
 *
 * Une facture envoyée par WhatsApp est valable si le PDF est complet
 * (BRIEF.md § 5) — d'où l'exigence que tout ce qui doit s'imprimer soit ici.
 */
export interface EtatFacture {
  readonly nom: string
  readonly encre: Encre
  readonly numero: string
  /** Date d'émission, ISO 8601, figée à la création. */
  readonly emisLe: string
  /** Date limite de règlement, ISO 8601. */
  readonly echeance: string
  readonly emetteur: Emetteur
  readonly client: Client
  readonly objet?: string
  /** Le devis dont elle découle, quand il y en a un. */
  readonly devisNumero?: string
  readonly conditionsReglement: string
  readonly lignes: readonly Ligne[]
  readonly reglements: readonly Reglement[]
}

export interface ChiffrageFacture extends Totaux {
  /** Total des règlements enregistrés. */
  readonly verse: XAF
  /** Ce qu'il reste à encaisser. Jamais négatif. */
  readonly reste: XAF
  /** Ce qui a été versé au-delà du dû. Jamais négatif. */
  readonly tropPercu: XAF
  /** Part réglée, 0 à 1. Vaut 1 sur une facture à zéro franc. */
  readonly partReglee: number
  readonly estSoldee: boolean
}

/**
 * Où en est la facture.
 *
 * `en-retard` l'emporte sur `partielle` : ce qui compte pour agir, c'est
 * l'échéance dépassée, pas le fait qu'un acompte soit tombé.
 */
export type StatutFacture = 'soldee' | 'en-retard' | 'partielle' | 'a-payer'

export const LIBELLE_STATUT: Readonly<Record<StatutFacture, string>> = {
  soldee: 'Soldée',
  'en-retard': 'En retard',
  partielle: 'Partiellement réglée',
  'a-payer': 'À payer',
}

export const LIBELLE_MOYEN: Readonly<Record<MoyenPaiement, string>> = {
  momo: 'MTN Mobile Money',
  'orange-money': 'Orange Money',
  especes: 'Espèces',
  virement: 'Virement',
}

export function dateEcheance(etat: EtatFacture): Date {
  return dateIso(etat.echeance, "date d'échéance")
}

/** Le chiffrage complet : lignes, TVA, totaux, encaissé et reste dû. */
export function chiffrerFacture(etat: EtatFacture): ChiffrageFacture {
  const totaux = calculerLignes(etat.lignes)
  const verse = etat.reglements.reduce((a, r) => {
    if (!Number.isSafeInteger(r.montant) || r.montant < 0) {
      throw new RangeError(`règlement invalide du ${r.date} : ${r.montant}`)
    }
    return a + r.montant
  }, 0)
  const reste = Math.max(0, totaux.totalTTC - verse)
  return {
    ...totaux,
    verse,
    reste,
    tropPercu: Math.max(0, verse - totaux.totalTTC),
    partReglee: totaux.totalTTC === 0 ? 1 : Math.min(1, verse / totaux.totalTTC),
    estSoldee: verse >= totaux.totalTTC,
  }
}

/** Le statut, à une date donnée. La date est passée, jamais lue à l'horloge. */
export function statutFacture(etat: EtatFacture, maintenant: Date): StatutFacture {
  const c = chiffrerFacture(etat)
  if (c.estSoldee) return 'soldee'
  if (joursDeRetard(etat, maintenant) > 0) return 'en-retard'
  return c.verse > 0 ? 'partielle' : 'a-payer'
}

/** Jours civils de retard à Douala. Zéro tant que l'échéance n'est pas passée. */
export function joursDeRetard(etat: EtatFacture, maintenant: Date): number {
  return Math.max(0, joursEntre(dateEcheance(etat), maintenant))
}

export { controleLegal, dateEmission, dateIso }
export type { Client, Emetteur }
