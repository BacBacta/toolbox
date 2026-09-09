import { normaliser } from './format.js'

/**
 * Étage 1 du moteur : correspondance directe de mots-clés, **zéro jeton**.
 *
 * Doit couvrir environ 70 % des demandes (BRIEF.md § 4). Ce qui ne matche pas
 * ici monte à l'étage 2 (composition, ~1 500 jetons) puis 3 (libre, ~3 000),
 * les deux seuls étages qui coûtent de l'argent.
 *
 * Le score est la somme des longueurs des mots-clés reconnus : un mot long est
 * plus spécifique qu'un mot court, donc « njangi » l'emporte sur « tour ».
 *
 * À quoi s'ajoute une règle que la longueur seule ne voit pas. Dans « facture
 * pour mon client », `facture` fait sept lettres et `client` six : l'écart ne
 * suffisait pas à trancher, et on posait une question dont la réponse était
 * dans la phrase. Or `facture` **nomme** l'outil, tandis que `client` s'y
 * rapporte seulement — un client est le destinataire d'une facture avant
 * d'être un annuaire. Un mot-clef qui reprend le nom de l'outil compte donc
 * double.
 *
 * Ça ne suffisait pas : « client » nomme l'annuaire aussi bien que « facture »
 * nomme la facture, et les deux doublaient. Ce qui les sépare est
 * grammatical. Dans « facture pour mon client », `facture` est ce qu'on
 * demande et `client` un complément accroché par une préposition ; dans « un
 * devis puis une facture », les deux sont demandés. Un mot-clef introduit par
 * une préposition pèse donc moitié moins — il précise la demande, il ne l'est
 * pas.
 */

/**
 * Ce dont l'étage 1 a besoin. Le titre sert à peser, pas à chercher : un
 * mot-clef qui **nomme** l'outil compte double.
 */
export interface AvecMotsClefs {
  readonly keywords: readonly string[]
  readonly title?: string
}

export interface Correspondance<S extends AvecMotsClefs> {
  readonly squelette: S
  readonly score: number
  readonly reconnus: readonly string[]
}

export function classer<S extends AvecMotsClefs>(
  demande: string,
  squelettes: readonly S[],
): readonly Correspondance<S>[] {
  const texte = normaliser(demande)
  if (texte === '') return []

  return squelettes
    .map((squelette) => {
      const nom = normaliser(squelette.title ?? '')
      const reconnus = squelette.keywords.filter((k) => texte.includes(normaliser(k)))
      const score = reconnus.reduce((a, k) => {
        const plat = normaliser(k)
        const nomme = nom !== '' && nom.includes(plat)
        return a + (k.length * (nomme ? 2 : 1)) / (introduitParPreposition(texte, plat) ? 2 : 1)
      }, 0)
      return { squelette, score, reconnus }
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
}

/*
 * Les prépositions qui accrochent un complément. Un déterminant peut se
 * glisser entre elle et le mot : « pour mon client », « de la boutique ».
 */
const PREPOSITION =
  '(?:pour|de|du|des|a|au|aux|avec|chez|sur|en|dans|par)' +
  '\\s+(?:mon|ma|mes|le|la|les|un|une|des|ce|cette|ces|l)?\\s*'

/**
 * Vrai si **toutes** les occurrences du mot sont introduites par une
 * préposition. Une seule occurrence en position de sujet suffit à ce que le
 * mot compte plein tarif : « prix, liste de prix » demande bien des prix.
 */
function introduitParPreposition(texte: string, mot: string): boolean {
  if (mot === '') return false
  const echappe = mot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const toutes = [...texte.matchAll(new RegExp(echappe, 'g'))]
  if (toutes.length === 0) return false
  const precede = new RegExp(`${PREPOSITION}${echappe}`, 'g')
  const apresPrepo = [...texte.matchAll(precede)].length
  return apresPrepo === toutes.length
}

/** Le squelette qui répond, ou `null` s'il faut monter d'un étage. */
export function trouverSquelette<S extends AvecMotsClefs>(
  demande: string,
  squelettes: readonly S[],
): S | null {
  return classer(demande, squelettes)[0]?.squelette ?? null
}

