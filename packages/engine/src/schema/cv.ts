import type { JsonSchema } from '../types.js'
import { encreSchema } from './commun.js'

/**
 * Le contrat du CV.
 *
 * Aucune mention n'y est obligatoire au sens légal — un CV ne se contrôle pas.
 * Les bornes sont donc là pour tenir la page, pas pour tenir la loi : un titre
 * de poste sur trois lignes ou vingt compétences ne débordent pas, ils rendent
 * la feuille illisible, ce qui revient au même pour celui qui la reçoit.
 */

const texteCourt = (titre: string, max: number, description?: string): JsonSchema => ({
  type: 'string', maxLength: max, title: titre,
  ...(description === undefined ? {} : { description }),
})

export const cvSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'nom', 'encre', 'gabarit', 'langue', 'dense', 'identite', 'resume',
    'postes', 'diplomes', 'competences', 'langues',
  ],
  properties: {
    nom: { type: 'string', minLength: 1, maxLength: 60, title: 'Nom de l’outil' },
    gabarit: {
      type: 'string', enum: ['notaire', 'executif', 'editorial', 'bloc'], title: 'Gabarit',
      description: 'Notaire pour l’administration, Exécutif pour le privé, Éditorial pour un métier créatif, Bloc pour une bande latérale.',
    },
    langue: {
      type: 'string', enum: ['fr', 'en'], title: 'Langue des intitulés',
      description: 'Change « Expérience professionnelle » en « Experience ». Le texte que tu écris n’est pas traduit.',
    },
    dense: {
      type: 'boolean', title: 'Mode compact',
      description: 'Resserre l’interligne pour faire tenir une carrière longue sur une seule page.',
    },
    identite: {
      type: 'object',
      additionalProperties: false,
      required: ['nom', 'titre', 'tel', 'mail', 'ville'],
      title: 'Toi',
      properties: {
        nom: texteCourt('Nom et prénom', 60),
        titre: texteCourt('Poste visé', 80, 'Ex. « Magasinier — gestion de stock ». C’est la première chose qu’on lit.'),
        tel: texteCourt('Téléphone', 32),
        mail: texteCourt('Adresse mail', 80),
        ville: texteCourt('Ville', 60, 'Ex. « Douala, Cameroun ».'),
      },
    },
    resume: texteCourt(
      'Profil',
      600,
      'Trois ou quatre lignes : ce que tu sais faire, depuis combien de temps.',
    ),
    postes: {
      type: 'array', maxItems: 8, title: 'Expérience professionnelle',
      description: 'Du plus récent au plus ancien.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['intitule', 'employeur', 'periode', 'points'],
        properties: {
          intitule: { type: 'string', maxLength: 80, title: 'Poste occupé' },
          employeur: texteCourt('Employeur', 80),
          periode: texteCourt('Période', 40, 'Ex. « 2022 – 2026 ».'),
          points: {
            type: 'array', maxItems: 6, title: 'Ce que tu y as fait',
            description: 'Un fait par ligne, chiffré quand c’est possible. « Écarts d’inventaire ramenés de 12 % à 3 % » se retient ; « rigoureux et motivé » ne se retient pas.',
            items: { type: 'string', maxLength: 160, title: 'Fait' },
          },
        },
      },
    },
    diplomes: {
      type: 'array', maxItems: 8, title: 'Formation',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['intitule', 'etablissement', 'annee'],
        properties: {
          intitule: { type: 'string', maxLength: 100, title: 'Diplôme' },
          etablissement: texteCourt('Établissement', 80),
          annee: texteCourt('Année', 16),
        },
      },
    },
    competences: {
      type: 'array', maxItems: 12, title: 'Compétences',
      description: 'Des choses vérifiables : un logiciel, une machine, une méthode.',
      items: { type: 'string', maxLength: 60, title: 'Compétence' },
    },
    langues: {
      type: 'array', maxItems: 6, title: 'Langues',
      description: 'Ex. « Duala — maternelle », « Anglais — professionnel ».',
      items: { type: 'string', maxLength: 60, title: 'Langue' },
    },
    encre: encreSchema,
  },
}
