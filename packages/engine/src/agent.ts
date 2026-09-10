import type { CalculDemande } from './calcul.js'
import { ID_COMPOSE_CALCUL } from './calcul.js'
import type { ReponseModele } from './composition.js'
import { lireReponseModele } from './composition.js'
import type { FormulaireDemande } from './formulaire.js'
import { ID_COMPOSE_FORMULAIRE } from './formulaire.js'
import type { PageDemande } from './page.js'
import { ID_COMPOSE_PAGE } from './page.js'
import { lireJsonPartiel } from './partiel.js'
import type { RegistreDemande } from './registre.js'
import { ID_COMPOSE } from './registre.js'

/**
 * L'agent : une conversation, et un outil qui se dessine pendant qu'elle a
 * lieu.
 *
 * Un bouton qui lance une génération et rend un outil marche, et c'est ce
 * qu'il y avait. Mais il ne laisse aucune place à la deuxième phrase — « non,
 * ajoute une colonne pour le mode de paiement », « enlève les prix », « mets
 * mon numéro » — alors que personne ne décrit du premier coup l'outil qu'il
 * veut. Une conversation, c'est ce droit-là.
 *
 * Le modèle rend donc **deux choses à la fois** : un mot pour la personne, et
 * l'outil. Elles voyagent dans la même réponse, et le mot vient en premier —
 * il s'écrit dans la conversation pendant que l'outil se construit à côté. Un
 * second appel pour la phrase coûterait deux fois, et l'ordre des clefs suffit.
 */

/** L'enveloppe : ce que le modèle rend à chaque tour. */
export interface TourModele {
  /** Ce qu'on dit à la personne. Une ou deux phrases, jamais un rapport. */
  readonly mot: string
  /**
   * L'outil, quand ce tour en produit un. Absent quand le modèle pose une
   * question, ou quand il refuse — parler sans rien fabriquer est une réponse
   * valable, et souvent la bonne au premier tour d'une demande floue.
   */
  readonly outil?: unknown
}

/** Ce qu'un tour a donné, une fois lu. */
export type LectureTour =
  | { readonly sorte: 'mot'; readonly mot: string }
  | { readonly sorte: 'outil'; readonly mot: string; readonly outil: ReponseModele }

/**
 * L'identifiant de squelette qui correspond à une réponse du modèle.
 *
 * Il vit ici parce que c'est l'agent qui fait le pont entre « ce que le modèle
 * a écrit » et « quel écran l'ouvre », et qu'aucun des deux côtés n'a à
 * connaître l'autre.
 */
export function squeletteDe(reponse: ReponseModele): string | null {
  if (reponse.sorte === 'registre') return ID_COMPOSE
  if (reponse.sorte === 'calcul') return ID_COMPOSE_CALCUL
  if (reponse.sorte === 'page') return ID_COMPOSE_PAGE
  if (reponse.sorte === 'formulaire') return ID_COMPOSE_FORMULAIRE
  return null
}

/** Ce que le fragment de l'outil attend, selon la forme composée. */
export function composeDe(reponse: ReponseModele): {
  readonly registre?: RegistreDemande
  readonly calcul?: CalculDemande
  readonly page?: PageDemande
  readonly formulaire?: FormulaireDemande
} | null {
  if (reponse.sorte === 'registre') return { registre: reponse.registre }
  if (reponse.sorte === 'calcul') return { calcul: reponse.calcul }
  if (reponse.sorte === 'page') return { page: reponse.page }
  if (reponse.sorte === 'formulaire') return { formulaire: reponse.formulaire }
  return null
}

/**
 * Ce qu'on dit quand le modèle a fabriqué sans rien dire.
 *
 * Court exprès : c'est une doublure, pas une phrase d'auteur. Elle ne se lit
 * que dans le cas rare où le modèle a rendu l'outil sans l'enveloppe.
 */
const MOT_PAR_DEFAUT = 'Voilà.'

/**
 * Lit un tour complet.
 *
 * Un tour sans outil n'est pas un échec : le modèle a le droit de demander une
 * précision avant de fabriquer quoi que ce soit, et c'est souvent ce qu'il faut
 * faire d'une demande de trois mots.
 *
 * Un tour **sans mot** n'en est pas un non plus, et ça a coûté un tour réel de
 * l'apprendre. Le refuser semblait juste — la personne resterait devant un
 * écran qui a bougé sans rien dire — mais l'alternative au silence n'était pas
 * une phrase : c'était une panne, écran figé et tour payé. Un outil sans
 * commentaire vaut mieux que rien du tout, et on met le commentaire à sa
 * place.
 *
 * Ce qui reste refusé est ce qui ne porte **ni mot ni outil** : là, il n'y a
 * vraiment rien à montrer.
 */
