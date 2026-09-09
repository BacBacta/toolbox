import type { SkeletonGroup, SkeletonId } from './types.js'

/**
 * Le catalogue : ce que la coquille a besoin de savoir des squelettes, et rien
 * de plus.
 *
 * Des données pures, aucune fonction, aucun schéma. Importer `SQUELETTES` pour
 * dresser une liste tirerait dans le fragment de départ les dix-sept schémas,
 * tous les calculs et tous les constructeurs de carte — pour afficher des
 * titres. Le catalogue pèse quelques centaines d'octets ; la définition
 * complète d'un squelette n'arrive qu'avec le fragment de l'outil qu'on ouvre.
 *
 * Un test vérifie que le catalogue et les squelettes disent la même chose : deux
 * listes qui se répètent finissent toujours par se contredire.
 */
export interface FicheSquelette {
  readonly id: SkeletonId
  readonly group: SkeletonGroup
  readonly title: string
  readonly keywords: readonly string[]
  /**
   * Le signe qui distingue l'outil dans la grille d'accueil.
   *
   * Des formes géométriques, comme dans le prototype : aucune police à charger,
   * aucune image, et elles se distinguent à quatorze pixels. Des initiales ne
   * marchaient pas — « Liste de prix » et « Livre de caisse » donnaient toutes
   * deux « LD ».
   *
   * Choisies dans le bloc Formes géométriques, qui s'affiche en style texte
   * partout : un glyphe rendu en émoji chez l'un et en trait chez l'autre ne
   * serait plus le même repère.
   */
  readonly glyphe: string
}

export const CATALOGUE: readonly FicheSquelette[] = [
  {
    id: 'devis',
    glyphe: '▤',
    group: 'documents',
    title: 'Devis',
    keywords: ['devis', 'proposition', 'chiffrage', 'estimation', 'cotation', 'pro forma', 'proforma', 'offre de prix', 'ca va couter'],
  },
  {
    id: 'facture',
    glyphe: '▥',
    group: 'documents',
    title: 'Facture',
    keywords: ['facture', 'facturation', 'note a payer', 'impaye', 'creance', 'facturer', 'reclamer mon argent', 'doit me payer'],
  },
  {
    id: 'attestation',
    glyphe: '◈',
    group: 'documents',
    title: 'Attestation',
    keywords: ['attestation', 'certificat', 'preuve emploi', 'travail', 'attestation de travail', 'certifier', 'temoignage ecrit'],
  },
  {
    id: 'recu',
    glyphe: '▭',
    group: 'documents',
    title: 'Reçu',
    keywords: ['recu', 'quittance', 'acompte', 'j ai recu', 'preuve de paiement', 'versement recu'],
  },
  {
    id: 'dette',
    glyphe: '◧',
    group: 'documents',
    title: 'Reconnaissance de dette',
    keywords: ['reconnaissance', 'reconnaissance de dette', 'dette ecrite', 'pret', 'emprunt', 'j ai prete', 'papier de dette', 'engagement ecrit'],
  },
  {
    id: 'motivation',
    glyphe: '▰',
    group: 'documents',
    title: 'Lettre de motivation',
    keywords: ['lettre', 'motivation', 'lettre de motivation', 'demande d emploi', 'candidature', 'postuler', 'demande de stage'],
  },
  {
    id: 'njangi',
    glyphe: '◉',
    group: 'registres',
    title: 'Carnet de njangi',
    keywords: ['njangi', 'djangi', 'tontine', 'cotis', 'tour', 'membre', 'cagnotte', 'epargne', 'association', 'reunion'],
  },
  {
    id: 'prix',
    glyphe: '≡',
    group: 'registres',
    title: 'Liste de prix',
    keywords: ['prix', 'tarif', 'catalogue', 'boutique', 'ca coute combien', 'liste de prix', 'ce que je vends', 'mes articles', 'menu'],
  },
  {
    id: 'caisse',
    glyphe: '▣',
    group: 'registres',
    title: 'Livre de caisse',
    keywords: ['caisse', 'recette', 'depense', 'entree sortie', 'journal', 'argent du jour', 'ce que j ai vendu', 'livre de compte'],
  },
  {
    id: 'stock',
    glyphe: '▦',
    group: 'registres',
    title: 'Inventaire',
    keywords: ['stock', 'inventaire', 'magasin', 'quantite', 'marchandise', 'ce qui me reste', 'reappro'],
  },
  {
    id: 'clients',
    glyphe: '◇',
    group: 'registres',
    title: 'Clients',
    keywords: ['client', 'contact', 'annuaire', 'repertoire', 'numero', 'carnet d adresses', 'mes contacts'],
  },
  {
    id: 'scolarite',
    glyphe: '◪',
    group: 'calculs',
    title: 'Frais scolaires',
    keywords: ['scolarite', 'frais', 'ecole', 'pension', 'rentree', 'inscription', 'fournitures', 'eleve'],
  },
  {
    id: 'course',
    glyphe: '▲',
    group: 'calculs',
    title: 'Partage de course',
    keywords: ['course', 'moto', 'taxi', 'partage', 'diviser', 'benskin', 'chacun paye', 'partager la note', 'addition'],
  },
]

export function ficheParId(id: string): FicheSquelette | null {
  return CATALOGUE.find((f) => f.id === id) ?? null
}
