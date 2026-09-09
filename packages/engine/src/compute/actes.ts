import type { Emetteur, Manquement } from '@a237/legal-cm'
import { mentionsManquantes } from '@a237/legal-cm'
import type { Encre, XAF } from '../types.js'
import type { Date0 } from './document.js'

/**
 * Les actes et les lettres : ce que le brief appelle des documents A4 sans être
 * des documents d'affaires.
 *
 * Devis et facture engagent l'entreprise devant la DGI, portent la TVA et un
 * tableau de lignes taxées. Ces quatre-là non. L'attestation et le reçu sortent
 * bien d'une entreprise et gardent son entête légal ; la reconnaissance de
 * dette et la lettre de motivation sont des actes entre personnes, et un entête
 * RCCM sur une lettre de motivation serait une faute de registre.
 *
 * Ils sont regroupés ici pour la même raison que les quatre registres de
 * `skeletons/registres.ts` : chacun tient en vingt lignes, et quatre fichiers
 * de vingt lignes se copient les uns sur les autres avant de diverger.
 */

// ────────────────────────────── attestation ──────────────────────────────

/**
 * L'attestation : une entreprise certifie un fait.
 *
 * Ce qui la rend recevable, c'est l'entête légal — sans raison sociale ni RCCM,
 * une attestation ne prouve rien de plus qu'un mot manuscrit. Le corps reste
 * libre : la loi n'en impose pas la forme, et le prototype porte le texte type.
 */
export interface EtatAttestation extends Date0 {
  readonly nom: string
  readonly encre: Encre
  readonly numero: string
  readonly emetteur: Emetteur
  /** « Attestation de travail », « Attestation de résidence »… */
  readonly objet: string
  readonly texte: string
}

// ───────────────────────────────── reçu ─────────────────────────────────

export interface LigneRecu {
  readonly designation: string
  readonly montant: XAF
}

/**
 * Le reçu atteste d'un **paiement reçu**, là où la facture réclame un paiement
 * dû. Il ne porte donc pas de TVA ligne par ligne : la taxe a été traitée sur
 * la facture, et la répéter ici ferait croire à une seconde opération.
 */
export interface EtatRecu extends Date0 {
  readonly nom: string
  readonly encre: Encre
  readonly numero: string
  readonly emetteur: Emetteur
  readonly recuDe: string
  readonly lignes: readonly LigneRecu[]
  /** Ce qui a été effectivement versé ce jour. */
  readonly avance: XAF
}

export interface TotauxRecu {
  readonly total: XAF
  readonly avance: XAF
  readonly reste: XAF
}

/**
 * Le compte du reçu.
 *
 * `reste` ne descend jamais sous zéro : un client qui verse plus que dû a un
 * crédit, pas une dette négative, et « −5 000 F à payer » sur un papier signé
 * est le genre de phrase qu'on ne peut plus expliquer une fois qu'elle est
 * imprimée.
 */
export function totauxRecu(etat: EtatRecu): TotauxRecu {
  const total = etat.lignes.reduce((a, l) => a + Math.max(0, Math.round(l.montant)), 0)
  const avance = Math.max(0, Math.round(etat.avance))
  return { total, avance, reste: Math.max(0, total - avance) }
}

/** Ce qui manque à un document d'entreprise sans destinataire identifié. */
export function controleEmetteur(doc: { readonly emetteur: Emetteur }): Manquement[] {
  return mentionsManquantes(doc.emetteur)
}

// ───────────────────────── reconnaissance de dette ─────────────────────────

/** Une partie à l'acte, avec la pièce qui l'identifie. */
export interface Partie {
  readonly nom: string
  /** « CNI n° 118 442 907 », « Passeport n° … ». */
  readonly piece: string
}

/**
 * La reconnaissance de dette, acte sous seing privé.
 *
 * Le brief § 5 en fixe deux exigences, vérifiées à la source : **le montant en
 * toutes lettres** et la mention **« Lu et approuvé »**. Les deux existent pour
 * la même raison — rendre un chiffre non falsifiable après signature. Un « 1 »
 * devient « 100 000 » d'un trait de stylo ; « cent mille francs » ne se rallonge
 * pas.
 */
export interface EtatDette extends Date0 {
  readonly nom: string
  readonly encre: Encre
  readonly emprunteur: Partie
  readonly preteur: Partie
  readonly montant: XAF
  readonly echeance: string
  readonly lieu: string
  readonly texte: string
}

export interface ManqueActe {
  readonly champ: string
  readonly libelle: string
}

/**
 * Ce qui manque à une reconnaissance de dette pour être opposable.
 *
 * Ce n'est pas `mentionsManquantes` : il n'y a pas d'entreprise ici, donc ni
 * NIU ni RCCM. Ce qu'un juge cherche, c'est l'identité des deux parties, un
 * montant, une échéance et un lieu. Sans la pièce d'identité, la partie n'est
 * pas identifiée ; sans échéance, la créance n'est pas exigible.
 */
export function controleDette(etat: EtatDette): ManqueActe[] {
  const manque: ManqueActe[] = []
  const vide = (s: string): boolean => s.trim() === ''

  if (vide(etat.emprunteur.nom)) manque.push({ champ: '$.emprunteur.nom', libelle: 'nom de l’emprunteur' })
  if (vide(etat.emprunteur.piece)) manque.push({ champ: '$.emprunteur.piece', libelle: 'pièce d’identité de l’emprunteur' })
  if (vide(etat.preteur.nom)) manque.push({ champ: '$.preteur.nom', libelle: 'nom du prêteur' })
  if (vide(etat.preteur.piece)) manque.push({ champ: '$.preteur.piece', libelle: 'pièce d’identité du prêteur' })
  if (etat.montant <= 0) manque.push({ champ: '$.montant', libelle: 'montant du prêt' })
  if (vide(etat.echeance)) manque.push({ champ: '$.echeance', libelle: 'échéance de remboursement' })
  if (vide(etat.lieu)) manque.push({ champ: '$.lieu', libelle: 'lieu de signature' })

  return manque
}

// ───────────────────────── lettre de motivation ─────────────────────────

export interface Expediteur {
  readonly nom: string
  readonly tel: string
  readonly mail: string
  readonly ville: string
}

/**
 * La lettre de motivation.
 *
 * C'est le document le plus proche d'une page blanche, et c'est justement là
 * que le squelette gagne son intérêt : il impose la disposition française —
 * expéditeur en haut à gauche, destinataire à droite, lieu et date, objet
 * souligné, formule de politesse, signature à droite. Un recruteur de Douala
 * reconnaît une lettre mal disposée avant d'en lire la première ligne.
 */
export interface EtatMotivation extends Date0 {
  readonly nom: string
  readonly encre: Encre
  readonly expediteur: Expediteur
  /** Adresse du destinataire, telle qu'elle s'écrit — plusieurs lignes. */
  readonly destinataire: string
  readonly objet: string
  readonly corps: string
}
