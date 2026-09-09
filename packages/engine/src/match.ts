import { normaliser } from './format.js'

/**
 * Étage 1 du moteur : correspondance directe de mots-clés, **zéro jeton**.
 *
 * Doit couvrir environ 70 % des demandes (BRIEF.md § 4). Ce qui ne matche pas
 * ici monte à l'étage 2 (composition, ~1 500 jetons) puis 3 (libre, ~3 000),
 * les deux seuls étages qui coûtent de l'argent.
 *
 * Le score est la somme des longueurs des mots-clés reconnus : un mot long est
 * plus spécifique qu'un mot court, donc « njangi » l'emporte sur « tour ».
 */

/** Ce dont l'étage 1 a besoin : des mots-clés, rien d'autre. */
export interface AvecMotsClefs {
  readonly keywords: readonly string[]
}

export interface Correspondance<S extends AvecMotsClefs> {
  readonly squelette: S
  readonly score: number
  readonly reconnus: readonly string[]
}

export function classer<S extends AvecMotsClefs>(
  demande: string,
  squelettes: readonly S[],
): readonly Correspondance<S>[] {
  const texte = normaliser(demande)
  if (texte === '') return []

  return squelettes
    .map((squelette) => {
      const reconnus = squelette.keywords.filter((k) => texte.includes(normaliser(k)))
      const score = reconnus.reduce((a, k) => a + k.length, 0)
      return { squelette, score, reconnus }
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
}

/** Le squelette qui répond, ou `null` s'il faut monter d'un étage. */
export function trouverSquelette<S extends AvecMotsClefs>(
  demande: string,
  squelettes: readonly S[],
): S | null {
  return classer(demande, squelettes)[0]?.squelette ?? null
}

