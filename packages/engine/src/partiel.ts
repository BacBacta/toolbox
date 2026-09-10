/**
 * Lire du JSON qui n'est pas encore fini.
 *
 * Le modèle écrit sa réponse caractère par caractère. Attendre la fin pour
 * montrer quoi que ce soit, c'est laisser quelqu'un devant un écran vide
 * pendant huit secondes en se demandant si ça marche — et sur une connexion
 * qui hoquette, huit secondes deviennent trente. Ce qui arrive doit se voir
 * arriver.
 *
 * `{"titre":"Quincaill` n'est pas du JSON. Ce fichier le referme : la chaîne
 * ouverte se termine, les objets et les tableaux ouverts se ferment, et ce qui
 * en sort est une valeur qu'on peut dessiner. Elle sera remplacée par la
 * suivante au caractère d'après ; aucune de ces valeurs n'est prise pour
 * argent comptant — **rien de ce qui sort d'ici n'atteint un outil**. Seule la
 * réponse complète, passée par `lireReponseModele`, en fabrique un.
 *
 * C'est donc un lecteur d'aperçu, et il n'a le droit de rien casser : il ne
 * jette jamais, et rend `undefined` tant que le modèle n'a pas même ouvert son
 * objet. Une accolade seule rend `{}` — il a commencé, il n'a rien dit encore.
 */

/**
 * Ce qu'on referme, et jusqu'où.
 *
 * On ne devine pas la suite : une clef commencée mais sans valeur est
 * abandonnée, parce qu'inventer sa valeur ferait clignoter à l'écran quelque
 * chose que le modèle n'a pas écrit.
 */
export function lireJsonPartiel(texte: string): unknown {
  const brut = degainer(texte)
  if (brut === '') return undefined

  // Le cas courant, et le plus rapide : c'est déjà du JSON entier.
  try {
    return JSON.parse(brut)
  } catch {
    // On referme, alors.
  }

  const referme = refermer(brut)
  if (referme === null) return undefined
  try {
    return JSON.parse(referme)
  } catch {
    return undefined
  }
}

/**
 * Retire ce qui entoure le JSON quand le modèle l'enveloppe.
 *
 * Le même déshabillage que pour une réponse complète, en plus simple : en
 * cours de route la clôture du bloc de code n'est pas encore arrivée, donc on
 * ne cherche que l'ouverture.
 */
function degainer(texte: string): string {
  const sansBloc = texte.replace(/^\s*```(?:json)?\s*/i, '')
  const debut = sansBloc.indexOf('{')
  return debut === -1 ? '' : sansBloc.slice(debut).trimEnd()
}

/**
 * Un cadre ouvert, et ce qu'il attend ensuite.
 *
 * C'est ce qui distingue une clef d'une valeur, et cette distinction décide de
 * tout : une chaîne qui s'écrit est une phrase qu'on veut voir apparaître, une
 * clef qui s'écrit est un mot dont on ne sait pas encore ce qu'il annonce.
 */
interface Cadre {
  readonly ouverture: '{' | '['
  attend: 'clef' | 'deux-points' | 'valeur' | 'virgule'
}

/** Rend `null` quand il n'y a rien de refermable — un `{` tout seul suffit. */
function refermer(brut: string): string | null {
  const pile: Cadre[] = []
  let dansUneChaine = false
  let echappe = false
  let clefCourante = false
  let dansUnLitteral = false
  /**
   * Le dernier endroit où couper donne du JSON valide une fois refermé.
   *
   * Il avance après chaque membre complet, et **pas** après une clef : une clef
   * sans sa valeur n'est pas un état qu'on peut montrer.
   */
  let sur = -1

  const haut = (): Cadre | undefined => pile.at(-1)
  const finDeValeur = (i: number): void => {
    const c = haut()
    if (c !== undefined) c.attend = 'virgule'
    sur = i
  }

  for (let i = 0; i < brut.length; i++) {
    const c = brut.charAt(i)

    if (dansUneChaine) {
      if (echappe) echappe = false
      else if (c === '\\') echappe = true
      else if (c === '"') {
        dansUneChaine = false
        if (clefCourante) {
          const cadre = haut()
          if (cadre !== undefined) cadre.attend = 'deux-points'
        } else finDeValeur(i + 1)
      }
      continue
    }

    if (dansUnLitteral && /[\s,}\]]/.test(c)) {
      dansUnLitteral = false
      finDeValeur(i)
      // Le délimiteur reste à traiter ci-dessous.
    }

    if (c === '"') {
      dansUneChaine = true
      clefCourante = haut()?.attend === 'clef'
      continue
    }

    if (c === '{' || c === '[') {
      pile.push({ ouverture: c, attend: c === '{' ? 'clef' : 'valeur' })
      sur = i + 1
      continue
    }

    if (c === '}' || c === ']') {
      pile.pop()
      finDeValeur(i + 1)
      continue
    }

    if (c === ':') {
      const cadre = haut()
      if (cadre !== undefined) cadre.attend = 'valeur'
      continue
    }

    if (c === ',') {
      const cadre = haut()
      if (cadre !== undefined) cadre.attend = cadre.ouverture === '{' ? 'clef' : 'valeur'
      // Avant la virgule : ce qui la suit n'est pas encore écrit.
      sur = i
      continue
    }

    if (!/\s/.test(c)) dansUnLitteral = true
  }

  if (pile.length === 0) return null

  const fermetures = [...pile].reverse().map((c) => (c.ouverture === '{' ? '}' : ']')).join('')

  /*
   * Une chaîne de valeur en cours est le seul cas qu'on garde entière : c'est
   * précisément le texte qu'on veut voir s'écrire. On la referme — après avoir
   * jeté une barre oblique qui attendait encore ce qu'elle échappe, sans quoi
   * le guillemet ajouté deviendrait le caractère échappé.
   */
  if (dansUneChaine && !clefCourante) {
    const propre = echappe ? brut.slice(0, -1) : brut
    return `${propre}"${fermetures}`
  }

  if (sur < 0) return null
  const coupe = brut.slice(0, sur).replace(/,\s*$/, '')
  return coupe === '' ? null : coupe + fermetures
}
