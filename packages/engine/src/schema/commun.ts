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
  title: 'Encre',
  description: 'Couleur d’accent du document.',
}

export const emetteurSchema: JsonSchema = {
  type: 'object',
  title: 'Ton entreprise',
  additionalProperties: false,
  required: ['nom', 'forme', 'activite', 'adresse', 'tel', 'mail', 'rccm', 'niu', 'centre'],
  properties: {
    nom: { type: 'string', maxLength: 80, title: 'Raison sociale', description: 'Raison sociale complète.' },
    forme: { type: 'string', maxLength: 80, title: 'Forme juridique', description: 'Ex. « Ets — Établissement individuel ».' },
    activite: { type: 'string', maxLength: 120, title: 'Activité' },
    adresse: { type: 'string', maxLength: 160, title: 'Adresse' },
    tel: { type: 'string', maxLength: 30, title: 'Téléphone' },
    mail: { type: 'string', maxLength: 80, title: 'Adresse e-mail' },
    rccm: { type: 'string', maxLength: 40, title: 'Numéro RCCM' },
    niu: { type: 'string', maxLength: 20, title: 'NIU', description: 'La mention la plus contrôlée par la DGI.' },
    centre: { type: 'string', maxLength: 60, title: 'Centre des impôts' },
  },
}

export const clientSchema: JsonSchema = {
  type: 'object',
  title: 'Le client',
  additionalProperties: false,
  required: ['nom', 'niu', 'estEntreprise'],
  properties: {
    nom: { type: 'string', maxLength: 80, title: 'Nom du client' },
    niu: { type: 'string', maxLength: 20, title: 'NIU du client', description: 'Obligatoire quand le client est une entreprise.' },
    estEntreprise: { type: 'boolean', title: 'Le client est une entreprise' },
    tel: { type: 'string', maxLength: 20, title: 'Téléphone du client' },
  },
}

/*
 * Aucun champ de ligne n'exige d'être non vide, et c'est délibéré.
 *
 * « Ajouter une ligne » insère une ligne neuve, donc vide, et l'état doit
 * rester valide entre ce clic et la première lettre tapée. Un `minLength: 1`
 * sur un champ de ligne décrit un état qui existe forcément, et le refuser
 * remplaçait tout l'écran par « cet outil ne correspond pas à ce que
 * l'application sait dessiner » — avant même la première frappe. La règle vaut
 * pour toutes les listes de l'atelier, et une garde la tient.
 *
 * Le vide n'est pas une invalidité mais une incomplétude : il se dit dans
 * l'encart des manquements et dans l'avertissement du partage, jamais en
 * refusant de dessiner la page.
 */
export const lignesSchema: JsonSchema = {
  type: 'array',
  title: 'Lignes du document',
  maxItems: 100,
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['designation', 'quantite', 'prixUnitaire'],
    properties: {
      designation: { type: 'string', maxLength: 120, title: 'Désignation' },
      quantite: { type: 'number', minimum: 0, maximum: 1_000_000, title: 'Quantité' },
      prixUnitaire: { type: 'integer', minimum: 0, maximum: 1_000_000_000, title: 'Prix unitaire (F CFA)' },
    },
  },
  description: 'Les lignes du document. La TVA se calcule sur chacune.',
}
