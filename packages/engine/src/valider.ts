import type { ErreurValidation, JsonSchema } from './types.js'

/**
 * Validateur du sous-ensemble de JSON Schema retenu par le produit.
 *
 * C'est la porte par laquelle passe toute sortie de modèle avant d'atteindre
 * quoi que ce soit (BRIEF.md § 2.1, § 3.5). Écrit à la main, sans dépendance :
 * cent lignes valent mieux qu'une bibliothèque dans un budget de 120 Ko, et la
 * surface à raisonner reste lisible d'un coup d'œil.
 *
 * Le vocabulaire est celui de JSON Schema standard — `type`, `enum`, `required`,
 * `additionalProperties`, `minimum`… — pour que le même objet serve de schéma de
 * réponse contrainte au modèle en phase 4, sans traduction.
 *
 * Le validateur ne corrige rien et ne complète rien. Il dit ce qui ne va pas, et
 * l'appelant décide. Un seul essai de reprise est prévu, puis abandon.
 */

function typeDe(v: unknown): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'tableau'
  return typeof v
}

function err(chemin: string, message: string): ErreurValidation {
  return { chemin, message }
}

export function valider(schema: JsonSchema, valeur: unknown, chemin = '$'): ErreurValidation[] {
  switch (schema.type) {
    case 'string': {
      if (typeof valeur !== 'string') {
        return [err(chemin, `chaîne attendue, reçu ${typeDe(valeur)}`)]
      }
      const e: ErreurValidation[] = []
      if (schema.enum !== undefined && !schema.enum.includes(valeur)) {
        e.push(err(chemin, `valeur hors liste : « ${valeur} »`))
      }
      if (schema.minLength !== undefined && valeur.length < schema.minLength) {
        e.push(err(chemin, `trop court : ${valeur.length} caractères, minimum ${schema.minLength}`))
      }
      if (schema.maxLength !== undefined && valeur.length > schema.maxLength) {
        e.push(err(chemin, `trop long : ${valeur.length} caractères, maximum ${schema.maxLength}`))
      }
      return e
    }

    case 'number':
    case 'integer': {
      if (typeof valeur !== 'number' || !Number.isFinite(valeur)) {
        return [err(chemin, `nombre attendu, reçu ${typeDe(valeur)}`)]
      }
      const e: ErreurValidation[] = []
      if (schema.type === 'integer' && !Number.isInteger(valeur)) {
        e.push(err(chemin, `entier attendu, reçu ${valeur}`))
      }
      if (schema.minimum !== undefined && valeur < schema.minimum) {
        e.push(err(chemin, `inférieur au minimum ${schema.minimum} : ${valeur}`))
      }
      if (schema.maximum !== undefined && valeur > schema.maximum) {
        e.push(err(chemin, `supérieur au maximum ${schema.maximum} : ${valeur}`))
      }
      return e
    }

    case 'boolean':
      return typeof valeur === 'boolean' ? [] : [err(chemin, `booléen attendu, reçu ${typeDe(valeur)}`)]

    case 'array': {
      if (!Array.isArray(valeur)) {
        return [err(chemin, `tableau attendu, reçu ${typeDe(valeur)}`)]
      }
      const e: ErreurValidation[] = []
      if (schema.minItems !== undefined && valeur.length < schema.minItems) {
        e.push(err(chemin, `trop peu d'éléments : ${valeur.length}, minimum ${schema.minItems}`))
      }
      if (schema.maxItems !== undefined && valeur.length > schema.maxItems) {
        e.push(err(chemin, `trop d'éléments : ${valeur.length}, maximum ${schema.maxItems}`))
      }
      valeur.forEach((v, i) => {
        e.push(...valider(schema.items, v, `${chemin}[${i}]`))
      })
      return e
    }

    case 'object': {
      if (typeof valeur !== 'object' || valeur === null || Array.isArray(valeur)) {
        return [err(chemin, `objet attendu, reçu ${typeDe(valeur)}`)]
      }
      const obj = valeur as Record<string, unknown>
      const e: ErreurValidation[] = []
      for (const clef of schema.required ?? []) {
        if (!Object.hasOwn(obj, clef)) {
          e.push(err(`${chemin}.${clef}`, 'champ obligatoire manquant'))
        }
      }
      for (const clef of Object.keys(obj)) {
        // `Object.hasOwn` et pas un accès direct : un objet issu de JSON.parse
        // peut porter une clef « __proto__ » ou « constructor » qui, cherchée
        // dans le schéma, remonterait la chaîne de prototypes.
        if (!Object.hasOwn(schema.properties, clef)) {
          if (schema.additionalProperties === false) {
            e.push(err(`${chemin}.${clef}`, 'champ inattendu'))
          }
          continue
        }
        const sous = schema.properties[clef]
        if (sous === undefined) continue
        e.push(...valider(sous, obj[clef], `${chemin}.${clef}`))
      }
      return e
    }
  }
}

/** Vrai si la valeur est conforme. */
export function estValide(schema: JsonSchema, valeur: unknown): boolean {
  return valider(schema, valeur).length === 0
}

/** Message d'erreur lisible, une ligne par manquement. */
export function messageErreurs(erreurs: readonly ErreurValidation[]): string {
  return erreurs.map((e) => `${e.chemin} : ${e.message}`).join('\n')
}
