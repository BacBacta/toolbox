import type { JsonSchema } from '../types.js'
import { encreSchema } from './commun.js'

/**
 * Le contrat de la feuille de présence.
 *
 * `noms` et `presents` sont indexés ensemble : la case `presents[i]` est celle
 * de `noms[i]`. Le schéma ne peut pas dire ça, mais les transitions du moteur
 * s'en chargent — retirer un nom retire sa colonne dans chaque séance.
 *
 * Champs de ligne : jamais de `minLength`, voir `schema/commun.ts`.
 */
export const presenceSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['nom', 'encre', 'noms', 'seances'],
  properties: {
    nom: { type: 'string', minLength: 1, maxLength: 60, title: 'Nom de l’outil' },
    noms: {
      type: 'array', maxItems: 120, title: 'Les personnes',
      description: 'L’ordre de la feuille. Il ne change pas d’une séance à l’autre.',
      items: { type: 'string', maxLength: 60, title: 'Nom' },
    },
    seances: {
      type: 'array', maxItems: 60, title: 'Les séances',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['titre', 'presents'],
        properties: {
          titre: {
            type: 'string', maxLength: 60, title: 'Titre de la séance',
            description: 'Ex. « 12 mars » ou « Assemblée générale ». Vide, la séance porte son rang.',
          },
          presents: {
            type: 'array', maxItems: 120, title: 'Présents',
            items: { type: 'boolean', title: 'Présent' },
          },
        },
      },
    },
    encre: encreSchema,
  },
}
