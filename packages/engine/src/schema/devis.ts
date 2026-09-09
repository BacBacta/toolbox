import type { JsonSchema } from '../types.js'
import { clientSchema, emetteurSchema, encreSchema, lignesSchema } from './commun.js'

/**
 * Le contrat du devis.
 *
 * Un devis propose : il porte une durée de validité et un acompte demandé à la
 * commande. Ce qui l'engage fiscalement, c'est la facture — voir
 * `schema/facture.ts`.
 */
export const devisSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['nom', 'encre', 'numero', 'emisLe', 'emetteur', 'client', 'validite', 'acompte', 'lignes'],
  properties: {
    nom: { type: 'string', minLength: 1, maxLength: 60, title: 'Nom de l’outil' },
    encre: encreSchema,
    numero: { type: 'string', minLength: 1, maxLength: 24, title: 'Numéro', description: 'Ex. DV-2026-0118. Unique, continu et chronologique.' },
    emisLe: { type: 'string', minLength: 10, maxLength: 32, title: 'Date d’émission', description: 'Date ISO 8601, figée à la création.' },
    emetteur: emetteurSchema,
    client: clientSchema,
    objet: { type: 'string', maxLength: 120, title: 'Objet' },
    validite: { type: 'string', maxLength: 40, title: 'Validité', description: 'Ex. « 15 jours ».' },
    acompte: { type: 'integer', minimum: 0, maximum: 100, title: 'Acompte à la commande (%)' },
    lignes: lignesSchema,
  },
}

export { clientSchema, emetteurSchema, encreSchema, lignesSchema }
