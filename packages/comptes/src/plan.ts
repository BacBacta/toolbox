/**
 * Ce qu'un compte a le droit de faire, et pour combien de temps.
 *
 * Tout est ici du calcul : on décide sans toucher au stockage, sans réseau, et
 * sans horloge à soi — l'instant se passe en argument, comme partout dans le
 * moteur. C'est ce qui rend la règle économique éprouvable, et c'est aussi ce
 * qui l'empêche de dériver : le prix se décide au même endroit que l'étage.
 *
 * Deux plans, pas trois. « Un essai qui ne demande rien, puis un abonnement
 * mensuel » tient dans une phrase qu'on peut dire au téléphone à quelqu'un qui
 * vend des tôles ; une grille à cinq lignes ne se dit pas.
 */

export type Plan = 'essai' | 'atelier'

/** Ce qu'on donne pour essayer, sans rien demander ni faire payer. */
export const CREDITS_ESSAI = 5

/** Ce que l'abonnement mensuel recharge. */
export const CREDITS_ATELIER = 40

/** Trente jours, en millisecondes. */
export const DUREE_ABONNEMENT = 30 * 24 * 60 * 60 * 1000

/** Le prix du mois, en francs CFA. */
export const PRIX_MENSUEL_XAF = 1000

export interface Compte {
  readonly id: string
  readonly plan: Plan
  /** Épuisement de l'abonnement, en ms depuis l'époque. `null` pour l'essai. */
  readonly planExpire: number | null
  readonly credits: number
}

/**
 * L'abonnement court-il encore ?
 *
 * Un abonnement expiré n'est pas une erreur : c'est un compte qui redevient un
 * essai, sans rien perdre. Les outils vivent sur le téléphone (§ 2.7) et les
 * publications restent en ligne ; ce qui s'arrête, c'est la composition par le
 * modèle, la seule chose qui coûte de l'argent à chaque usage.
 */
export function abonne(compte: Compte, maintenant: Date): boolean {
  if (compte.plan !== 'atelier') return false
  return compte.planExpire !== null && compte.planExpire > maintenant.getTime()
}

/** Le plan tel qu'il vaut aujourd'hui, expiration comprise. */
export function planEffectif(compte: Compte, maintenant: Date): Plan {
  return abonne(compte, maintenant) ? 'atelier' : 'essai'
}

/** Ce que devient un compte quand un paiement aboutit. */
export function apresPaiement(compte: Compte, maintenant: Date): Compte {
  /*
   * L'abonnement se prolonge, il ne se remplace pas.
   *
   * Payer le 20 quand on est couvert jusqu'au 30 ajoute trente jours au 30, pas
   * au 20 : personne ne doit perdre dix jours pour avoir payé en avance. Un
   * abonnement échu, lui, repart d'aujourd'hui — on ne rattrape pas le passé.
   */
  const depart = Math.max(compte.planExpire ?? 0, maintenant.getTime())
  return {
    ...compte,
    plan: 'atelier',
    planExpire: depart + DUREE_ABONNEMENT,
    // Les crédits se rechargent au plein, sans s'additionner : l'abonnement
    // paie un mois d'usage, pas un stock qu'on accumule en payant d'avance.
    credits: CREDITS_ATELIER,
  }
}

/** Un compte neuf, tel qu'il naît au premier appareil qui se présente. */
export function compteNeuf(id: string): Compte {
  return { id, plan: 'essai', planExpire: null, credits: CREDITS_ESSAI }
}
