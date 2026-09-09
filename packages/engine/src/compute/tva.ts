import { tvaSur } from '@a237/legal-cm'
import type { Ligne, LigneCalculee, Totaux, XAF } from '../types.js'

/**
 * Calcule un tableau de lignes, TVA comprise.
 *
 * **Règle d'arrondi, et c'est un choix :** chaque ligne est arrondie au franc,
 * puis les totaux sont la somme des lignes arrondies. L'inverse — sommer puis
 * arrondir — donne parfois un franc de plus, et ce franc-là ne se retrouve nulle
 * part quand un contrôleur recalcule le document ligne à ligne. Le papier doit
 * tomber juste sous son stylo. Le test `tva.test.ts` fige ce choix.
 *
 * @throws RangeError sur une quantité ou un prix unitaire négatif.
 */
export function calculerLignes(lignes: readonly Ligne[]): Totaux {
  const calculees: LigneCalculee[] = lignes.map((l) => {
    if (!Number.isFinite(l.quantite) || l.quantite < 0) {
      throw new RangeError(`quantité invalide sur « ${l.designation} » : ${l.quantite}`)
    }
    if (!Number.isSafeInteger(l.prixUnitaire) || l.prixUnitaire < 0) {
      throw new RangeError(`prix unitaire invalide sur « ${l.designation} » : ${l.prixUnitaire}`)
    }
    const montantHT = Math.round(l.quantite * l.prixUnitaire)
    const tva = tvaSur(montantHT)
    return { ...l, montantHT, tva, montantTTC: montantHT + tva }
  })

  const totalHT = calculees.reduce((a, l) => a + l.montantHT, 0)
  const totalTVA = calculees.reduce((a, l) => a + l.tva, 0)
  return { lignes: calculees, totalHT, totalTVA, totalTTC: totalHT + totalTVA }
}

/**
 * Acompte demandé à la commande, en francs, arrondi au franc.
 *
 * @throws RangeError si le pourcentage sort de 0–100.
 */
export function montantAcompte(totalTTC: XAF, pourcentage: number): XAF {
  if (!Number.isFinite(pourcentage) || pourcentage < 0 || pourcentage > 100) {
    throw new RangeError(`pourcentage d'acompte hors de 0–100 : ${pourcentage}`)
  }
  return Math.round((totalTTC * pourcentage) / 100)
}
