import type { CalculDemande } from './calcul.js'
import type { RegistreDemande } from './registre.js'

/**
 * La publication : ce qui quitte le téléphone, et ce qui n'en sort jamais.
 *
 * Publier, c'est déposer un instantané en lecture seule derrière un lien court,
 * pour qu'un client ouvre un devis au lieu de recevoir une image. C'est le seul
 * moment où l'état d'un outil sort de l'appareil (invariant § 2.7), et il ne
 * sort pas pour tout le monde.
 */

/**
 * L'alphabet des liens : base32 sans les caractères qui se confondent.
 *
 * Ni `I` ni `1`, ni `O` ni `0`, ni `U` — qui se lit `V` sur un écran fissuré et
 * qui, mal placé, fabrique des mots qu'on ne veut pas voir dans un lien envoyé
 * à un client. Un lien se lit à voix haute au téléphone, se recopie à la main,
 * et s'écrit sur un cahier : ce qui ne se distingue pas ne va pas dedans.
 */
export const ALPHABET_LIEN = '23456789ABCDEFGHJKLMNPQRSTVWXYZ'

/**
 * Douze caractères, et non quatre.
 *
 * Le prototype proposait un identifiant de quatre caractères : un million de
 * combinaisons, c'est-à-dire une liste énumérable en une soirée. Acceptable
 * pour une liste de prix, inacceptable pour une facture — qui porte un nom de
 * client, une adresse et des montants. Douze caractères font 3 × 10^17
 * combinaisons ; le lien reste court à l'œil et cesse d'être devinable.
 */
export const LONGUEUR_LIEN = 12

const MOTIF_LIEN = new RegExp(`^[${ALPHABET_LIEN}]{${LONGUEUR_LIEN}}$`)

export function lienValide(lien: string): boolean {
  return MOTIF_LIEN.test(lien)
}

/**
 * Le lien tel qu'il s'écrit sur une carte et dans une relance.
 *
 * Sans schéma : `atelier237.pages.dev/d/K7M2XQ4BN9PZ` tient sur une ligne de
 * carte et se colle dans WhatsApp, qui le rend cliquable tout seul.
 */
export function lienPublic(hote: string, lien: string): string {
  return `${hote}/d/${lien}`
}

/**
 * Ce qui est déposé, et rien d'autre.
 *
 * L'instantané ne porte pas d'identifiant d'appareil, pas de compte, pas de
 * date de dernière ouverture : ce qui n'est pas nécessaire à l'affichage ne
 * traverse pas le réseau.
 */
export interface Instantane {
  readonly skeleton: string
  readonly nom: string
  readonly etat: unknown
  /** La configuration d'un registre composé, quand il n'y a pas de squelette. */
  readonly registre?: RegistreDemande
  readonly calcul?: CalculDemande
  /**
   * Version monotone de l'outil. Le serveur refuse une version inférieure ou
   * égale à celle qu'il détient : un vieux téléphone n'écrase pas une
   * publication plus récente (§ 3.5).
   */
  readonly version: number
  /** Instant du dépôt, ISO 8601. Affiché en pied de page de lecture. */
  readonly publieLe: string
}

/**
 * Les outils qui ne se publient pas, et pourquoi.
 *
 * Publier, c'est mettre derrière une adresse que n'importe qui peut ouvrir.
 * Deux cahiers n'ont rien à y faire, et ce n'est pas une question de réglage :
 *
 * - **l'ardoise** porte des noms de clients et ce qu'ils doivent. Le brief
 *   l'interdit déjà en groupe (§ 2.5) au motif que c'est de l'humiliation ;
 *   la mettre à une adresse publique serait la même chose en pire, puisque le
 *   lien circule sans qu'on sache où ;
 * - **le call-box** dit la recette du jour. Ce que quelqu'un gagne ne se
 *   publie pas, ni pour ses concurrents, ni pour ceux qui passent devant la
 *   cabine.
 *
 * Ils gardent leur carte et leurs relances individuelles : ce qui leur est
 * retiré, c'est l'adresse publique, pas l'usage.
 */
export const NON_PUBLIABLES: readonly string[] = ['ardoise', 'callbox']

export function publiable(skeleton: string): boolean {
  return !NON_PUBLIABLES.includes(skeleton)
}

/** Pourquoi un outil ne se publie pas, dit à celui qui essaie. */
export function pourquoiNonPubliable(skeleton: string): string | null {
  if (skeleton === 'ardoise') {
    return 'Une ardoise ne se publie pas : elle porte des noms et des dettes. Sa carte est pour toi, et les relances partent une par une.'
  }
  if (skeleton === 'callbox') {
    return 'La recette du jour ne se publie pas. Garde la carte pour toi ou pour ton patron.'
  }
  return null
}

/** Ce que le serveur répond quand la version envoyée est périmée. */
export interface ConflitVersion {
  readonly erreur: 'version-perimee'
  /** La version que le serveur détient, pour que l'app puisse trancher. */
  readonly versionServeur: number
}

/**
 * Une publication est-elle acceptable ?
 *
 * Strictement supérieure, et non supérieure ou égale : republier la même
 * version est un rejeu de la file d'attente hors ligne, pas une nouveauté.
 */
export function accepteLaVersion(recue: number, detenue: number | null): boolean {
  if (!Number.isSafeInteger(recue) || recue < 1) return false
  return detenue === null || recue > detenue
}
