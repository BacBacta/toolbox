import type { CardItem } from './types.js'

/**
 * Ce que la carte partagée sait porter.
 *
 * Le nombre d'entrées dessinées est plafonné : au-delà, la carte grandit, le
 * PNG dépasse les 200 Ko du budget (§ 8) et WhatsApp le recompresse en bouillie.
 * Les entrées en trop sont résumées par une ligne « + N autres ».
 */
export const MAX_ITEMS_CARTE = 10

export interface ItemsCarte {
  readonly visibles: readonly CardItem[]
  readonly reste: number
}

/** Découpe la liste au plafond et compte ce qui déborde. */
export function limiterItems(items: readonly CardItem[], max = MAX_ITEMS_CARTE): ItemsCarte {
  return { visibles: items.slice(0, max), reste: Math.max(0, items.length - max) }
}

/** `+ 3 autres` — la ligne de pied de liste. */
export function texteReste(reste: number): string | null {
  if (reste <= 0) return null
  return `+ ${reste} autre${reste > 1 ? 's' : ''}`
}
