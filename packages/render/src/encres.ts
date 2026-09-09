import type { Encre } from '@a237/engine'

/**
 * Les quatre encres des documents.
 *
 * Des aplats, jamais de dégradé : ça divise par trois le poids du PNG partagé
 * (invariant § 2.6). Ces valeurs vivront dans `packages/ui` le jour où ce
 * paquet aura une raison d'exister — c'est-à-dire quand il portera l'i18n et
 * les composants partagés. Quatre couleurs ne justifient pas un paquet.
 */
export const ENCRES: Readonly<Record<Encre, { readonly hex: string; readonly nom: string }>> = {
  encre: { hex: '#1F2A44', nom: 'Encre' },
  bordeaux: { hex: '#6E1F2B', nom: 'Bordeaux' },
  foret: { hex: '#1B4D3E', nom: 'Forêt' },
  ardoise: { hex: '#39434A', nom: 'Ardoise' },
}

export function hexEncre(e: Encre): string {
  return ENCRES[e].hex
}
