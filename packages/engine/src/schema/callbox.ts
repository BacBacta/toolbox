import type { JsonSchema } from '../types.js'
import { encreSchema } from './commun.js'

/**
 * Le contrat du call-box.
 *
 * Champs de ligne : jamais de `minLength`, voir `schema/commun.ts`.
 */
export const callboxSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['nom', 'encre', 'tranches', 'operations'],
  properties: {
    nom: { type: 'string', minLength: 1, maxLength: 60, title: 'Nom de l’outil' },
    tranches: {
      type: 'array', maxItems: 10, title: 'Grille de commission',
      description: 'Lue dans l’ordre : la première tranche qui couvre le montant l’emporte.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['plafond', 'commission'],
        properties: {
          plafond: {
            type: 'integer', minimum: 0, maximum: 1_000_000_000,
            title: 'Jusqu’à (F CFA)',
            description: 'Zéro veut dire « au-delà » : la tranche n’a pas de plafond.',
          },
          commission: {
            type: 'integer', minimum: 0, maximum: 1_000_000,
            title: 'Tu gardes (F CFA)',
          },
        },
      },
    },
    operations: {
      type: 'array', maxItems: 400, title: 'Registre des opérations',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['montant', 'commission', 'heure', 'jour'],
        properties: {
          montant: {
            type: 'integer', minimum: 0, maximum: 1_000_000_000, title: 'Montant remis',
          },
          commission: {
            type: 'integer', minimum: 0, maximum: 1_000_000, title: 'Commission gardée',
          },
          heure: { type: 'string', maxLength: 8, title: 'Heure' },
          jour: { type: 'string', maxLength: 10, title: 'Jour' },
        },
      },
    },
    encre: encreSchema,
  },
}
