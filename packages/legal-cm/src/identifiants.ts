/**
 * Identifiants fiscaux et commerciaux camerounais.
 *
 * On ne valide que **la forme**, jamais la clef de contrôle.
 *
 * À VÉRIFIER: l'algorithme de la lettre de contrôle du NIU, et la liste des
 * codes de ville et des lettres de catégorie du RCCM, n'ont pas de source
 * publique que j'aie pu vérifier. Les formes ci-dessous sont relevées sur les
 * exemplaires du prototype. Tant que la source manque, un identifiant mal formé
 * est signalé mais **jamais refusé** : mieux vaut un avertissement à l'écran
 * qu'un commerçant bloqué par une expression régulière trop stricte.
 */

/** NIU : une lettre, douze chiffres, une lettre. Ex. `M022114873829Y`. */
export const FORME_NIU = /^[A-Z]\d{12}[A-Z]$/

/** RCCM OHADA. Ex. `RC/DLA/2022/A/1487`. */
export const FORME_RCCM = /^RC\/[A-Z]{2,5}\/\d{4}\/[A-Z]\/\d{1,7}$/

/** Met un identifiant sous sa forme canonique : majuscules, sans espaces. */
export function normaliserIdentifiant(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, '')
}

export function estNiuBienForme(niu: string): boolean {
  return FORME_NIU.test(normaliserIdentifiant(niu))
}

export function estRccmBienForme(rccm: string): boolean {
  return FORME_RCCM.test(normaliserIdentifiant(rccm))
}
