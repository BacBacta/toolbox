/**
 * Les comptes : qui est là, ce qu'il a le droit de faire, et ce qu'il a payé.
 *
 * Tout ce qui décide est pur et vit dans `plan`, `quota` et `paiement` ; seul
 * `base` touche à D1. C'est ce partage qui permet d'éprouver la règle
 * économique sans base — dont l'idempotence du rejeu d'un rappel, que le § 7
 * fait le critère d'arrêt de la phase 3.
 */

export { CREDITS_ATELIER, CREDITS_ESSAI, DUREE_ABONNEMENT, PRIX_MENSUEL_XAF } from './plan.js'
export { abonne, apresPaiement, compteNeuf, planEffectif } from './plan.js'
export type { Compte, Plan } from './plan.js'

export { apresGeneration, controlerQuota, statutDe } from './quota.js'
export type { Verdict } from './quota.js'

export { codeLisible, empreinte, jetonValide, normaliserCode, tirerCode, tirerJeton } from './identite.js'

export { appliquerRappel, montantDuMois, normaliserTelephone } from './paiement.js'
export type { Amorce, DemandePaiement, EtatPaiement, Fournisseur, Paiement, Rappel, Suite } from './paiement.js'

export { ENTETE_SIGNATURE, fauxFournisseur, memeSignature, signer } from './faux.js'

export {
  compteDeLAppareil, compteParCode, compteParId, coutMoyenXaf, ecrireSuite, journaliser,
  ouvrirPaiement, paiementParId, paiementParReference, poserCode, prendreUnCredit,
  rattacherAppareil, rendreUnCredit,
} from './base.js'
export type { AppelIa, BaseD1, Requete } from './base.js'
