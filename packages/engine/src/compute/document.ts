import type { Client, Emetteur, Manquement } from '@a237/legal-cm'
import { mentionsManquantes } from '@a237/legal-cm'

/**
 * Ce que tout document d'affaires partage.
 *
 * Devis et facture — et demain le reçu — portent le même entête, le même
 * destinataire et la même date d'émission figée. Les fonctions qui ne
 * dépendent que de ça vivent ici, une seule fois : dupliquées, elles finissent
 * par diverger, et c'est le genre de divergence qui se voit au contrôle.
 */

/** Le minimum pour dater un document. */
export interface Date0 {
  /** Date d'émission, ISO 8601, figée à la création. */
  readonly emisLe: string
}

/** Le minimum pour contrôler les mentions d'un document. */
export interface Parties {
  readonly emetteur: Emetteur
  readonly client: Client
}

/**
 * Analyse une date ISO.
 * @throws RangeError si la chaîne n'est pas exploitable — mieux vaut une erreur
 *   qu'un document daté de « Invalid Date ».
 */
export function dateIso(valeur: string, quoi: string): Date {
  const d = new Date(valeur)
  if (Number.isNaN(d.getTime())) throw new RangeError(`${quoi} illisible : « ${valeur} »`)
  return d
}

/**
 * Date d'émission du document.
 *
 * Elle vit dans l'état, jamais dans l'horloge : un devis réédité six mois plus
 * tard porte toujours sa date d'origine.
 */
export function dateEmission(doc: Date0): Date {
  return dateIso(doc.emisLe, "date d'émission")
}

/** Ce qui manque au document pour être présentable à un contrôle. */
export function controleLegal(doc: Parties): Manquement[] {
  return mentionsManquantes(doc.emetteur, doc.client)
}
