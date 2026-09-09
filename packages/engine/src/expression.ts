import type { ErreurValidation, JsonSchema } from './types.js'
import { valider } from './valider.js'

/**
 * Une formule qui se **déclare** au lieu de s'écrire.
 *
 * Les calculatrices du produit portent leur formule en TypeScript —
 * `val('total') - val('verse')` — et le commentaire de `ConfigCalc` était
 * catégorique : « écrite à la main, jamais produite par un modèle ». Il avait
 * raison : faire écrire du code à un modèle et l'exécuter, c'est `eval` avec
 * plus d'étapes, et l'invariant § 2.1 l'interdit sans détour.
 *
 * Mais une formule n'a pas besoin d'être du code. Un arbre d'opérations —
 * « soustrais `verse` de `total` » — se remplit comme n'importe quelle
 * configuration, se valide avant d'être lu, et s'évalue par un interprète de
 * trente lignes écrit à la main. Le modèle décrit ce qu'il veut calculer ; il
 * n'obtient jamais le droit d'exécuter quoi que ce soit.
 *
 * L'ensemble des opérations est **fermé**. On n'en ajoute pas parce qu'un
 * modèle en réclamerait une : chaque opération ajoutée est une opération à
 * tester, et une surface de plus.
 */

export type Operation = 'plus' | 'moins' | 'fois' | 'divise' | 'pourcent' | 'min' | 'max'

export type Expression =
  /** Une constante. La TVA à 19,25 s'écrit ici. */
  | { readonly nombre: number }
  /** Une entrée saisie par l'utilisateur, désignée par sa clef. */
  | { readonly ref: string }
  | {
      readonly op: Operation
      readonly gauche: Expression
      readonly droite: Expression
    }

/** Six niveaux suffisent à tout ce qu'un commerçant calcule de tête. */
export const PROFONDEUR_MAX = 6

function noeud(profondeur: number): JsonSchema {
  const sous: JsonSchema =
    profondeur <= 1
      ? {
          type: 'object',
          additionalProperties: false,
          properties: { nombre: { type: 'number' }, ref: { type: 'string', maxLength: 24 } },
        }
      : noeud(profondeur - 1)

  return {
    type: 'object',
    additionalProperties: false,
    description:
      'Soit { "nombre": 19.25 }, soit { "ref": "total" } qui reprend une entrée, ' +
      'soit { "op": …, "gauche": …, "droite": … }.',
    properties: {
      nombre: { type: 'number', description: 'Une constante.' },
      ref: { type: 'string', maxLength: 24, description: 'La clef d’une entrée déclarée.' },
      op: {
        type: 'string',
        enum: ['plus', 'moins', 'fois', 'divise', 'pourcent', 'min', 'max'],
        description: '« pourcent » rend gauche × droite ÷ 100.',
      },
      gauche: sous,
      droite: sous,
    },
  }
}

export const schemaExpression: JsonSchema = noeud(PROFONDEUR_MAX)

/**
 * Évalue l'arbre. Jamais d'exception, jamais de NaN, jamais d'infini.
 *
 * Une calculatrice qui affiche « NaN » à quelqu'un qui compte sa journée est
 * pire qu'une calculatrice absente : elle fait douter de tout le reste. Une
 * division par zéro rend zéro, ce qui est faux, mais lisible et sans surprise.
 */
export function evaluer(e: Expression, lire: (clef: string) => number): number {
  const brut = brute(e, lire, 0)
  return Number.isFinite(brut) ? brut : 0
}

function brute(e: Expression, lire: (clef: string) => number, niveau: number): number {
  // Une expression trop profonde a déjà été refusée à la validation ; cette
  // borne protège l'interprète d'un état enregistré par une version plus laxiste.
  if (niveau > PROFONDEUR_MAX) return 0
  if ('nombre' in e) return e.nombre
  if ('ref' in e) return lire(e.ref)

  const g = brute(e.gauche, lire, niveau + 1)
  const d = brute(e.droite, lire, niveau + 1)
  switch (e.op) {
    case 'plus':
      return g + d
    case 'moins':
      return g - d
    case 'fois':
      return g * d
    case 'divise':
      return d === 0 ? 0 : g / d
    case 'pourcent':
      return (g * d) / 100
    case 'min':
      return Math.min(g, d)
    case 'max':
      return Math.max(g, d)
  }
}

/**
 * Ce que le schéma ne dit pas : qu'un nœud est **exactement** l'une des trois
 * formes, et que chaque `ref` désigne une entrée qui existe.
 *
 * Un schéma d'union serait plus juste, mais `JsonSchema` ici n'a pas de
 * `oneOf` — et l'ajouter pour ce seul usage compliquerait un validateur écrit
 * à la main que tout le reste du moteur emploie. On le vérifie donc à côté.
 */
export function verifierExpression(
  valeur: unknown,
  clefs: readonly string[],
  chemin = '$.formule',
): readonly ErreurValidation[] {
  const erreurs = [...valider(schemaExpression, valeur)]
  if (erreurs.length > 0) return erreurs
  return formes(valeur as Expression, clefs, chemin, 0)
}

function formes(
  e: Expression,
  clefs: readonly string[],
  chemin: string,
  niveau: number,
): ErreurValidation[] {
  const o = e as Record<string, unknown>
  const presents = ['nombre', 'ref', 'op'].filter((c) => o[c] !== undefined)

  if (presents.length !== 1) {
    return [{
      chemin,
      message:
        presents.length === 0
          ? 'un nœud vide : mets « nombre », « ref », ou « op » avec « gauche » et « droite »'
          : `« ${presents.join(' » et « ')} » ensemble : un nœud est une seule de ces trois formes`,
    }]
  }

  if (o['nombre'] !== undefined) return []

  if (o['ref'] !== undefined) {
    return clefs.includes(String(o['ref']))
      ? []
      : [{
          chemin,
          message: `« ${String(o['ref'])} » ne désigne aucune entrée (elles s’appellent ${clefs.join(', ')})`,
        }]
  }

  if (niveau >= PROFONDEUR_MAX) {
    return [{ chemin, message: `formule trop profonde : ${PROFONDEUR_MAX} niveaux au plus` }]
  }

  const erreurs: ErreurValidation[] = []
  for (const cote of ['gauche', 'droite'] as const) {
    if (o[cote] === undefined) {
      erreurs.push({ chemin: `${chemin}.${cote}`, message: `« ${String(o['op'])} » exige ${cote}` })
    } else {
      erreurs.push(...formes(o[cote] as Expression, clefs, `${chemin}.${cote}`, niveau + 1))
    }
  }
  return erreurs
}
