import type { Instantane } from '@a237/engine'
import {
  ID_COMPOSE, ID_COMPOSE_CALCUL, ID_COMPOSE_PAGE, accepteLaVersion, lienValide, publiable,
  pourquoiNonPubliable,
} from '@a237/engine'
import { rendable, squeletteConnu } from './html.js'

/**
 * Déposer un instantané.
 *
 * Le serveur ne fait pas confiance à ce qu'il reçoit — pas parce que le client
 * est malveillant, mais parce qu'un client peut être une version plus ancienne,
 * une file d'attente qui rejoue, ou n'importe qui avec `curl`. Chaque contrôle
 * refuse pour une raison distincte que l'app peut afficher.
 */

/** Un instantané plus gros que ça n'est pas un outil, c'est un dépôt. */
export const TAILLE_MAX = 256 * 1024

/**
 * Ce que le modèle sait composer, et qui n'a donc pas de squelette au
 * catalogue. Les identifiants viennent du moteur : recopiés ici, ils
 * finiraient par ne plus être les mêmes, et c'est la publication qui
 * refuserait — après coup, chez le destinataire.
 */
const COMPOSES: ReadonlySet<string> = new Set([ID_COMPOSE, ID_COMPOSE_CALCUL, ID_COMPOSE_PAGE])

export interface Depot {
  readonly lien: string
  readonly instantane: Instantane
}

export interface Verdict {
  readonly statut: number
  readonly corps: Record<string, unknown>
}

/** Ce qu'on relit dans KV pour décider : la version, et elle seule. */
export interface DejaLa {
  readonly version: number
}

function refus(statut: number, erreur: string, extra: Record<string, unknown> = {}): Verdict {
  return { statut, corps: { erreur, ...extra } }
}

/**
 * Le contrôle, sans le stockage.
 *
 * Séparé pour être éprouvé sans KV : ce qui décide ici est du calcul, et le
 * dépôt lui-même n'est qu'une écriture.
 */
export function controler(recu: unknown, detenu: DejaLa | null): Verdict | null {
  const d = recu as Partial<Depot> | undefined
  const lien = typeof d?.lien === 'string' ? d.lien : ''
  if (!lienValide(lien)) return refus(400, 'lien-invalide')

  const inst = d?.instantane
  if (inst === null || typeof inst !== 'object') return refus(400, 'instantane-absent')

  const skeleton = typeof inst.skeleton === 'string' ? inst.skeleton : ''
  if (!squeletteConnu(skeleton) && !COMPOSES.has(skeleton)) {
    return refus(400, 'squelette-inconnu')
  }

  /*
   * Le refus qui n'est pas technique.
   *
   * Une ardoise porte des noms et des dettes ; une recette de call-box dit ce
   * que quelqu'un gagne. Le contrôle est ici et non seulement dans l'écran :
   * un bouton grisé se contourne, une adresse publique ne se reprend pas.
   */
  if (!publiable(skeleton)) {
    return refus(403, 'non-publiable', { pourquoi: pourquoiNonPubliable(skeleton) })
  }

  const version = typeof inst.version === 'number' ? inst.version : Number.NaN
  if (!accepteLaVersion(version, detenu?.version ?? null)) {
    /*
     * 409 et non 400 : la requête est bien formée, c'est l'état du monde qui a
     * changé. Et la réponse **porte la version détenue** — sans elle, un
     * téléphone dont la file rejoue une vieille publication perd son travail
     * en silence (§ 2.7 de la lecture du brief). L'app peut alors poser la
     * question : reprendre celle du serveur, ou écraser.
     */
    return refus(409, 'version-perimee', { versionServeur: detenu?.version ?? null })
  }

  /*
   * Le dernier contrôle, et le plus tardif : est-ce que ça se dessine ?
   *
   * Les précédents portent sur la forme du dépôt ; celui-ci sur son contenu.
   * Un état auquel il manque ce que le document lit passait tous les autres,
   * puis faisait jeter le rendu **à la lecture** — le destinataire recevait la
   * page d'erreur de l'hébergeur, et l'envoyeur n'apprenait rien, puisque sa
   * publication avait répondu 200. Le refus appartient à la publication :
   * l'envoyeur est là, on peut le lui dire.
   *
   * Il vient en dernier parce qu'il coûte un rendu, et qu'il n'y a pas lieu de
   * le dépenser pour un lien mal formé ou une version périmée.
   */
  if (!rendable(inst as Instantane)) return refus(400, 'instantane-illisible')

  return null
}
