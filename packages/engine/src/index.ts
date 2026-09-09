export { limiterItems, MAX_ITEMS_CARTE, texteReste } from './cardspec.js'
export type { ItemsCarte } from './cardspec.js'

export type { ChiffrageDevis, EtatDevis } from './compute/devis.js'
export { chiffrer, controleLegal, dateEmission } from './compute/devis.js'
export type { Collecte, EtatNjangi, MembreNjangi, Periode } from './compute/njangi.js'
export {
  beneficiaireDuTour, classementFiabilite, collecte, fiabilite, prochainTour,
} from './compute/njangi.js'
export { calculerLignes, montantAcompte } from './compute/tva.js'

export {
  anneeDe, arreteLe, dateCourte, dateLongue, ESPACE_INSECABLE, heureCourte,
  initiales, montantF, nf, normaliser,
} from './format.js'

export { lettres, montantEnLettres } from './lettres.js'

export type { AvecMotsClefs, Correspondance } from './match.js'
export { classer, trouverSquelette } from './match.js'

export { clientSchema, devisSchema, emetteurSchema } from './schema/devis.js'
export { njangiSchema } from './schema/njangi.js'

export { devis, njangi, SQUELETTES, squeletteParId } from './skeletons/index.js'

export type {
  CardItem, CardSpec, ComputeMap, Encre, EngineKind, ErreurValidation, JsonSchema,
  Ligne, LigneCalculee, Relance, RenderContext, ShareSpec, Skeleton, SkeletonGroup,
  SkeletonAnonyme, SkeletonId, Totaux, XAF,
} from './types.js'

export { estValide, messageErreurs, valider } from './valider.js'
