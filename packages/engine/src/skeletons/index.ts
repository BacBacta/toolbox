import type { SkeletonAnonyme } from '../types.js'
import { devis } from './devis.js'
import { facture } from './facture.js'
import { njangi } from './njangi.js'

/**
 * Le registre des squelettes.
 *
 * Trois pour l'instant : `devis` et `facture` (documents A4), `njangi`
 * (registre). Les treize autres du prototype suivront, un par commit. L'ordre
 * est celui de l'écran d'accueil : les documents d'abord.
 */
export const SQUELETTES: readonly SkeletonAnonyme[] = [devis, facture, njangi]

export function squeletteParId(id: string): SkeletonAnonyme | null {
  return SQUELETTES.find((s) => s.id === id) ?? null
}

export { devis, facture, njangi }
