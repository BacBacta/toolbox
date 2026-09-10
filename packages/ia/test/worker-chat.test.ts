import { compteDeLAppareil, empreinte, premierTour, signerLaissez } from '@a237/comptes'
import type { BaseD1 } from '@a237/comptes'
import { baseDEssai } from '../../comptes/test/sqlite.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequest } from '../src/worker-chat.js'

/**
 * `POST /api/chat` — l'adaptateur, éprouvé pour ce qu'il refuse.
 *
 * C'est une route qui **dépense de l'argent** à chaque appel réussi. Tout ce
 * qui suit vérifie qu'elle ne le fait pas quand elle ne doit pas : sans clef,
 * sans base, sans secret de signature, sans appareil. Servir dans l'un de ces
 * cas ouvre un robinet que personne ne compte.
 */

const JETON = 'a'.repeat(32)
const SECRET = 'un-secret-de-serveur'
const HOTE = 'https://atelier237.pages.dev'

let db: BaseD1

beforeEach(() => {
  db = baseDEssai()
})

afterEach(() => vi.unstubAllGlobals())

const OUVERT = {
  A237_CLEF_IA: 'clef',
  A237_IA_OUVERTE: '1',
  A237_PAIEMENT_SECRET: SECRET,
}

function contexte(
  corps: unknown,
  env: Record<string, unknown> = {},
  entetes: Record<string, string> = { authorization: `Appareil ${JETON}` },
  methode = 'POST',
): never {
  return {
    request: new Request(`${HOTE}/api/chat`, {
      method: methode,
      headers: { 'content-type': 'application/json', ...entetes },
      ...(methode === 'POST' ? { body: JSON.stringify(corps) } : {}),
    }),
    env: { ...OUVERT, COMPTES: db, ...env },
  } as never
}

/** Un routeur qui rend un tour complet, en flux. */
function routeurQuiRepond(tour: unknown): void {
  const sse =
    `data: ${JSON.stringify({ choices: [{ delta: { content: JSON.stringify(tour) } }] })}\n\n` +
    `data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 1_500, completion_tokens: 90 } })}\n\n` +
    'data: [DONE]\n\n'
  const octets = new TextEncoder().encode(sse)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    body: new ReadableStream({
      start(f) {
        f.enqueue(octets)
        f.close()
      },
    }),
  }))
}

const DIS = (texte: string) => ({ messages: [{ qui: 'personne', texte }] })

describe('ce que la route refuse de servir', () => {
  it('sans base de comptes : une génération se compte, ou ne se fait pas', async () => {
    const r = await onRequest(contexte(DIS('un suivi'), { COMPTES: undefined }))
    expect(r.status).toBe(503)
  })

  it('sans clef, ou tant que personne n’a voulu ouvrir', async () => {
    expect((await onRequest(contexte(DIS('x'), { A237_CLEF_IA: '' }))).status).toBe(503)
    expect((await onRequest(contexte(DIS('x'), { A237_IA_OUVERTE: '0' }))).status).toBe(503)
  })

  it('sans le secret qui signe les laissez-passer', async () => {
    // Un laissez-passer non signé est une composition gratuite à volonté.
    const r = await onRequest(contexte(DIS('x'), { A237_PAIEMENT_SECRET: '' }))
    expect(r.status).toBe(503)
  })

  it('sans appareil, ou avec un jeton qui n’en est pas un', async () => {
    expect((await onRequest(contexte(DIS('x'), {}, {}))).status).toBe(401)
    expect(
      (await onRequest(contexte(DIS('x'), {}, { authorization: 'Appareil trop-court' }))).status,
    ).toBe(401)
  })

  it('sur autre chose qu’un POST', async () => {
    expect((await onRequest(contexte(null, {}, {}, 'GET'))).status).toBe(405)
  })

  it('sur un corps qui n’est pas du JSON', async () => {
    const r = await onRequest({
      request: new Request(`${HOTE}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Appareil ${JETON}` },
        body: 'pas du json',
      }),
      env: { ...OUVERT, COMPTES: db },
    } as never)
    expect(r.status).toBe(400)
  })

  it('sur une conversation vide', async () => {
    expect((await onRequest(contexte({ messages: [] }))).status).toBe(400)
  })
})

describe('un tour qui aboutit', () => {
  const TOUR = {
    mot: 'Voilà ton suivi.',
    outil: {
      titre: 'Suivi des livraisons',
      kicker: 'SUIVI DES LIVRAISONS',
      titreNom: 'Nom du dépôt',
      colonnes: [{ clef: 'client', titre: 'Client', type: 'texte' }],
      libelleVide: 'Aucune livraison.',
      libelleAjout: 'Ajouter',
      relancesVides: 'Un suivi ne se relance pas.',
    },
  }

  async function lire(r: Response): Promise<string> {
    return r.text()
  }

  it('rend un flux d’événements, et non un objet', async () => {
    routeurQuiRepond(TOUR)
    const r = await onRequest(contexte(DIS('un suivi de livraisons')))
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toContain('text/event-stream')
    // Un mandataire qui met en tampon annule tout l'intérêt du flux.
    expect(r.headers.get('x-accel-buffering')).toBe('no')
    expect(r.headers.get('cache-control')).toBe('no-store')
  })

  it('montre l’outil s’écrire, puis le rend validé', async () => {
    routeurQuiRepond(TOUR)
    const corps = await lire(await onRequest(contexte(DIS('un suivi de livraisons'))))
    expect(corps).toContain('"sorte":"ebauche"')
    expect(corps).toContain('"sorte":"fin"')
    expect(corps).toContain('Suivi des livraisons')
  })

  it('prend un crédit au premier tour, et pas au suivant', async () => {
    const compte = await compteDeLAppareil(db, await empreinte(JETON), new Date())

    routeurQuiRepond(TOUR)
    await lire(await onRequest(contexte(DIS('un suivi'))))
    const apres = await compteDeLAppareil(db, await empreinte(JETON), new Date())
    expect(apres.credits).toBe(compte.credits - 1)

    routeurQuiRepond(TOUR)
    const laissez = await signerLaissez(premierTour(compte.id, new Date()), SECRET)
    await lire(await onRequest(contexte({ ...DIS('ajoute une colonne'), conversation: laissez })))
    const encore = await compteDeLAppareil(db, await empreinte(JETON), new Date())
    expect(encore.credits).toBe(compte.credits - 1)
  })
})
