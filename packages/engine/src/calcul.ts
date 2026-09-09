import type { Expression } from './expression.js'
import { schemaExpression, verifierExpression } from './expression.js'
import type { ErreurValidation, JsonSchema } from './types.js'
import { valider } from './valider.js'

/**
 * La deuxième forme que le modèle peut composer : une calculatrice.
 *
 * Un registre tient une liste ; une calculatrice répond à une question. « Ce
 * qu'il me reste à payer », « ma marge sur chaque vente », « la part de
 * chacun » : ce sont les plus petits outils du produit, et sans doute ceux
 * qu'on ouvre le plus souvent.
 *
 * Elle manquait, et ça se voyait : tout ce qui n'était pas une liste se
 * heurtait à un refus. Le moteur savait pourtant déjà les dessiner — seule la
 * formule bloquait, parce qu'elle était écrite en TypeScript. Déclarée en
 * arbre (`expression.ts`), elle devient une configuration comme le reste.
 */

export interface EntreeDemandee {
  readonly clef: string
  readonly titre: string
  readonly defaut: number
  readonly unite: 'F' | ''
}

export interface CalculDemande {
  readonly titre: string
  readonly kicker: string
  readonly titreNom: string
  readonly entrees: readonly EntreeDemandee[]
  readonly sortie: {
    readonly libelle: string
    readonly unite: 'F' | ''
    readonly formule: Expression
  }
}

/** Cinq champs à remplir avant de lire un résultat, c'est déjà beaucoup. */
export const MAX_ENTREES = 5

export const schemaCalcul: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['titre', 'kicker', 'titreNom', 'entrees', 'sortie'],
  properties: {
    titre: {
      type: 'string', minLength: 2, maxLength: 40,
      description: 'Ce que la calculatrice répond. Ex. « Reste à payer ».',
    },
    kicker: { type: 'string', minLength: 2, maxLength: 30, description: 'Le même, en capitales.' },
    titreNom: {
      type: 'string', minLength: 2, maxLength: 40,
      description: 'Comment nommer cet outil-ci. Ex. « Nom de l’élève ».',
    },
    entrees: {
      type: 'array', minItems: 1, maxItems: MAX_ENTREES,
      description: 'Ce que l’utilisateur saisit. Des nombres, jamais du texte.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['clef', 'titre', 'defaut', 'unite'],
        properties: {
          clef: {
            type: 'string', minLength: 1, maxLength: 24,
            description: 'Identifiant : lettres non accentuées, chiffres, soulignés.',
          },
          titre: { type: 'string', minLength: 1, maxLength: 32, description: 'Ex. « Déjà versé ».' },
          defaut: { type: 'number', minimum: 0, description: 'La valeur au départ. 0 si on ne sait pas.' },
          unite: { type: 'string', enum: ['F', ''], description: 'F pour des francs, vide sinon.' },
        },
      },
    },
    sortie: {
      type: 'object',
      additionalProperties: false,
      required: ['libelle', 'unite', 'formule'],
      properties: {
        libelle: { type: 'string', minLength: 2, maxLength: 32, description: 'Ex. « Reste à payer ».' },
        unite: { type: 'string', enum: ['F', ''] },
        formule: schemaExpression,
      },
    },
  },
}

/**
 * Ce que le schéma ne dit pas : que la formule ne parle que d'entrées
 * déclarées, et que deux entrées ne portent pas la même clef.
 *
 * Une formule qui référence une entrée absente rendrait zéro sans rien dire —
 * le pire résultat possible pour une calculatrice, parce qu'un zéro ressemble
 * à une réponse.
 */
export function verifierCalcul(valeur: unknown): readonly ErreurValidation[] {
  const erreurs = [...valider(schemaCalcul, valeur)]
  if (erreurs.length > 0) return erreurs

  const c = valeur as CalculDemande
  const clefs = c.entrees.map((e) => e.clef)

  for (const [i, e] of c.entrees.entries()) {
    if (!/^[a-z][a-zA-Z0-9_]*$/.test(e.clef)) {
      erreurs.push({
        chemin: `$.entrees[${i}].clef`,
        message: `« ${e.clef} » : la clef ne prend que des lettres non accentuées, des chiffres et des soulignés, et commence par une minuscule`,
      })
    }
  }

  const doublons = clefs.filter((c2, i) => clefs.indexOf(c2) !== i)
  for (const d of new Set(doublons)) {
    erreurs.push({ chemin: '$.entrees', message: `la clef « ${d} » apparaît deux fois` })
  }

  erreurs.push(...verifierExpression(c.sortie.formule, clefs, '$.sortie.formule'))
  return erreurs
}
