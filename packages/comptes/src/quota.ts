import { abonne } from './plan.js'
import type { Compte } from './plan.js'

/**
 * Le contrôle qui précède la dépense.
 *
 * Il tient en deux questions, et les deux se répondent sans réseau : cette
 * demande relève-t-elle de l'abonnement, et reste-t-il de quoi la payer ? La
 * première est tranchée par l'étage, que le moteur calcule gratuitement (§ 4) ;
 * la seconde par un entier.
 *
 * L'ordre n'est pas indifférent. Quelqu'un sans abonnement **et** sans crédit
 * s'entend dire « prends un abonnement » plutôt que « tu n'as plus de
 * crédits » : l'abonnement est la réponse aux deux à la fois, et le crédit ne
 * l'est qu'à moitié.
 *
 * Le contrôle est au serveur et non dans l'écran : un prix qu'on contourne avec
 * les outils de développement n'est pas un prix.
 */

export type Verdict =
  | { readonly sorte: 'passe' }
  | { readonly sorte: 'abonnement-requis'; readonly pourquoi: string }
  | { readonly sorte: 'credits-epuises'; readonly pourquoi: string }

const POURQUOI_ABONNEMENT =
  'Cette demande vaut plusieurs outils d’un coup. Compose-les un par un, ou prends un abonnement.'

const POURQUOI_ESSAI =
  'Tes compositions d’essai sont utilisées. L’abonnement en donne quarante par mois ; ' +
  'tout le reste de l’atelier continue de marcher sans rien payer.'

const POURQUOI_ATELIER =
  'Tes quarante compositions du mois sont utilisées. Reprends un mois pour les recharger : ' +
  'les jours qui te restent ne sont pas perdus, ils s’ajoutent.'

export function controlerQuota(compte: Compte, etage: number, maintenant: Date): Verdict {
  if (etage === 3 && !abonne(compte, maintenant)) {
    return { sorte: 'abonnement-requis', pourquoi: POURQUOI_ABONNEMENT }
  }
  if (compte.credits <= 0) {
    return {
      sorte: 'credits-epuises',
      pourquoi: abonne(compte, maintenant) ? POURQUOI_ATELIER : POURQUOI_ESSAI,
    }
  }
  return { sorte: 'passe' }
}

/** Le code HTTP d'un refus. 402 : il y a un prix, et il n'est pas payé. */
export function statutDe(verdict: Verdict): number {
  return verdict.sorte === 'passe' ? 200 : 402
}

/**
 * Ce qu'on retire après un appel qui a atteint le modèle.
 *
 * Un refus du modèle — « je ne peux pas créer un site internet » — a coûté des
 * jetons : il se paie. Ce qui ne se paie pas, c'est un appel qui n'est jamais
 * parti, refusé sur l'étage ou sur le quota. Ne pas décompter un refus
 * reviendrait à laisser une boucle de demandes impossibles dépenser sans fin.
 */
export function apresGeneration(compte: Compte): Compte {
  return { ...compte, credits: Math.max(0, compte.credits - 1) }
}
