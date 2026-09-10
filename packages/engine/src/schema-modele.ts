import type { JsonSchema } from './types.js'

/**
 * Le schéma tel qu'il part au modèle : sans ce qui ne sert qu'à l'écran.
 *
 * Un même schéma fait deux métiers. Il dit au modèle quoi remplir, et il dresse
 * le formulaire qui permet de corriger ce qu'il a rempli — c'est ce qui fait
 * qu'une page composée se reprend : le contrat qui a servi à l'écrire sert à la
 * modifier, et un champ ajouté apparaît des deux côtés sans qu'on y pense.
 *
 * Mais les deux publics ne lisent pas la même chose. `title` nomme un champ
 * dans un formulaire ; le modèle, lui, a déjà la clef sous les yeux et n'en
 * fait rien. `montrerSi` dit à l'écran quand un champ a lieu d'être montré ;
 * pour le modèle, c'est un mot-clef inconnu au milieu d'un schéma qu'on lui
 * demande de respecter à la lettre.
 *
 * Chaque caractère d'invite se paie à chaque appel, sur un budget d'un franc
 * la génération (§ 8). Ce qui n'aide pas à remplir un JSON n'a rien à y faire.
 */
export function pourLeModele(schema: JsonSchema): JsonSchema {
  const { title, ecran, ...reste } = schema as JsonSchema & Record<string, unknown>
  void title
  void ecran

  if (reste.type === 'array') {
    return { ...reste, items: pourLeModele(reste.items as JsonSchema) } as JsonSchema
  }
  if (reste.type === 'object') {
    const proprietes = reste.properties as Readonly<Record<string, JsonSchema>>
    return {
      ...reste,
      properties: Object.fromEntries(
        Object.entries(proprietes).map(([clef, sous]) => [clef, pourLeModele(sous)]),
      ),
    } as JsonSchema
  }
  return reste as JsonSchema
}
