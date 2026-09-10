import { memeSignature, signer } from './faux.js'

/**
 * Le laissez-passer d'une conversation.
 *
 * Un outil coûte un crédit. Une conversation en fabrique un, en plusieurs
 * tours — et faire payer chaque tour rendrait la discussion impossible :
 * quelqu'un qui a cinq essais n'ose pas dire « ajoute une colonne » si ça lui
 * coûte le cinquième de ce qu'il a. Le crédit se prend donc **au premier
 * tour**, et les suivants sont compris dedans.
 *
 * Rien de tout cela ne peut vivre côté client. Un compteur de tours que le
 * navigateur renvoie est un compteur qu'on remet à zéro dans les outils de
 * développement, et un « c'est la suite d'une conversation » qu'on affirme
 * sans preuve est une composition gratuite à volonté. Le serveur signe donc ce
 * qu'il a accordé — le compte, le rang du tour, l'heure de péremption — et
 * refuse ce qui ne porte pas sa signature.
 *
 * Le jeton n'est pas un secret : il dit ce qu'il contient, en clair. Ce qu'on
 * empêche n'est pas de le lire, c'est de le fabriquer.
 */

/**
 * Huit tours, et pas un de plus.
 *
 * Ce n'est pas une punition : c'est le fond du crédit. Au-delà, la
 * conversation n'affine plus, elle tourne — et une discussion qui tourne coûte
 * de l'argent à chaque tour sans rapprocher d'un outil. Le message le dit et
 * propose de repartir, ce qui reprend un crédit et remet les idées à plat.
 */
export const TOURS_PAR_CONVERSATION = 8

/** Une conversation abandonnée ne doit pas servir de laissez-passer un mois plus tard. */
export const DUREE_CONVERSATION_MS = 2 * 60 * 60 * 1000

export interface Laissez {
  readonly compteId: string
  /** Le rang du tour qui vient d'être servi. Le premier vaut 1. */
  readonly tours: number
  readonly expire: number
}

function corpsDe(l: Laissez): string {
  return `${l.compteId}.${l.tours}.${l.expire}`
}

export async function signerLaissez(l: Laissez, secret: string): Promise<string> {
  return `${corpsDe(l)}.${await signer(corpsDe(l), secret)}`
}

/**
 * Relit un laissez-passer, ou rend `null`.
 *
 * Toutes les raisons de refuser se ressemblent de l'extérieur — mal formé,
 * signature fausse, périmé, épuisé — et c'est voulu : distinguer « ta
 * signature est fausse » de « ton jeton est périmé » apprend à qui essaie
 * lequel des deux corriger.
 */
export async function relireLaissez(
  jeton: string,
  secret: string,
  maintenant: Date,
): Promise<Laissez | null> {
  const bouts = jeton.split('.')
  if (bouts.length !== 4) return null
  const [compteId = '', brutTours = '', brutExpire = '', signature = ''] = bouts

  const tours = Number(brutTours)
  const expire = Number(brutExpire)
  if (compteId === '' || !Number.isSafeInteger(tours) || !Number.isSafeInteger(expire)) return null

  const attendue = await signer(`${compteId}.${tours}.${expire}`, secret)
  if (!memeSignature(signature, attendue)) return null

  if (expire <= maintenant.getTime()) return null
  if (tours >= TOURS_PAR_CONVERSATION) return null

  return { compteId, tours, expire }
}

/** Le laissez-passer du tour suivant, à partir de celui du tour servi. */
export function tourSuivant(l: Laissez): Laissez {
  return { ...l, tours: l.tours + 1 }
}

/** Le premier laissez-passer d'une conversation, celui qui a coûté un crédit. */
export function premierTour(compteId: string, maintenant: Date): Laissez {
  return { compteId, tours: 1, expire: maintenant.getTime() + DUREE_CONVERSATION_MS }
}
