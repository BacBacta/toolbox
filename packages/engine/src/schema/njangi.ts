import type { JsonSchema } from '../types.js'

/**
 * Le contrat du carnet de njangi.
 *
 * C'est **la seule chose que le modèle a le droit de remplir** (invariant § 2.1).
 * Le vocabulaire est celui de JSON Schema standard, pour servir tel quel de
 * schéma de réponse contrainte en phase 4.
 *
 * Les bornes ne sont pas décoratives : elles arrêtent une sortie de modèle
 * absurde avant qu'elle n'atteigne le rendu, et elles bornent la taille de
 * l'instantané publié dans KV.
 */
export const njangiSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['nom', 'cotisation', 'periode', 'tour', 'historique', 'membres'],
  properties: {
    nom: {
      type: 'string',
      minLength: 1,
      maxLength: 60,
      description: 'Nom du njangi, tel qu’il est connu du groupe.',
    },
    cotisation: {
      type: 'integer',
      minimum: 0,
      maximum: 100_000_000,
      description: 'Part que verse chaque membre à chaque tour, en francs CFA.',
    },
    periode: {
      type: 'string',
      enum: ['semaine', 'quinzaine', 'mois'],
      description: 'Rythme des tours.',
    },
    tour: { type: 'integer', minimum: 1, description: 'Numéro du tour en cours.' },
    historique: {
      type: 'array',
      maxItems: 500,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['tour', 'collecte'],
        properties: {
          tour: { type: 'integer', minimum: 1 },
          collecte: { type: 'integer', minimum: 0 },
        },
      },
      description: 'Ce qui a été collecté aux tours précédents.',
    },
    membres: {
      type: 'array',
      maxItems: 200,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['nom', 'aVerse', 'aRecu', 'estAuTour', 'versements', 'tours'],
        properties: {
          nom: { type: 'string', minLength: 1, maxLength: 40 },
          tel: { type: 'string', maxLength: 20, description: 'Numéro pour la relance.' },
          aVerse: { type: 'boolean', description: 'A versé sa part pour le tour en cours.' },
          aRecu: { type: 'boolean', description: 'A déjà reçu la cagnotte dans ce cycle.' },
          estAuTour: { type: 'boolean', description: 'Reçoit la cagnotte ce tour-ci.' },
          versements: { type: 'integer', minimum: 0 },
          tours: { type: 'integer', minimum: 0 },
        },
      },
    },
  },
}
