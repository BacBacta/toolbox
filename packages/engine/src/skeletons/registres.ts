import type { ConfigListe } from '../compute/liste.js'
import { squeletteListe } from './liste.js'

/**
 * Les registres qui ne sont que des colonnes.
 *
 * Aucun de ces quatre outils n'a une ligne de logique propre : ils déclarent
 * leurs colonnes, et la fabrique fait le reste — schéma, validation, calculs,
 * carte, partage, et jusqu'au formulaire d'édition, qui se dresse à partir du
 * schéma dérivé de ces colonnes.
 *
 * C'est le meilleur argument qu'on ait pour la thèse du brief : ajouter un
 * cinquième registre de ce genre coûtera vingt lignes de description.
 */

const CAISSE: ConfigListe = {
  kicker: 'LIVRE DE CAISSE',
  colonnes: [
    { clef: 'libelle', titre: 'Libellé', type: 'texte' },
    { clef: 'entree', titre: 'Entrée (F CFA)', type: 'montant' },
    { clef: 'sortie', titre: 'Sortie (F CFA)', type: 'montant' },
  ],
  total: { type: 'difference', plus: 'entree', moins: 'sortie', libelle: 'Solde' },
  libelleVide: 'Aucune écriture pour l’instant.',
  libelleAjout: 'Ajouter une écriture',
  relancesVides: 'Un livre de caisse se tient, il ne se relance pas.',
}

export const caisse = squeletteListe({
  id: 'caisse',
  title: 'Livre de caisse',
  group: 'registres',
  keywords: ['caisse', 'recette', 'depense', 'entree sortie', 'journal'],
  titreNom: 'Nom du livre',
  config: CAISSE,
})

const STOCK: ConfigListe = {
  kicker: 'INVENTAIRE',
  colonnes: [
    { clef: 'article', titre: 'Article', type: 'texte' },
    { clef: 'reste', titre: 'Quantité restante', type: 'nombre' },
  ],
  total: { type: 'somme', clef: 'reste', libelle: 'Articles', unite: '' },
  // Cinq est le seuil du prototype. C'est une valeur d'affichage, pas une règle
  // de gestion : elle colore une ligne, elle ne commande aucune décision.
  alerte: { clef: 'reste', seuil: 5, libelle: 'à réapprovisionner' },
  libelleVide: 'L’inventaire est vide.',
  libelleAjout: 'Ajouter un article',
  relancesVides: 'Un inventaire se consulte, il ne se relance pas.',
}

export const stock = squeletteListe({
  id: 'stock',
  title: 'Inventaire',
  group: 'registres',
  keywords: ['stock', 'inventaire', 'magasin', 'reste', 'quantite'],
  titreNom: 'Nom du magasin',
  config: STOCK,
})

const CLIENTS: ConfigListe = {
  kicker: 'ANNUAIRE',
  colonnes: [
    { clef: 'nom', titre: 'Nom', type: 'texte' },
    { clef: 'tel', titre: 'Téléphone', type: 'texte' },
  ],
  personnes: true,
  libelleVide: 'Aucun contact pour l’instant.',
  libelleAjout: 'Ajouter un contact',
  relancesVides: 'Un annuaire ne se relance pas — ouvre plutôt une ardoise.',
}

export const clients = squeletteListe({
  id: 'clients',
  title: 'Clients',
  group: 'registres',
  keywords: ['client', 'contact', 'annuaire', 'repertoire', 'numero'],
  titreNom: 'Nom de la liste',
  config: CLIENTS,
})

const PRIX: ConfigListe = {
  kicker: 'LISTE DE PRIX',
  colonnes: [
    { clef: 'article', titre: 'Article', type: 'texte' },
    { clef: 'prix', titre: 'Prix (F CFA)', type: 'montant' },
    { clef: 'disponible', titre: 'Disponible', type: 'bascule' },
  ],
  libelleVide: 'Aucun article pour l’instant.',
  libelleAjout: 'Ajouter un article',
  relancesVides:
    'Une liste de prix ne se relance pas, elle se diffuse. Le résumé ci-dessus est prêt à coller dans une discussion ou une liste de diffusion.',
}

export const prix = squeletteListe({
  id: 'prix',
  title: 'Liste de prix',
  group: 'registres',
  keywords: ['prix', 'tarif', 'catalogue', 'boutique', 'combien'],
  titreNom: 'Nom de la boutique',
  config: PRIX,
})

/** Les squelettes de liste, dans l'ordre où ils s'affichent. */
export const REGISTRES_LISTE = [prix, caisse, stock, clients] as const
