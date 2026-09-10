/**
 * Les clefs, pliées plutôt que refusées.
 *
 * Une colonne, une entrée et un champ portent chacun une `clef` : un nom
 * interne, qui sert de propriété d'objet et de nom de champ HTML, jamais
 * d'adresse et jamais d'affichage. Ce que la personne lit, c'est `titre`.
 * L'orthographe exacte de la clef n'intéresse donc personne.
 *
 * Le modèle, lui, écrit en français : il propose `montantDû`, `dateÉchéance`,
 * `nom d'élève`. La règle les refusait, et refuser coûte un tour entier — payé,
 * et pour un accent. Pire, la reprise repart du même modèle et du même
 * français : elle retombe souvent sur la même faute.
 *
 * C'est la deuxième fois que cette règle tue une génération réelle. La
 * première, `nom_poule`, avait été réglée en élargissant la règle. Élargir à
 * chaque surprise ne finit jamais ; plier ce qui arrive, si.
 *
 * On ne plie que ce qui garde un sens. Une clef qui ne commence pas par une
 * lettre n'a plus de nom une fois nettoyée — lui en inventer un ferait perdre
 * le lien avec ce que le modèle voulait dire, et le reproche, lui, sait le
 * nommer.
 */

/** La forme qu'une clef doit avoir : c'est celle que les trois familles exigent. */
const BONNE_CLEF = /^[a-z][a-zA-Z0-9_]*$/

/**
 * La clef, pliée. `null` quand plier n'a pas de sens.
 *
 * Rend la chaîne d'origine, à l'identique, quand elle était déjà bonne : les
 * appelants comparent par identité pour savoir s'il y a eu changement.
 */
export function clefPropre(brut: unknown): string | null {
  if (typeof brut !== 'string') return null
  if (BONNE_CLEF.test(brut)) return brut

  const plie = brut
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9_]/g, '')

  const premiere = plie[0]
  if (premiere === undefined || !/[A-Za-z]/.test(premiere)) return null
  const propre = premiere.toLowerCase() + plie.slice(1)
  return BONNE_CLEF.test(propre) ? propre : null
}

/**
 * Les clefs d'une liste d'objets, pliées, et le plan des renommages.
 *
 * Rendu séparément parce que ce qui *désigne* une clef vit ailleurs : le total
 * d'un registre, l'arbre d'une formule. Plier sans rapporter le plan laisserait
 * ces renvois pointer dans le vide, et un registre parfaitement lisible serait
 * refusé pour une raison de plus qu'avant.
 */
export interface Pliage {
  readonly liste: readonly unknown[]
  readonly renommes: ReadonlyMap<string, string>
  readonly change: boolean
}

export function plierLesClefs(brut: unknown): Pliage | null {
  if (!Array.isArray(brut)) return null

  const renommes = new Map<string, string>()
  let change = false
  const liste = brut.map((item) => {
    if (typeof item !== 'object' || item === null) return item
    const objet = item as Record<string, unknown>
    const avant = objet['clef']
    const apres = clefPropre(avant)
    if (apres === null || apres === avant) return item
    change = true
    if (typeof avant === 'string') renommes.set(avant, apres)
    return { ...objet, clef: apres }
  })

  return { liste, renommes, change }
}
