export { CATALOGUE, ficheParId } from './catalogue.js'
export type { FicheSquelette } from './catalogue.js'
export { limiterItems, MAX_ITEMS_CARTE, texteReste } from './cardspec.js'
export type { ItemsCarte } from './cardspec.js'

export type { Client, Emetteur, Gravite, Manquement } from '@a237/legal-cm'
export {
  estNiuBienForme, estRccmBienForme, LIBELLE_TVA_CM, mentionsManquantes, piedLegal,
  TAUX_TVA_CM, tvaSur,
} from '@a237/legal-cm'
export type { Date0, Parties } from './compute/document.js'
export { controleLegal, dateEmission, dateIso } from './compute/document.js'
export type { ChiffrageDevis, EtatDevis } from './compute/devis.js'
export { chiffrer } from './compute/devis.js'
export type {
  ChiffrageFacture, EtatFacture, MoyenPaiement, Reglement, StatutFacture,
} from './compute/facture.js'
export {
  chiffrerFacture, dateEcheance, joursDeRetard, LIBELLE_MOYEN, LIBELLE_STATUT,
  statutFacture,
} from './compute/facture.js'
export { prochainNumero, trouverAnomalies } from './compute/numerotation.js'
export type { Collecte, EtatNjangi, MembreNjangi, Periode } from './compute/njangi.js'
export {
  ajouterMembre, basculerVersement, beneficiaireDuTour, changerCotisation,
  classementFiabilite, collecte, estFiable, fiabilite, prochainTour,
  retirerMembre, SEUIL_FIABILITE,
} from './compute/njangi.js'
export { calculerLignes, montantAcompte } from './compute/tva.js'

export {
  anneeDe, arreteLe, dateCourte, dateLongue, ESPACE_INSECABLE, heureCourte,
  initiales, joursEntre, montantF, nf, normaliser,
} from './format.js'

export { lettres, montantEnLettres } from './lettres.js'

export type { AvecMotsClefs, Correspondance } from './match.js'
export { classer, trouverSquelette } from './match.js'

export { clientSchema, emetteurSchema, encreSchema, lignesSchema } from './schema/commun.js'
export { devisSchema } from './schema/devis.js'
export { factureSchema, MOYENS_PAIEMENT, reglementSchema } from './schema/facture.js'
export { njangiSchema } from './schema/njangi.js'

export { devis, facture, njangi, SQUELETTES, squeletteParId } from './skeletons/index.js'

export type {
  CardItem, CardSpec, ComputeMap, Encre, EngineKind, ErreurValidation, JsonSchema,
  Ligne, LigneCalculee, Relance, RenderContext, ShareSpec, Skeleton, SkeletonGroup,
  SkeletonAnonyme, SkeletonId, Totaux, XAF,
} from './types.js'

export { estValide, messageErreurs, valider } from './valider.js'
