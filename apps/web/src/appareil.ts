import { createStore, get, set } from 'idb-keyval'
import { tirerJeton } from '@a237/comptes'

/**
 * Ce qui fait qu'on est soi, sans avoir rien rempli.
 *
 * L'atelier marche tout de suite, hors ligne, sans inscription (§ 2) : il n'y
 * a donc rien à demander avant de se servir. L'appareil tire son jeton au
 * premier lancement et le garde ; le serveur ne le voit qu'au premier appel
 * qui coûte quelque chose, et lui ouvre un compte à ce moment-là.
 *
 * **Un magasin à part**, comme les numéros de facture. Effacer ses outils ne
 * doit pas effacer son abonnement : ce sont deux choses différentes, et les
 * ranger ensemble les ferait disparaître ensemble.
 *
 * Ce que ce jeton n'est pas : un secret partagé avec quelqu'un d'autre, ni une
 * clef d'API. C'est un nom que personne d'autre ne peut deviner, et le serveur
 * n'en garde que l'empreinte.
 */

const APPAREIL = createStore('atelier237-appareil', 'appareil')
const CLEF = 'jeton'

let enMemoire: string | null = null

export async function jetonDeCetAppareil(): Promise<string> {
  if (enMemoire !== null) return enMemoire

  const range = await get<string>(CLEF, APPAREIL)
  if (typeof range === 'string' && range !== '') {
    enMemoire = range
    return range
  }

  const neuf = tirerJeton()
  await set(CLEF, neuf, APPAREIL)
  enMemoire = neuf
  return neuf
}

/** L'en-tête que porte chaque requête qui engage le compte. */
export async function entetesDAppareil(): Promise<Record<string, string>> {
  return { authorization: `Appareil ${await jetonDeCetAppareil()}` }
}

/** Remet le cache en mémoire à zéro. Sert aux essais, et à rien d'autre. */
export function oublierEnMemoire(): void {
  enMemoire = null
}
