import type { JsonSchema } from '../types.js'
import { encreSchema } from './commun.js'

/**
 * Le contrat de l'ardoise.
 *
 * `depuis` est une date, pas un nombre de jours : c'est ce qui permet à
 * l'ancienneté de bouger toute seule. Champs de ligne : jamais de `minLength`,
 * voir `schema/commun.ts`.
 */
export const ardoiseSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['nom', 'encre', 'boutique', 'dettes'],
  properties: {
    nom: { type: 'string', minLength: 1, maxLength: 60, title: 'Nom de l’outil' },
    boutique: {
      type: 'string', maxLength: 60, title: 'Nom de la boutique',
      description: 'Il apparaît sur la carte et en tête des relances.',
    },
    dettes: {
      type: 'array', maxItems: 200, title: 'Ce que les clients doivent',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['client', 'montant', 'depuis', 'regle'],
        properties: {
          client: { type: 'string', maxLength: 60, title: 'Client' },
          montant: {
            type: 'integer', minimum: 0, maximum: 1_000_000_000,
            title: 'Montant dû (F CFA)',
          },
          depuis: {
            type: 'string', maxLength: 32, title: 'Ouverte le',
            description: 'Date ISO 8601. L’ancienneté s’en déduit toute seule.',
          },
          tel: {
            type: 'string', maxLength: 20, title: 'Téléphone',
            description: 'Sans numéro, la relance se copie au lieu de s’envoyer.',
          },
          regle: { type: 'boolean', title: 'Réglée' },
        },
      },
    },
    encre: encreSchema,
  },
}
