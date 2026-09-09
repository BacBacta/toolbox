import type { SkeletonAnonyme } from '../types.js'
import { devis } from './devis.js'
import { facture } from './facture.js'
import { njangi } from './njangi.js'
import { course, scolarite } from './calculs.js'
import { caisse, clients, prix, stock } from './registres.js'

/**
 * Le registre des squelettes.
 *
 * Neuf écrits sur dix-sept. Six d'entre eux ne portent aucune logique propre :
 * prix, caisse, stock et clients sont de la configuration posée sur la fabrique
 * de listes ; scolarité et course, sur celle des calculatrices.
 *
 * L'ordre est celui de l'écran d'accueil : les documents, puis les registres,
 * puis les calculs.
 */
export const SQUELETTES: readonly SkeletonAnonyme[] = [
  devis, facture, njangi, prix, caisse, stock, clients, scolarite, course,
]

export function squeletteParId(id: string): SkeletonAnonyme | null {
  return SQUELETTES.find((s) => s.id === id) ?? null
}

export { caisse, clients, course, devis, facture, njangi, prix, scolarite, stock }
