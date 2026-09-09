import type { JsonSchema } from '../types.js'
import { clientSchema, emetteurSchema, encreSchema, lignesSchema } from './commun.js'

/** Les moyens de règlement que le produit sait enregistrer. */
export const MOYENS_PAIEMENT = ['momo', 'orange-money', 'especes', 'virement'] as const

export const reglementSchema: JsonSchema = {
  type: 'object',
  // Champs de ligne : jamais de `minLength`, voir `schema/commun.ts`.
  additionalProperties: false,
  required: ['date', 'montant', 'moyen'],
  properties: {
    date: { type: 'string', maxLength: 32, title: 'Date du versement' },
    montant: { type: 'integer', minimum: 0, maximum: 1_000_000_000, title: 'Montant (F CFA)' },
    moyen: { type: 'string', enum: [...MOYENS_PAIEMENT], title: 'Moyen' },
    reference: { type: 'string', maxLength: 60, title: 'Référence de la transaction' },
  },
}

/**
 * Le contrat de la facture.
 *
 * Elle reprend l'entête, le client et les lignes du devis, et s'en écarte sur
 * ce qui l'engage : elle ne se périme pas, elle s'échoit ; elle n'annonce pas
 * un acompte à venir, elle enregistre les règlements reçus.
 *
 * `devisNumero` garde le lien avec le devis dont elle découle, quand il y en a
 * un : c'est ce qui permet à un client de rapprocher les deux documents.
 */
export const factureSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'nom', 'encre', 'numero', 'emisLe', 'echeance', 'emetteur', 'client',
    'conditionsReglement', 'lignes', 'reglements',
  ],
  properties: {
    nom: { type: 'string', minLength: 1, maxLength: 60, title: 'Nom de l’outil' },
    numero: {
      type: 'string',
      minLength: 1,
      maxLength: 24,
      title: 'Numéro',
      description: 'Ex. FA-2026-0001. Unique, continu et chronologique.',
    },
    emisLe: { type: 'string', minLength: 10, maxLength: 32, title: 'Date d’émission' },
    echeance: {
      type: 'string',
      minLength: 10,
      maxLength: 32,
      title: 'Échéance',
      description: 'Date limite de règlement. Par défaut, payable à réception.',
    },
    emetteur: emetteurSchema,
    client: clientSchema,
    objet: { type: 'string', maxLength: 120, title: 'Objet' },
    devisNumero: { type: 'string', maxLength: 24, title: 'Devis d’origine' },
    conditionsReglement: {
      type: 'string',
      maxLength: 200,
      title: 'Conditions de règlement',
      description: 'Ex. « Règlement par MTN Mobile Money ou Orange Money ».',
    },
    lignes: lignesSchema,
    encre: encreSchema,
    reglements: { type: 'array', maxItems: 100, title: 'Règlements reçus', items: reglementSchema },
  },
}
