import type { Ebauche, LectureTour } from '@a237/engine'
import { entetesDAppareil } from './appareil.js'
import { noterApresComposition } from './compte.js'

/**
 * Parler à l'agent, et recevoir ce qu'il écrit pendant qu'il l'écrit.
 *
 * Le modèle n'est jamais appelé d'ici. Cette fonction parle à `/api/chat`, qui
 * détient la clef dans son environnement et ne la rend à personne (§ 2.8). Ce
 * qui revient n'est pas du HTML ni du code : une phrase, et une configuration
 * que le moteur a déjà validée (§ 3, point 5).
 *
 * `EventSource` ne sert à rien ici : il ne sait pas faire de `POST`, et il
 * faudrait mettre la conversation dans l'adresse. On lit donc le corps de la
 * réponse à la main, ce qui a l'avantage de rendre l'abandon possible — quand
 * quelqu'un ferme l'écran, le tour s'arrête.
 */

export type Signe =
  /** Ce qu'il y a à montrer maintenant. Remplace entièrement le précédent. */
  | { readonly sorte: 'ebauche'; readonly ebauche: Ebauche }
  | {
      readonly sorte: 'fin'
      readonly tour: LectureTour
      readonly fcfa: number
      readonly conversation: string
    }
  /** Le proxy existe mais n'est pas ouvert. On le dit, on ne fait pas semblant. */
  | { readonly sorte: 'pas-ouvert' }
  | { readonly sorte: 'sans-credit'; readonly pourquoi: string }
  | { readonly sorte: 'abonnement-requis'; readonly pourquoi: string }
  | { readonly sorte: 'panne'; readonly pourquoi: string }

export interface Dit {
  readonly qui: 'personne' | 'agent'
  readonly texte: string
}

export interface Tour {
  readonly messages: readonly Dit[]
  /** L'outil déjà sur la table, tel que le dernier tour l'a rendu. */
  readonly outil?: unknown
  /** Le laissez-passer du tour précédent : sans lui, on repaie un crédit. */
  readonly conversation?: string
}

/**
 * Un tour, rendu signe par signe.
 *
 * Un générateur et non un rappel : celui qui appelle décide du rythme auquel il
 * redessine, et `for await` s'arrête tout seul quand on quitte l'écran.
 */
export async function* parler(tour: Tour, signal?: AbortSignal): AsyncGenerator<Signe> {
  let reponse: Response
  try {
    reponse = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(await entetesDAppareil()) },
      body: JSON.stringify(tour),
      ...(signal !== undefined ? { signal } : {}),
    })
  } catch {
    // Hors ligne, ou réseau capricieux : c'est le cas courant ici.
    yield { sorte: 'panne', pourquoi: 'pas de réseau' }
    return
  }

  if (reponse.status === 503) {
    yield { sorte: 'pas-ouvert' }
    return
  }

  if (reponse.status === 402) {
    const corps = (await reponse.json().catch(() => null)) as
      | { erreur?: unknown; pourquoi?: unknown }
      | null
    const pourquoi = typeof corps?.pourquoi === 'string' ? corps.pourquoi : ''
    yield corps?.erreur === 'abonnement-requis'
      ? { sorte: 'abonnement-requis', pourquoi }
      : { sorte: 'sans-credit', pourquoi }
    return
  }

  if (!reponse.ok || reponse.body === null) {
    yield { sorte: 'panne', pourquoi: 'le service a refusé' }
    return
  }

  let fini = false
  try {
    for await (const signe of lireLeFlux(reponse.body)) {
      // Le solde revient avec le dernier événement : le compte se tient à jour
      // sans qu'on l'interroge, et sans coûter un aller-retour de plus.
      if (signe.sorte === 'fin') {
        await noterApresComposition(signe.plan, signe.credits)
        fini = true
      }
      if (signe.sorte === 'panne') fini = true
      yield versSigne(signe)
    }
  } catch {
    /*
     * Le flux a cassé pendant qu'on le lisait.
     *
     * Une connexion mobile qui lâche en plein milieu ne rend pas un code
     * d'erreur : elle jette. Sans ce filet, le rejet remonte jusqu'à l'écran,
     * qui n'a rien pour l'attraper — la conversation reste figée sur une
     * phrase à moitié écrite, et le tour a été payé. Le mot ci-dessous est le
     * même que pour un flux qui s'arrête sans conclure, parce que c'est la
     * même chose vue de l'utilisateur.
     */
  }

  /*
   * Un flux qui s'arrête sans conclure.
   *
   * C'est le cas courant ici, pas l'exception : une connexion mobile qui
   * lâche pendant qu'on écrit coupe la réponse au milieu. Sans ce mot, l'écran
   * revenait au repos avec une phrase à moitié écrite et rien pour dire
   * pourquoi — et le tour, lui, a bien été payé.
   */
  if (!fini) yield { sorte: 'panne', pourquoi: 'la réponse s’est coupée en route' }
}

interface EvenementRecu {
  readonly sorte: string
  readonly ebauche?: Ebauche
  readonly tour?: LectureTour
  readonly fcfa?: number
  readonly conversation?: string
  readonly plan?: unknown
  readonly credits?: unknown
  readonly pourquoi?: string
  readonly sansCredit?: boolean
}

function versSigne(e: EvenementRecu): Signe {
  if (e.sorte === 'ebauche' && e.ebauche !== undefined) {
    return { sorte: 'ebauche', ebauche: e.ebauche }
  }
  if (e.sorte === 'fin' && e.tour !== undefined) {
    return {
      sorte: 'fin',
      tour: e.tour,
      fcfa: typeof e.fcfa === 'number' ? e.fcfa : 0,
      conversation: e.conversation ?? '',
    }
  }
  const pourquoi = e.pourquoi ?? 'le modèle n’a pas répondu'
  return e.sansCredit === true
    ? { sorte: 'sans-credit', pourquoi }
    : { sorte: 'panne', pourquoi }
}

/**
 * Les événements d'un flux, un par un.
 *
 * Le tampon garde ce qui dépasse : un morceau de réseau ne s'arrête pas à la
 * fin d'un événement, et `TextDecoder` en mode continu recolle les octets d'un
 * « é » arrivé en deux fois — sans quoi la conversation afficherait des
 * losanges là où l'agent a écrit du français.
 */
async function* lireLeFlux(corps: ReadableStream<Uint8Array>): AsyncGenerator<EvenementRecu> {
  const lecteur = corps.getReader()
  const decodeur = new TextDecoder()
  let tampon = ''

  try {
    for (;;) {
      const { done, value } = await lecteur.read()
      if (done) break
      tampon += decodeur.decode(value, { stream: true })

      let fin = tampon.indexOf('\n\n')
      while (fin !== -1) {
        const brut = tampon.slice(0, fin).trim()
        tampon = tampon.slice(fin + 2)
        fin = tampon.indexOf('\n\n')
        if (!brut.startsWith('data:')) continue
        try {
          yield JSON.parse(brut.slice(5).trim()) as EvenementRecu
        } catch {
          // Un événement abîmé ne doit pas emporter les suivants.
        }
      }
    }
  } finally {
    lecteur.cancel().catch(() => undefined)
  }
}
