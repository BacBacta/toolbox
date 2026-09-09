import type { JsonSchema } from '../types.js'

/**
 * Les morceaux de schéma partagés par les documents d'affaires.
 *
 * Devis et facture décrivent la même entreprise, le même client et les mêmes
 * lignes ; ils ne diffèrent que par ce qui les engage. Sortir ces trois blocs
 * évite qu'ils divergent — et le jour où une mention obligatoire change, elle
 * change à un seul endroit.
 *
 * **Le schéma dit la forme, `@a237/legal-cm` dit l'obligation.** Les champs
 * d'identité sont *présents* mais peuvent être vides : un document qu'on vient
 * d'ouvrir n'a encore rien dedans et doit rester valide. C'est
 * `mentionsManquantes` qui décide s'il est émettable, et lui seul.
 */

export const encreSchema: JsonSchema = {
  type: 'string',
  enum: ['encre', 'bordeaux', 'foret', 'ardoise'],
  description: 'Couleur d’accent du document.',
}

export const emetteurSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['nom', 'forme', 'activite', 'adresse', 'tel', 'mail', 'rccm', 'niu', 'centre'],
  properties: {
    nom: { type: 'string', maxLength: 80, description: 'Raison sociale complète.' },
    forme: { type: 'string', maxLength: 80, description: 'Forme juridique.' },
    activite: { type: 'string', maxLength: 120 },
    adresse: { type: 'string', maxLength: 160 },
    tel: { type: 'string', maxLength: 30 },
    mail: { type: 'string', maxLength: 80 },
    rccm: { type: 'string', maxLength: 40, description: 'Numéro RCCM.' },
    niu: { type: 'string', maxLength: 20, description: 'NIU — la mention la plus contrôlée.' },
    centre: { type: 'string', maxLength: 60, description: 'Centre des impôts de rattachement.' },
  },
}

export const clientSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['nom', 'niu', 'estEntreprise'],
  properties: {
    nom: { type: 'string', maxLength: 80 },
    niu: { type: 'string', maxLength: 20, description: 'Obligatoire en B2B.' },
    estEntreprise: { type: 'boolean' },
    tel: { type: 'string', maxLength: 20 },
  },
}

export const lignesSchema: JsonSchema = {
  type: 'array',
  maxItems: 100,
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['designation', 'quantite', 'prixUnitaire'],
    properties: {
      designation: { type: 'string', minLength: 1, maxLength: 120 },
      quantite: { type: 'number', minimum: 0, maximum: 1_000_000 },
      prixUnitaire: { type: 'integer', minimum: 0, maximum: 1_000_000_000 },
    },
  },
  description: 'Les lignes du document. La TVA se calcule sur chacune.',
}
