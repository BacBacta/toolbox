import type { SkeletonAnonyme } from '../types.js'
import { attestation, dette, motivation, recu } from './actes.js'
import { devis } from './devis.js'
import { facture } from './facture.js'
import { njangi } from './njangi.js'
import { course, scolarite } from './calculs.js'
import { caisse, clients, prix, stock } from './registres.js'

/**
 * Le registre des squelettes.
 *
 * Treize écrits sur dix-sept. Six d'entre eux ne portent aucune logique propre :
 * prix, caisse, stock et clients sont de la configuration posée sur la fabrique
 * de listes ; scolarité et course, sur celle des calculatrices. Les quatre
 * actes — attestation, reçu, reconnaissance de dette, lettre de motivation —
 * partagent le papier des documents d'affaires sans en partager la fiscalité.
 *
 * L'ordre est celui de l'écran d'accueil : les documents, puis les registres,
 * puis les calculs.
 */
export const SQUELETTES: readonly SkeletonAnonyme[] = [
  devis, facture, attestation, recu, dette, motivation,
  njangi, prix, caisse, stock, clients,
  scolarite, course,
]

export function squeletteParId(id: string): SkeletonAnonyme | null {
  return SQUELETTES.find((s) => s.id === id) ?? null
}

export {
  attestation, caisse, clients, course, dette, devis, facture, motivation, njangi,
  prix, recu, scolarite, stock,
}
