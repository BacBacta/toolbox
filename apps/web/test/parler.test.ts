// @vitest-environment happy-dom
import 'fake-indexeddb/auto'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { parler } from '../src/agent.js'

/**
 * Ce que le client fait de ce que le serveur répond.
 *
 * Chaque façon d'échouer doit se dire à l'utilisateur, et se dire **juste** :
 * « le modèle n'a pas répondu » envoie quelqu'un chercher une panne pendant
 * que la vraie cause — un crédit épuisé, un service pas encore ouvert — tient
 * en une phrase.
 */

beforeAll(async () => {
  const { jetonDeCetAppareil } = await import('../src/appareil.js')
  await jetonDeCetAppareil()
})

afterEach(() => vi.unstubAllGlobals())

function fluxDe(texte: string): ReadableStream<Uint8Array> {
  const octets = new TextEncoder().encode(texte)
  let i = 0
  return new ReadableStream({
    pull(f) {
      if (i >= octets.length) {
        f.close()
        return
      }
      f.enqueue(octets.slice(i, i + 4))
      i += 4
    },
  })
}

function repond(statut: number, corps: unknown, texte?: string): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: statut >= 200 && statut < 300,
    status: statut,
    body: texte === undefined ? null : fluxDe(texte),
    json: () => Promise.resolve(corps),
  }))
}

const DIS = { messages: [{ qui: 'personne' as const, texte: 'un suivi' }] }

async function signes(): Promise<{ sorte: string; pourquoi?: string }[]> {
  const vus: { sorte: string; pourquoi?: string }[] = []
  for await (const s of parler(DIS)) vus.push(s as never)
  return vus
}

describe('chaque refus se dit pour ce qu’il est', () => {
  it('« pas encore ouvert » n’est pas une panne', () => {
    repond(503, {})
    return expect(signes()).resolves.toEqual([{ sorte: 'pas-ouvert' }])
  })

  it('le crédit épuisé porte la phrase du serveur', async () => {
    // Il ne dit pas la même chose à un essai épuisé qu'à un abonné qui a tout
    // consommé.
    repond(402, { erreur: 'credits-epuises', pourquoi: 'plus de crédit pour composer' })
    expect(await signes()).toEqual([
      { sorte: 'sans-credit', pourquoi: 'plus de crédit pour composer' },
    ])
  })

  it('l’abonnement requis se distingue du crédit épuisé', async () => {
    // Le navigateur annonce le prix ; le serveur tranche. Ce ne sont pas les
    // mêmes suites : l'un recharge, l'autre s'abonne.
    repond(402, { erreur: 'abonnement-requis', pourquoi: 'Cette demande vaut plusieurs outils.' })
    expect((await signes())[0]).toMatchObject({ sorte: 'abonnement-requis' })
  })

  it('un refus sans corps lisible se dit quand même', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 402, json: () => Promise.reject(new Error('vide')),
    }))
    expect((await signes())[0]).toMatchObject({ sorte: 'sans-credit', pourquoi: '' })
  })

  it('les autres codes se disent « le service a refusé »', async () => {
    repond(400, {})
    expect(await signes()).toEqual([{ sorte: 'panne', pourquoi: 'le service a refusé' }])
  })

  it('le réseau absent se nomme, parce que c’est le cas courant ici', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    expect(await signes()).toEqual([{ sorte: 'panne', pourquoi: 'pas de réseau' }])
  })
})

describe('le flux', () => {
  it('rend les événements dans l’ordre', async () => {
    repond(200, {},
      'data: {"sorte":"ebauche","ebauche":{"mot":"Je te","famille":null,"titre":"","pieces":[]}}\n\n' +
      'data: {"sorte":"fin","tour":{"sorte":"mot","mot":"Je te fais ça."},"fcfa":0.2,' +
      '"conversation":"c.1.9e15.s","plan":"essai","credits":4}\n\n')
    expect((await signes()).map((s) => s.sorte)).toEqual(['ebauche', 'fin'])
  })

  it('écarte un événement abîmé sans emporter les suivants', async () => {
    repond(200, {},
      'data: pas du json\n\n' +
      'data: {"sorte":"fin","tour":{"sorte":"mot","mot":"Voilà."},"fcfa":0.2,' +
      '"conversation":"c.1.9e15.s","plan":"essai","credits":4}\n\n')
    expect((await signes()).map((s) => s.sorte)).toEqual(['fin'])
  })

  it('dit qu’une réponse s’est coupée en route, plutôt que de se taire', async () => {
    /*
     * Le cas courant ici : une connexion mobile qui lâche pendant que l'agent
     * écrit. Sans ce mot, l'écran revenait au repos avec une phrase à moitié
     * écrite — et le tour, lui, a bien été payé.
     */
    repond(200, {},
      'data: {"sorte":"ebauche","ebauche":{"mot":"Je te","famille":null,"titre":"","pieces":[]}}\n\n')
    expect((await signes()).at(-1)).toMatchObject({ pourquoi: 'la réponse s’est coupée en route' })
  })

  it('attrape un flux qui casse en pleine lecture', async () => {
    /*
     * Une connexion mobile qui lâche en plein milieu ne rend pas un code
     * d'erreur : elle jette. Sans filet, le rejet remonte jusqu'à l'écran, qui
     * n'a rien pour l'attraper — la conversation reste figée sur une phrase à
     * moitié écrite, et le tour a été payé.
     */
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: new ReadableStream({
        start(f) {
          f.enqueue(new TextEncoder().encode('data: {"sorte":"ebauche","ebauche":{"mot":"Je"'))
          f.error(new Error('connexion perdue'))
        },
      }),
      json: () => Promise.resolve({}),
    }))
    const vus = await signes()
    expect(vus.at(-1)).toMatchObject({ pourquoi: 'la réponse s’est coupée en route' })
  })

  it('ne se plaint pas quand le serveur a dit la panne lui-même', async () => {
    repond(200, {}, 'data: {"sorte":"panne","pourquoi":"le modèle n’a pas répondu"}\n\n')
    expect(await signes()).toHaveLength(1)
  })
})
