import type { ErreurValidation } from './types.js'

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

/**
 * La description que lit le modèle — en prose, pas en schéma.
 *
 * Un schéma JSON récursif ne se déclare pas sans `$ref`, que le validateur
 * écrit à la main ne connaît pas. La première version dépliait donc l'arbre :
 * chaque niveau embarquait deux fois le sous-schéma, soit soixante-quatre
 * copies de la feuille et **quarante mille caractères** — dix mille jetons
 * d'invite à chaque appel, contre deux mille sept cents pour un registre
 * entier. Le coût d'une génération est passé de 0,13 à 0,76 franc, et le
 * modèle, noyé sous la répétition, refusait des demandes qu'il savait traiter.
 *
 * Trois lignes de français disent la même chose et se lisent mieux. La
 * vérification, elle, ne coûte rien et reste exhaustive : `verifierExpression`
 * parcourt l'arbre lui-même.
 */
export const DESCRIPTION_FORMULE =
  'Un arbre. Chaque nœud est exactement l’une de ces trois formes : ' +
  '{"nombre": 19.25} une constante ; {"ref": "total"} une entrée déclarée ; ' +
  '{"op": "moins", "gauche": …, "droite": …} une opération, où gauche et droite ' +
  'sont eux-mêmes des nœuds. Opérations : plus, moins, fois, divise, pourcent ' +
  '(gauche × droite ÷ 100), min, max. ' +
  `Six niveaux d'imbrication au plus. ` +
  'Exemple — le reste à payer : ' +
  '{"op":"moins","gauche":{"ref":"total"},"droite":{"ref":"verse"}}'

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
  return formes(valeur, clefs, chemin, 0)
}

const OPERATIONS: readonly string[] = ['plus', 'moins', 'fois', 'divise', 'pourcent', 'min', 'max']

/**
 * Vérifie l'arbre nœud par nœud.
 *
 * Elle fait tout : la forme, les types, l'ensemble fermé des opérations, les
 * références, la profondeur. Un schéma déplié faisait la moitié du travail
 * pour quarante mille caractères ; cette marche fait tout pour rien.
 */
function formes(
  valeur: unknown,
  clefs: readonly string[],
  chemin: string,
  niveau: number,
): ErreurValidation[] {
  if (typeof valeur !== 'object' || valeur === null || Array.isArray(valeur)) {
    return [{ chemin, message: 'un nœud de formule est un objet' }]
  }

  const o = valeur as Record<string, unknown>
  const inconnus = Object.keys(o).filter(
    (c) => !['nombre', 'ref', 'op', 'gauche', 'droite'].includes(c),
  )
  if (inconnus.length > 0) {
    return [{ chemin, message: `champ inconnu : « ${inconnus.join(' », « ')} »` }]
  }

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

  if (o['nombre'] !== undefined) {
    return typeof o['nombre'] === 'number' && Number.isFinite(o['nombre'])
      ? []
      : [{ chemin, message: '« nombre » doit être un nombre fini' }]
  }

  if (o['ref'] !== undefined) {
    if (typeof o['ref'] !== 'string') {
      return [{ chemin, message: '« ref » doit être la clef d’une entrée' }]
    }
    return clefs.includes(o['ref'])
      ? []
      : [{
          chemin,
          message: `« ${o['ref']} » ne désigne aucune entrée (elles s’appellent ${clefs.join(', ')})`,
        }]
  }

  if (typeof o['op'] !== 'string' || !OPERATIONS.includes(o['op'])) {
    return [{
      chemin,
      message: `« ${String(o['op'])} » n’est pas une opération connue (${OPERATIONS.join(', ')})`,
    }]
  }

  if (niveau >= PROFONDEUR_MAX) {
    return [{ chemin, message: `formule trop profonde : ${PROFONDEUR_MAX} niveaux au plus` }]
  }

  const erreurs: ErreurValidation[] = []
  for (const cote of ['gauche', 'droite'] as const) {
    if (o[cote] === undefined) {
      erreurs.push({ chemin: `${chemin}.${cote}`, message: `« ${o['op']} » exige ${cote}` })
    } else {
      erreurs.push(...formes(o[cote], clefs, `${chemin}.${cote}`, niveau + 1))
    }
  }
  return erreurs
}
