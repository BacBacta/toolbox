import type { SkeletonAnonyme } from '../types.js'
import { devis } from './devis.js'
import { njangi } from './njangi.js'

/**
 * Le registre des squelettes.
 *
 * Deux pour l'instant : `njangi` (registre) et `devis` (document A4). Les
 * quatorze autres du prototype suivront, un par commit. L'ordre est celui de
 * l'écran d'accueil.
 */
export const SQUELETTES: readonly SkeletonAnonyme[] = [devis, njangi]

export function squeletteParId(id: string): SkeletonAnonyme | null {
  return SQUELETTES.find((s) => s.id === id) ?? null
}

export { devis, njangi }
