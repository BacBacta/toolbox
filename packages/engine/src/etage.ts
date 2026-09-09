import type { FicheSquelette } from './catalogue.js'
import { normaliser } from './format.js'
import { classer } from './match.js'

/**
 * L'étage où tombe une demande — décidé **avant** de dépendre quoi que ce soit.
 *
 * C'est l'échelle du brief (§ 4), et son intérêt est là : le premier étage ne
 * coûte rien, donc il peut trancher pour les deux autres. Annoncer le prix
 * après avoir appelé le modèle serait annoncer une facture, pas un prix.
 *
 * Le modèle économique s'y appuie : une petite tâche se paie à l'appel, une
 * grosse demande un abonnement. Pour que ça tienne, il faut reconnaître la
 * grosse demande **sans la faire** — et un mot-clef suffit à voir qu'on
 * réclame « tout ce qu'il faut pour la boutique » plutôt qu'un carnet.
 */

export type Etage =
  /** Un squelette répond. Zéro jeton, hors ligne, gratuit. */
  | 1
  /** Un outil à composer. Une génération, quelques centimes de franc. */
  | 2
  /** Plusieurs outils, ou un chantier. Plusieurs générations : un abonnement. */
  | 3

/**
 * Les marques d'une demande qui dépasse un outil.
 *
 * Elles sont volontairement peu nombreuses et sans ambiguïté. Un classement
 * trop zélé enverrait vers l'abonnement quelqu'un qui voulait un seul carnet,
 * et c'est le pire des deux échecs : refuser de vendre à quelqu'un qui payait.
 */
const PLURIEL: readonly RegExp[] = [
  /\btout ce qu il faut\b/,
  /\btout pour\b/,
  /\btoute (?:ma|la) gestion\b/,
  /\bplusieurs outils?\b/,
  /\bles outils\b/,
  /\bgerer (?:toute|tout)\b/,
  /\bde a a z\b/,
  /\bcomplet(?:e|s)?\b/,
]

/**
 * Deux familles distinctes dans la même phrase, c'est deux outils.
 *
 * « un carnet de njangi et une liste de prix » n'est pas une demande ambiguë
 * qu'il faudrait faire trancher : c'est deux demandes, et les faire l'une
 * après l'autre coûte deux générations.
 */
/**
 * Le score en dessous duquel une famille n'a pas vraiment été nommée.
 *
 * Dix, c'est un mot de cinq lettres qui porte le nom de l'outil — « njangi »,
 * « devis », « stock ». En dessous, on a reconnu un mot qui gravite autour de
 * l'outil sans le désigner.
 *
 * Un seuil **absolu**, et non une fraction du meilleur score : le score mesure
 * la longueur des mots reconnus, pas la confiance. Dans « un njangi, une liste
 * de prix et un inventaire », les trois sont nommés sans ambiguïté et pèsent
 * pourtant 30, 20 et 12 — la moitié du meilleur écartait le troisième.
 */
const SCORE_NOMME = 10

function famillesDistinctes(demande: string, fiches: readonly FicheSquelette[]): number {
  return classer(demande, fiches).filter((c) => c.score >= SCORE_NOMME).length
}

export function etageDe(demande: string, fiches: readonly FicheSquelette[]): Etage {
  const plat = normaliser(demande)
  if (plat === '') return 1

  if (PLURIEL.some((re) => re.test(plat))) return 3

  /*
   * La liste de courses se reconnaît en premier.
   *
   * « Un njangi, une liste de prix et un inventaire » nomme trois outils, et
   * ça reste vrai même si l'un des trois mots est plus long que les autres.
   * Tester d'abord « un squelette se détache » laissait passer la liste
   * entière pour le seul outil dont le nom pesait le plus lourd.
   */
  if (famillesDistinctes(demande, fiches) >= 3) return 3

  const classees = classer(demande, fiches)
  const premier = classees[0]
  const second = classees[1]

  // Un squelette se détache : l'étage 1 répond, gratuitement.
  if (premier !== undefined && (second === undefined || premier.score >= second.score * 1.5)) {
    return 1
  }

  return premier === undefined ? 2 : 1
}

/**
 * Ce qu'un étage engage, dit en français.
 *
 * Les montants ne sont pas écrits ici : ils dépendent du modèle et du taux du
 * jour, et une valeur en dur dans un texte est une valeur que personne ne
 * revoit. Le coût réel remonte du fournisseur, à l'appel.
 */
export const CE_QUE_COUTE: Readonly<Record<Etage, string>> = {
  1: 'gratuit, et ça marche hors ligne',
  2: 'quelques centimes de franc',
  3: 'plusieurs outils d’un coup : ça demande un abonnement',
}
