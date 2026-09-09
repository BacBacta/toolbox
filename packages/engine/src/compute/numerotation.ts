import type { Numero } from '@a237/legal-cm'
import { formatNumero, numeroSuivant, parseNumero, trouverAnomalies } from '@a237/legal-cm'
import { anneeDe } from '../format.js'

/**
 * Numérotation d'une série de documents.
 *
 * La section 5 du brief l'exige « unique, continue et chronologique » — c'est
 * une des mentions que la DGI contrôle. Le compteur ne vit pas dans un état
 * global : l'app passe les numéros déjà émis pour ce compte, et le moteur en
 * déduit le suivant. C'est ce qui permet de numéroter hors ligne.
 */

/**
 * Le prochain numéro d'une série, pour l'année civile en cours à Douala.
 *
 * Les numéros illisibles, d'une autre série ou d'une autre année sont ignorés.
 * Un trou dans la suite **n'est pas rebouché** : on repart du plus grand numéro
 * émis, plus un. Réattribuer un numéro sauté casserait l'unicité si le document
 * manquant refait surface, et la chronologie dans tous les cas.
 */
export function prochainNumero(
  prefixe: string,
  emisPrecedemment: readonly string[],
  maintenant: Date,
): string {
  const annee = anneeDe(maintenant)
  const dernier = emisPrecedemment
    .map(parseNumero)
    .filter((n): n is Numero => n !== null && n.prefixe === prefixe && n.annee === annee)
    .reduce<Numero | null>((max, n) => (max === null || n.sequence > max.sequence ? n : max), null)
  return formatNumero(numeroSuivant(dernier, annee, prefixe))
}

export { trouverAnomalies }
