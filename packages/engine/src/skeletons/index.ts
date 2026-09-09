import type { SkeletonAnonyme } from '../types.js'
import { attestation, dette, motivation, recu } from './actes.js'
import { ardoise } from './ardoise.js'
import { cv } from './cv.js'
import { devis } from './devis.js'
import { facture } from './facture.js'
import { njangi } from './njangi.js'
import { course, scolarite } from './calculs.js'
import { caisse, clients, prix, stock } from './registres.js'

/**
 * Le registre des squelettes.
 *
 * Quinze écrits sur dix-sept. Six d'entre eux ne portent aucune logique propre :
 * prix, caisse, stock et clients sont de la configuration posée sur la fabrique
 * de listes ; scolarité et course, sur celle des calculatrices. Les quatre
 * actes — attestation, reçu, reconnaissance de dette, lettre de motivation —
 * partagent le papier des documents d'affaires sans en partager la fiscalité.
 * Le CV, lui, ne partage même pas le papier : c'est le seul document où la
 * mise en page est l'enjeu, et il en porte quatre.
 *
 * L'ordre est celui de l'écran d'accueil : les documents, puis les registres,
 * puis les calculs.
 */
export const SQUELETTES: readonly SkeletonAnonyme[] = [
  devis, facture, attestation, recu, dette, motivation, cv,
  njangi, prix, caisse, stock, clients, ardoise,
  scolarite, course,
]

export function squeletteParId(id: string): SkeletonAnonyme | null {
  return SQUELETTES.find((s) => s.id === id) ?? null
}

export {
  ardoise, attestation, caisse, clients, course, cv, dette, devis, facture,
  motivation, njangi, prix, recu, scolarite, stock,
}
