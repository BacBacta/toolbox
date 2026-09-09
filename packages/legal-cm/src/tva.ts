/**
 * TVA camerounaise.
 *
 * Le taux de 19,25 % et l'obligation de l'afficher ligne par ligne puis en bloc
 * HT / TVA / TTC sont des faits vérifiés du brief (BRIEF.md § 5). Ne pas les
 * redériver ni les « corriger » sans source.
 */

/** Le taux, exprimé en dix-millièmes, pour calculer en entiers. 1925 = 19,25 %. */
export const TAUX_TVA_CM_POUR_10000 = 1925

/** Le même taux en fraction, pour l'affichage et les comparaisons. */
export const TAUX_TVA_CM = TAUX_TVA_CM_POUR_10000 / 10_000

/** Le libellé tel qu'il doit apparaître sur le document. */
export const LIBELLE_TVA_CM = 'TVA 19,25 %'

/**
 * TVA due sur un montant hors taxes, arrondie au franc.
 *
 * Le calcul passe par des entiers (`ht × 1925 / 10000`) : à ces ordres de
 * grandeur le produit reste très en deçà de 2^53, donc pas de dérive flottante.
 * La demie est arrondie vers le haut, comme `Math.round` : jamais moins que dû.
 *
 * @throws RangeError sur un montant négatif, non entier ou non fini. Les
 *   montants sont arrondis au franc *avant* d'arriver ici ; l'avoir (montant
 *   négatif) n'est pas au périmètre v1.
 */
export function tvaSur(montantHT: number): number {
  if (!Number.isSafeInteger(montantHT)) {
    throw new RangeError(`montant HT non entier ou hors bornes : ${montantHT}`)
  }
  if (montantHT < 0) {
    throw new RangeError(`montant HT négatif : ${montantHT}`)
  }
  return Math.round((montantHT * TAUX_TVA_CM_POUR_10000) / 10_000)
}
