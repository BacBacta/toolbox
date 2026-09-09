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
      title: 'Nom du njangi',
      description: 'Tel qu’il est connu du groupe.',
    },
    cotisation: {
      type: 'integer',
      minimum: 0,
      maximum: 100_000_000,
      title: 'Cotisation (F CFA)',
      description: 'Part que verse chaque membre à chaque tour.',
    },
    periode: {
      type: 'string',
      enum: ['semaine', 'quinzaine', 'mois'],
      title: 'Rythme',
      description: 'À quelle fréquence le njangi tourne.',
    },
    tour: { type: 'integer', minimum: 1, title: 'Tour en cours' },
    historique: {
      type: 'array',
      maxItems: 500,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['tour', 'collecte'],
        properties: {
          tour: { type: 'integer', minimum: 1, title: 'Tour' },
          collecte: { type: 'integer', minimum: 0, title: 'Collecté (F CFA)' },
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
          nom: { type: 'string', maxLength: 40, title: 'Nom' },
          tel: { type: 'string', maxLength: 20, title: 'Téléphone', description: 'Pour la relance.' },
          aVerse: { type: 'boolean', title: 'A versé sa part', description: 'Pour le tour en cours.' },
          aRecu: { type: 'boolean', title: 'A déjà reçu la cagnotte', description: 'Dans le cycle en cours.' },
          estAuTour: { type: 'boolean', title: 'Reçoit ce tour-ci' },
          versements: { type: 'integer', minimum: 0, title: 'Versements effectués' },
          tours: { type: 'integer', minimum: 0, title: 'Tours vécus' },
        },
      },
    },
  },
}
