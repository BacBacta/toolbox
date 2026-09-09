import type { JsonSchema } from '../types.js'
import { emetteurSchema, encreSchema } from './commun.js'

/**
 * Les contrats des actes et des lettres.
 *
 * Même règle que pour les documents d'affaires : **le schéma dit la forme,
 * `@a237/legal-cm` dit l'obligation**. Un acte qu'on vient d'ouvrir est vide et
 * doit rester valide ; c'est le contrôle légal, à l'écran, qui décide s'il est
 * présentable.
 */

const nomOutil: JsonSchema = { type: 'string', minLength: 1, maxLength: 60, title: 'Nom de l’outil' }
const emisLe: JsonSchema = {
  type: 'string', minLength: 10, maxLength: 32, title: 'Date d’émission',
  description: 'Date ISO 8601, figée à la création.',
}

export const attestationSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['nom', 'encre', 'numero', 'emisLe', 'emetteur', 'objet', 'texte'],
  properties: {
    nom: nomOutil,
    numero: {
      type: 'string', minLength: 1, maxLength: 24, title: 'Numéro',
      description: 'Ex. AT-2026-0014. Utile pour retrouver l’attestation dans tes archives.',
    },
    emisLe,
    emetteur: emetteurSchema,
    objet: {
      type: 'string', maxLength: 80, title: 'Objet',
      description: 'Ce que l’attestation certifie. Ex. « Attestation de travail ».',
    },
    texte: {
      type: 'string', maxLength: 2000, title: 'Corps de l’attestation',
      description: 'Le texte certifié. Une ligne vide sépare deux paragraphes.',
    },
    encre: encreSchema,
  },
}

export const recuSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['nom', 'encre', 'numero', 'emisLe', 'emetteur', 'recuDe', 'lignes', 'avance'],
  properties: {
    nom: nomOutil,
    numero: {
      type: 'string', minLength: 1, maxLength: 24, title: 'Numéro',
      description: 'Ex. RE-2026-0412. Unique et continu, comme pour une facture.',
    },
    emisLe,
    emetteur: emetteurSchema,
    recuDe: { type: 'string', maxLength: 80, title: 'Reçu de', description: 'Qui a payé.' },
    lignes: {
      type: 'array', maxItems: 40, title: 'Ce qui est réglé',
      description: 'Sans TVA : la taxe a été traitée sur la facture, la répéter ferait croire à une seconde opération.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['designation', 'montant'],
        properties: {
          designation: { type: 'string', minLength: 1, maxLength: 120, title: 'Désignation' },
          montant: { type: 'integer', minimum: 0, maximum: 1_000_000_000, title: 'Montant (F CFA)' },
        },
      },
    },
    avance: {
      type: 'integer', minimum: 0, maximum: 1_000_000_000, title: 'Somme reçue ce jour (F CFA)',
      description: 'Ce que tu as effectivement encaissé. Le reste à payer s’en déduit.',
    },
    encre: encreSchema,
  },
}

const partieSchema = (qui: string): JsonSchema => ({
  type: 'object',
  additionalProperties: false,
  required: ['nom', 'piece'],
  title: qui,
  properties: {
    nom: { type: 'string', maxLength: 80, title: `Nom — ${qui.toLowerCase()}` },
    piece: {
      type: 'string', maxLength: 60, title: `Pièce d’identité — ${qui.toLowerCase()}`,
      description: 'Ex. « CNI n° 118 442 907 ». Sans elle, la partie n’est pas identifiée.',
    },
  },
})

export const detteSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['nom', 'encre', 'emisLe', 'emprunteur', 'preteur', 'montant', 'echeance', 'lieu', 'texte'],
  properties: {
    nom: nomOutil,
    emisLe,
    emprunteur: partieSchema('L’emprunteur'),
    preteur: partieSchema('Le prêteur'),
    montant: {
      type: 'integer', minimum: 0, maximum: 1_000_000_000, title: 'Montant du prêt (F CFA)',
      description: 'Il s’écrira aussi en toutes lettres : un chiffre seul se rallonge d’un trait de stylo.',
    },
    echeance: {
      type: 'string', maxLength: 60, title: 'Échéance de remboursement',
      description: 'Ex. « 31 décembre 2026 ». Sans échéance, la créance n’est pas exigible.',
    },
    lieu: { type: 'string', maxLength: 60, title: 'Lieu de signature' },
    texte: {
      type: 'string', maxLength: 2000, title: 'Engagement',
      description: 'Ce que l’emprunteur reconnaît et s’engage à faire.',
    },
    encre: encreSchema,
  },
}

export const motivationSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['nom', 'encre', 'emisLe', 'expediteur', 'destinataire', 'objet', 'corps'],
  properties: {
    nom: nomOutil,
    emisLe,
    expediteur: {
      type: 'object',
      additionalProperties: false,
      required: ['nom', 'tel', 'mail', 'ville'],
      title: 'Toi',
      properties: {
        nom: { type: 'string', maxLength: 80, title: 'Nom' },
        tel: { type: 'string', maxLength: 30, title: 'Téléphone' },
        mail: { type: 'string', maxLength: 80, title: 'Adresse e-mail' },
        ville: { type: 'string', maxLength: 60, title: 'Ville' },
      },
    },
    destinataire: {
      type: 'string', maxLength: 300, title: 'Destinataire',
      description: 'Le service et l’adresse, tels qu’ils s’écrivent. Une ligne par élément.',
    },
    objet: {
      type: 'string', maxLength: 120, title: 'Objet',
      description: 'Ex. « Objet : candidature au poste de magasinier ».',
    },
    corps: {
      type: 'string', maxLength: 3000, title: 'Corps de la lettre',
      description: 'Une ligne vide sépare deux paragraphes. Garde la formule de politesse finale.',
    },
    encre: encreSchema,
  },
}
