import { PRIX_MENSUEL_XAF, apresPaiement } from './plan.js'
import type { Compte } from './plan.js'

/**
 * Encaisser, sans dépendre de qui encaisse.
 *
 * Le brief (§ 3.2) veut deux fournisseurs derrière une même interface, pour
 * pouvoir en changer sans réécrire : CamPay et Fapshi font tous deux MTN Mobile
 * Money et Orange Money, et aucun des deux n'est sûr d'exister dans deux ans.
 * Ce qui est ici ne connaît donc aucun des deux — seulement ce qu'un
 * fournisseur doit savoir faire.
 *
 * Tout ce qui décide est pur : ce qui arrive par le rappel est une donnée, et
 * ce qu'on en fait se calcule. C'est ce qui permet d'éprouver l'idempotence
 * sans base — rejouer trois fois le même rappel ne doit rien changer, et le
 * § 7 en fait le critère d'arrêt de la phase 3.
 */

export type EtatPaiement = 'attente' | 'reussi' | 'echoue'

export interface Paiement {
  readonly id: string
  readonly compteId: string
  readonly fournisseur: string
  /** La référence du fournisseur. C'est elle qui porte l'unicité. */
  readonly reference: string
  readonly montantXaf: number
  readonly etat: EtatPaiement
  readonly telephone: string
  readonly creeLe: number
}

/** Ce qu'un fournisseur dit quand on lui demande d'encaisser. */
export interface Amorce {
  readonly reference: string
  /** Ce que l'utilisateur doit faire maintenant, dans ses mots. */
  readonly consigne: string
}

export interface DemandePaiement {
  readonly telephone: string
  readonly montantXaf: number
  /** Notre identifiant, que le fournisseur nous rendra dans son rappel. */
  readonly reference: string
}

/** Ce qu'on retient d'un rappel, une fois sa signature vérifiée. */
export interface Rappel {
  readonly reference: string
  readonly reussi: boolean
  readonly montantXaf: number
}

export interface Fournisseur {
  readonly nom: string
  demarrer(demande: DemandePaiement): Promise<Amorce>
  /**
   * Lit un rappel **et vérifie sa signature**. Rend `null` si la signature ne
   * tient pas : sans elle, n'importe qui offre des abonnements avec `curl`.
   */
  lireRappel(corps: string, entetes: Headers): Promise<Rappel | null>
}

export type Suite =
  /** Aucun paiement ne porte cette référence : rappel égaré ou forgé. */
  | { readonly sorte: 'inconnu' }
  /** Déjà tranché. Rejouer ne change rien — c'est tout l'objet de ce cas. */
  | { readonly sorte: 'deja-traite'; readonly etat: EtatPaiement }
  | { readonly sorte: 'reussi'; readonly paiement: Paiement; readonly compte: Compte }
  | { readonly sorte: 'echoue'; readonly paiement: Paiement; readonly pourquoi: string }

/**
 * Ce que devient le monde quand un rappel arrive.
 *
 * Deux verrous contre le rejeu, et il en faut deux. Le premier est dans la
 * base — `UNIQUE(fournisseur, reference)` empêche deux lignes. Le second est
 * ici : un paiement qui n'est plus en attente ne se retranche pas. Sans lui,
 * trois rappels identiques donneraient quatre-vingt-dix jours d'abonnement.
 */
export function appliquerRappel(
  paiement: Paiement | null,
  compte: Compte,
  rappel: Rappel,
  maintenant: Date,
): Suite {
  if (paiement === null) return { sorte: 'inconnu' }
  if (paiement.etat !== 'attente') return { sorte: 'deja-traite', etat: paiement.etat }

  if (!rappel.reussi) {
    return {
      sorte: 'echoue',
      paiement: { ...paiement, etat: 'echoue' },
      pourquoi: 'Le paiement n’a pas abouti.',
    }
  }

  /*
   * Le montant se revérifie, même signé.
   *
   * Un fournisseur peut accepter un versement partiel, et le rappel serait
   * alors authentique et insuffisant. Créditer un mois pour cent francs sur
   * mille tiendrait à la confiance qu'on met dans le compte d'un autre.
   */
  if (rappel.montantXaf < paiement.montantXaf) {
    return {
      sorte: 'echoue',
      paiement: { ...paiement, etat: 'echoue' },
      pourquoi: `Reçu ${rappel.montantXaf} F sur ${paiement.montantXaf} F attendus.`,
    }
  }

  return {
    sorte: 'reussi',
    paiement: { ...paiement, etat: 'reussi' },
    compte: apresPaiement(compte, maintenant),
  }
}

/** Ce qu'on demande pour un mois. Un seul montant : il n'y a qu'un plan. */
export function montantDuMois(): number {
  return PRIX_MENSUEL_XAF
}

/**
 * Le numéro tel qu'on l'accepte : format international, opérateurs camerounais.
 *
 * `+237 6XX XX XX XX` — neuf chiffres après l'indicatif, commençant par 6
 * depuis le passage à neuf chiffres. On normalise plutôt que de refuser : les
 * gens écrivent leur numéro avec des espaces, des points, un zéro devant, ou
 * sans indicatif du tout.
 */
export function normaliserTelephone(saisi: string): string | null {
  const chiffres = saisi.replace(/[\s.\-()]/g, '').replace(/^\+/, '')
  const sansIndicatif = chiffres.startsWith('237') ? chiffres.slice(3) : chiffres
  const national = sansIndicatif.replace(/^0+/, '')
  if (!/^6\d{8}$/.test(national)) return null
  return `+237${national}`
}
