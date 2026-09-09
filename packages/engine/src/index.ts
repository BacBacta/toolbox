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

export type { Etage } from './etage.js'
export { CE_QUE_COUTE, etageDe } from './etage.js'
export type { Comprehension } from './comprendre.js'
export { comprendre } from './comprendre.js'
export type { Extrait } from './extraire.js'
export { EXTRAIT_VIDE, extraire } from './extraire.js'
export type {
  EtatAttestation, EtatDette, EtatMotivation, EtatRecu, Expediteur, LigneRecu,
  ManqueActe, Partie, TotauxRecu,
} from './compute/actes.js'
export { controleDette, controleEmetteur, totauxRecu } from './compute/actes.js'
export {
  ACTES, PREFIXE_ATTESTATION, PREFIXE_RECU, attestation, attestationCard,
  attestationShare, dette, detteCard, detteShare, motivation, motivationCard,
  motivationShare, recu, recuCard, recuShare,
} from './skeletons/actes.js'
export {
  attestationSchema, detteSchema, motivationSchema, recuSchema,
} from './schema/actes.js'
export type { CalculDemande, EntreeDemandee } from './calcul.js'
export { MAX_ENTREES, schemaCalcul, verifierCalcul } from './calcul.js'
export type { ReponseModele } from './composition.js'
export { lireReponseModele } from './composition.js'
export type { Expression, Operation } from './expression.js'
export { DESCRIPTION_FORMULE, PROFONDEUR_MAX, evaluer, verifierExpression } from './expression.js'
export type { ColonneDemandee, RefusModele, RegistreDemande } from './registre.js'
export { MAX_COLONNES, schemaRefus, schemaRegistre, verifierRegistre } from './registre.js'
export type { AvecMotsClefs, Correspondance } from './match.js'
export { classer, trouverSquelette } from './match.js'

export { clientSchema, emetteurSchema, encreSchema, lignesSchema } from './schema/commun.js'
export { devisSchema } from './schema/devis.js'
export { factureSchema, MOYENS_PAIEMENT, reglementSchema } from './schema/facture.js'
export { njangiSchema } from './schema/njangi.js'

export type {
  Colonne, ConfigListe, EtatListe, LigneListe, TotalListe, TypeColonne, ValeurCellule,
} from './compute/liste.js'
export {
  ajouterLigne, basculerLigne, booleenDe, colonneBascule, colonneIdentite,
  colonnesSecondaires, comptageBascule, lignesEnAlerte, ligneNeuve, nombreDe,
  retirerLigne, schemaListe, texteDe, totalListe,
} from './compute/liste.js'
export { cellule, squeletteListe } from './skeletons/liste.js'
export type { DefinitionListe, SqueletteListe } from './skeletons/liste.js'
export { REGISTRES_LISTE } from './skeletons/registres.js'
export type { ConfigCalc, EntreeCalc, EtatCalc, LecteurValeurs, Valeurs } from './compute/calc.js'
export {
  changerValeur, partCalc, precisionCalc, resultatCalc, schemaCalc, valeurDe,
  valeursParDefaut,
} from './compute/calc.js'
export { squeletteCalc } from './skeletons/calc.js'
export type { DefinitionCalc, SqueletteCalc } from './skeletons/calc.js'
export { CALCULATRICES } from './skeletons/calculs.js'
export {
  caisse, clients, course, devis, facture, njangi, prix, scolarite, SQUELETTES,
  squeletteParId, stock,
} from './skeletons/index.js'

export type {
  CardItem, CardSpec, ComputeMap, Encre, EngineKind, ErreurValidation, JsonSchema,
  Ligne, LigneCalculee, Relance, RenderContext, ShareSpec, Skeleton, SkeletonGroup,
  SkeletonAnonyme, SkeletonId, Totaux, XAF,
} from './types.js'

export { estValide, messageErreurs, valider } from './valider.js'
