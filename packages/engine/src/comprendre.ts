import type { FicheSquelette } from './catalogue.js'
import type { Extrait } from './extraire.js'
import { extraire } from './extraire.js'
import { etageDe } from './etage.js'
import { classer } from './match.js'

/**
 * Ce que l'atelier comprend d'une demande, **sans appeler personne**.
 *
 * C'est la porte du moteur : elle range chaque demande dans l'un des trois
 * étages du brief (§ 4). L'étage 1 ne coûte rien et doit répondre à environ
 * sept demandes sur dix ; les deux autres coûtent des jetons, donc on ne les
 * atteint que lorsque celui-ci a vraiment échoué.
 *
 * La décision qui compte est **sûr ou ambigu**. Ouvrir d'autorité le mauvais
 * outil fait perdre plus de temps que poser une question : l'utilisateur doit
 * comprendre qu'il s'est passé quelque chose, revenir en arrière, recommencer.
 * Une question courte coûte un tapotement.
 */

export type Comprehension =
  /** Un squelette se détache. On l'ouvre, garni de ce que la phrase disait. */
  | { readonly sorte: 'sur'; readonly fiche: FicheSquelette; readonly extrait: Extrait }
  /** Plusieurs répondent. On demande, on ne parie pas. */
  | { readonly sorte: 'ambigu'; readonly fiches: readonly FicheSquelette[]; readonly extrait: Extrait }
  /** Aucun mot-clef ne mord : il faut monter d'un étage, et ça coûte. */
  | { readonly sorte: 'hors-portee'; readonly extrait: Extrait }
  /**
   * La demande vaut plusieurs outils.
   *
   * Elle sera souvent classable — « tout ce qu'il faut pour ma boutique »
   * contient « boutique » — et ouvrir la liste de prix serait répondre à un
   * dixième de la question sans le dire. C'est la même faute que de fabriquer
   * un registre pour qui demande un site : une réponse plausible à une
   * question qu'on n'a pas écoutée.
   */
  | { readonly sorte: 'plusieurs'; readonly extrait: Extrait }
  /** Rien à comprendre. */
  | { readonly sorte: 'vide' }

/**
 * L'écart qui sépare « sûr » d'« ambigu ».
 *
 * Le score est la somme des longueurs des mots-clefs reconnus. Un premier qui
 * ne fait pas au moins la moitié en plus du second ne se détache pas vraiment :
 * « facture » et « devis » dans la même phrase, c'est une question à poser, pas
 * un choix à faire à la place de quelqu'un.
 */
const ECART_SUR = 1.5

/** Au-delà, la liste cesse d'être un choix et devient une grille. */
const MAX_PROPOSES = 4

export function comprendre(
  demande: string,
  fiches: readonly FicheSquelette[],
): Comprehension {
  if (demande.trim() === '') return { sorte: 'vide' }

  const extrait = extraire(demande)

  // L'étage se décide avant le classement : une liste de courses n'est pas
  // une hésitation entre deux outils, et le premier mot reconnu ne doit pas
  // répondre à la place des trois.
  if (etageDe(demande, fiches) === 3) return { sorte: 'plusieurs', extrait }

  const classees = classer(demande, fiches)

  const premier = classees[0]
  if (premier === undefined) return { sorte: 'hors-portee', extrait }

  const second = classees[1]
  if (second === undefined || premier.score >= second.score * ECART_SUR) {
    return { sorte: 'sur', fiche: premier.squelette, extrait }
  }

  return {
    sorte: 'ambigu',
    fiches: classees.slice(0, MAX_PROPOSES).map((c) => c.squelette),
    extrait,
  }
}