export function lireTour(valeur: unknown): LectureTour | null {
  if (typeof valeur !== 'object' || valeur === null) return null
  const tour = valeur as { mot?: unknown; outil?: unknown }
  const mot = typeof tour.mot === 'string' ? tour.mot.trim() : ''

  const outil = tour.outil ?? (familleDe(valeur) === null ? undefined : valeur)
  if (outil === undefined || outil === null) return mot === '' ? null : { sorte: 'mot', mot }

  return {
    sorte: 'outil',
    mot: mot === '' ? MOT_PAR_DEFAUT : mot,
    outil: lireReponseModele(outil),
  }
}

/**
 * Ce qu'on montre pendant que ça s'écrit.
 *
 * Il ne faut surtout pas y faire passer `lireReponseModele` : une
 * configuration à moitié écrite ne valide jamais, et l'aperçu resterait vide
 * jusqu'au dernier caractère — c'est-à-dire qu'il ne servirait à rien. Ce qu'on
 * rend ici est **une ébauche**, dessinée telle quelle, et remplacée au
 * caractère suivant.
 *
 * Rien de ce qui sort d'ici ne fabrique un outil. Seule la réponse complète,
 * passée par `lireTour`, en fabrique un — l'invariant § 2.1 tient exactement
 * comme avant, parce que la frontière n'a pas bougé.
 */
export interface Ebauche {
  /** Le mot en train de s'écrire, lettre par lettre. */
  readonly mot: string
  /** La famille reconnue, dès que la forme la trahit. */
  readonly famille: FamilleOutil | null
  /** Le titre, dès qu'il est écrit. */
  readonly titre: string
  /**
   * Ce que le modèle a posé jusqu'ici : des colonnes, des sections, des
   * questions, des champs. C'est la liste qu'on voit s'allonger.
   */
  readonly pieces: readonly string[]
}

export type FamilleOutil = 'registre' | 'calcul' | 'page' | 'formulaire' | 'refus'

/** La famille se lit sur la forme, comme partout ailleurs. */
export function familleDe(outil: unknown): FamilleOutil | null {
  if (typeof outil !== 'object' || outil === null) return null
  if ('impossible' in outil) return 'refus'
  if ('champs' in outil) return 'formulaire'
  if ('sections' in outil) return 'page'
  if ('entrees' in outil) return 'calcul'
  if ('colonnes' in outil) return 'registre'
  return null
}

const PIECES: Readonly<Record<Exclude<FamilleOutil, 'refus'>, string>> = {
  registre: 'colonnes',
  calcul: 'entrees',
  page: 'sections',
  formulaire: 'champs',
}

export function ebaucher(texte: string): Ebauche | null {
  const valeur = lireJsonPartiel(texte)
  if (typeof valeur !== 'object' || valeur === null) return null

  const tour = valeur as { mot?: unknown; outil?: unknown }
  const mot = typeof tour.mot === 'string' ? tour.mot : ''
  const outil = tour.outil
  const famille = familleDe(outil)
  if (typeof outil !== 'object' || outil === null) {
    return { mot, famille: null, titre: '', pieces: [] }
  }

  /*
   * Le titre se lit **avant** de savoir la famille, et pas après.
   *
   * Le modèle écrit `titre` en premier — c'est l'ordre du schéma — et la
   * famille ne se devine qu'à `colonnes`, `sections` ou `champs`, qui viennent
   * après. Attendre la famille pour montrer le titre laissait l'aperçu vide
   * exactement pendant les secondes où il a le plus à dire.
   */
  const o = outil as Record<string, unknown>
  const titre = typeof o.titre === 'string' ? o.titre : ''
  const liste = famille === null || famille === 'refus' ? undefined : o[PIECES[famille]]

  return {
    mot,
    famille,
    titre,
    pieces: Array.isArray(liste) ? liste.map(nommer).filter((n) => n !== '') : [],
  }
}

/**
 * La même ébauche, mais à partir d'un tour **fini**.
 *
 * Sans elle, la fenêtre se vidait à l'instant précis où l'outil était prêt :
 * l'ébauche est effacée quand le flux se termine, et il n'y avait plus rien
 * derrière. On voyait donc l'outil s'écrire, puis disparaître au moment de le
 * regarder — c'est-à-dire au seul moment où on le regarde vraiment.
 *
 * C'est la même extraction, sur une configuration cette fois validée : la
 * fenêtre n'a qu'une seule forme à dessiner, avant comme après.
 */
export function ebaucheFinie(mot: string, reponse: ReponseModele): Ebauche {
  const compose = composeDe(reponse)
  if (compose === null) {
    return { mot, famille: reponse.sorte === 'refus' ? 'refus' : null, titre: '', pieces: [] }
  }
  const outil = compose.registre ?? compose.calcul ?? compose.page ?? compose.formulaire
  return { ...(ebaucher(JSON.stringify({ mot, outil })) ?? { mot, famille: null, titre: '', pieces: [] }) }
}

/** Le nom d'une pièce, quel que soit le champ qui le porte selon la famille. */
function nommer(piece: unknown): string {
  if (typeof piece !== 'object' || piece === null) return ''
  const p = piece as { titre?: unknown; nom?: unknown }
  if (typeof p.titre === 'string') return p.titre
  return typeof p.nom === 'string' ? p.nom : ''
}
