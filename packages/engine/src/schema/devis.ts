import type { JsonSchema } from '../types.js'

/** Les mentions de l'émetteur, communes à tous les documents d'affaires. */
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

/**
 * Le contrat du devis. La facture reprendra ce schéma en n'y changeant que le
 * préfixe de numérotation et les mentions de règlement : c'est pour ça que
 * `emetteurSchema` et `clientSchema` sont sortis à part.
 *
 * **Le schéma dit la forme, le droit dit l'obligation.** Les champs d'identité —
 * raison sociale, NIU du client — sont *présents* mais peuvent être vides : un
 * outil qu'on vient de créer n'a encore rien dedans, et il doit rester valide.
 * C'est `mentionsManquantes` de `@a237/legal-cm` qui décide si un document est
 * émettable, et lui seul. Mélanger les deux rendrait impossible d'ouvrir un
 * devis vierge, ou laisserait passer un devis sans NIU.
 */
export const devisSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['nom', 'encre', 'numero', 'emisLe', 'emetteur', 'client', 'validite', 'acompte', 'lignes'],
  properties: {
    nom: { type: 'string', minLength: 1, maxLength: 60 },
    encre: { type: 'string', enum: ['encre', 'bordeaux', 'foret', 'ardoise'] },
    numero: { type: 'string', minLength: 1, maxLength: 24, description: 'Ex. DV-2026-0118.' },
    emisLe: { type: 'string', minLength: 10, maxLength: 32, description: 'Date ISO 8601, figée.' },
    emetteur: emetteurSchema,
    client: clientSchema,
    objet: { type: 'string', maxLength: 120 },
    validite: { type: 'string', maxLength: 40, description: 'Ex. « 15 jours ».' },
    acompte: { type: 'integer', minimum: 0, maximum: 100, description: 'Pourcentage du TTC.' },
    lignes: {
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
    },
  },
}
