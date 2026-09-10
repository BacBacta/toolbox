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
export {
  PREFIXES_NUMERO, prefixeDe, prochainNumero, trouverAnomalies,
} from './compute/numerotation.js'
export type { Collecte, EtatNjangi, MembreNjangi, Periode } from './compute/njangi.js'
export {
  ajouterMembre, basculerVersement, beneficiaireDuTour, changerCotisation,
  classementFiabilite, collecte, estFiable, fiabilite, prochainTour,
  retirerMembre, SEUIL_FIABILITE,
} from './compute/njangi.js'
export { calculerLignes, montantAcompte } from './compute/tva.js'

export {
  anneeDe, arreteLe, coutF, dateCourte, dateLongue, dateLongueSiValide, ESPACE_INSECABLE,
  heureCourte, initiales, instantWAT, jourDeLaSemaineWAT, joursEntre, jourWAT, montantF, nf,
  normaliser,
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
export type {
  Diplome, EtatCv, Gabarit, IdentiteCv, LangueCv, ManqueCv, Poste,
} from './compute/cv.js'
export {
  GABARITS, INTITULES, SIGNES_PAR_PAGE, controleCv, debordeUnePage, signesCv,
} from './compute/cv.js'
export { cv, cvCard, cvShare } from './skeletons/cv.js'
export type { DetteClient, DetteVue, EtatArdoise, TotauxArdoise, Tranche } from './compute/ardoise.js'
export {
  JOURS_RETARD, MAX_DETTES, TRANCHES, ajouterDette, basculerReglee, chercher,
  joursOuverts, ordonner, retirerDette, totaux, vieillissement, vueDettes,
} from './compute/ardoise.js'
export { AVERTISSEMENT_ARDOISE, ardoise, ardoiseCard, ardoiseShare } from './skeletons/ardoise.js'
export { ardoiseSchema } from './schema/ardoise.js'
export type { AppelSeance, Assiduite, EtatPresence, Seance } from './compute/presence.js'
export {
  MAX_NOMS, MAX_SEANCES, SEUIL_ASSIDUITE, ajouterNom, appel, assiduites,
  basculerPresence, decroche, estPresent, nomSeance, nouvelleSeance, retirerNom,
} from './compute/presence.js'
export { derniereSeance, presence, presenceCard, presenceShare } from './skeletons/presence.js'
export { presenceSchema } from './schema/presence.js'
export type {
  EtatCallbox, JourneeCallbox, OperationCallbox, TotauxCallbox, TrancheCommission,
} from './compute/callbox.js'
export {
  MAX_OPERATIONS, MAX_TRANCHES, commissionDe, enregistrerOperation, fixerCommission,
  journees, operationsDuJour, resteAuClient, retirerOperation, totauxCallbox,
} from './compute/callbox.js'
export { callbox, callboxCard, callboxShare } from './skeletons/callbox.js'
export { callboxSchema } from './schema/callbox.js'
export type { ConflitVersion, Instantane } from './publication.js'
export {
  ALPHABET_LIEN, LONGUEUR_LIEN, NON_PUBLIABLES, accepteLaVersion, lienPublic,
  lienValide, pourquoiNonPubliable, publiable,
} from './publication.js'
export { cvSchema } from './schema/cv.js'
export { ID_COMPOSE_CALCUL } from './calcul.js'
export type { CalculDemande, EntreeDemandee } from './calcul.js'
export { MAX_ENTREES, schemaCalcul, verifierCalcul } from './calcul.js'
export { pourLeModele } from './schema-modele.js'
export type { ReponseModele } from './composition.js'
export { lireReponseModele } from './composition.js'
export type { Expression, Operation } from './expression.js'
export { DESCRIPTION_FORMULE, PROFONDEUR_MAX, evaluer, verifierExpression } from './expression.js'
export {
  ID_COMPOSE_PAGE, MAX_LIGNES_SECTION, MAX_SECTIONS, SECTIONS_POUR_SOMMAIRE,
  avecSommaire, carteDePage, direLeJour, partageDePage, schemaPage, sectionsAncrees,
  verifierPage,
} from './page.js'
export type {
  JourDit, LigneSection, PageDemande, SectionAncree, SectionDemandee, SorteSection,
} from './page.js'
export { ID_COMPOSE } from './registre.js'
/*
 * Les liens `wa.me` vivent dans le moteur et non dans l'application : le
 * serveur en a besoin aussi, pour le bouton d'une page publiée. C'est du calcul
 * sur des chaînes — aucune API de navigateur — et deux copies finiraient par ne
 * plus accepter les mêmes numéros.
 */
export { INDICATIF_CM, lienWhatsApp, numeroInternational, numeroLisible } from './whatsapp.js'
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
export { squeletteDeCalcul, squeletteDeRegistre } from './compose.js'
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
  CardItem, CardSpec, ComputeMap, Encre, EngineKind, ErreurValidation, JsonSchema, MontrerSi, ReglagesEcran,
  Ligne, LigneCalculee, Relance, RenderContext, BatirPartage, ShareSpec, Skeleton, SkeletonGroup,
  SkeletonAnonyme, SkeletonId, Totaux, XAF,
} from './types.js'

export { estValide, messageErreurs, valider } from './valider.js'
