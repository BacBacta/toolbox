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
}

export const CATALOGUE: readonly FicheSquelette[] = [
  {
    id: 'devis',
    group: 'documents',
    title: 'Devis',
    keywords: ['devis', 'proposition', 'chiffrage', 'estimation', 'cotation'],
  },
  {
    id: 'facture',
    group: 'documents',
    title: 'Facture',
    keywords: ['facture', 'facturation', 'note a payer', 'impaye', 'creance'],
  },
  {
    id: 'njangi',
    group: 'registres',
    title: 'Carnet de njangi',
    keywords: ['njangi', 'tontine', 'cotis', 'tour', 'membre', 'cagnotte'],
  },
  {
    id: 'prix',
    group: 'registres',
    title: 'Liste de prix',
    keywords: ['prix', 'tarif', 'catalogue', 'boutique', 'combien'],
  },
  {
    id: 'caisse',
    group: 'registres',
    title: 'Livre de caisse',
    keywords: ['caisse', 'recette', 'depense', 'entree sortie', 'journal'],
  },
  {
    id: 'stock',
    group: 'registres',
    title: 'Inventaire',
    keywords: ['stock', 'inventaire', 'magasin', 'reste', 'quantite'],
  },
  {
    id: 'clients',
    group: 'registres',
    title: 'Clients',
    keywords: ['client', 'contact', 'annuaire', 'repertoire', 'numero'],
  },
  {
    id: 'scolarite',
    group: 'calculs',
    title: 'Frais scolaires',
    keywords: ['scolarite', 'frais', 'ecole', 'pension', 'rentree'],
  },
  {
    id: 'course',
    group: 'calculs',
    title: 'Partage de course',
    keywords: ['course', 'moto', 'taxi', 'partage', 'diviser'],
  },
]

export function ficheParId(id: string): FicheSquelette | null {
  return CATALOGUE.find((f) => f.id === id) ?? null
}
