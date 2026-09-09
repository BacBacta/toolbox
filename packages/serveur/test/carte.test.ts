import { describe, expect, it } from 'vitest'
import { TAILLE_MAX_CARTE, estPng, onRequest } from '../src/worker-carte.js'

/**
 * Le seau des cartes est servi sous une adresse de ce domaine. Ce qui y entre
 * doit être une image, et rien d'autre : y laisser passer n'importe quoi
 * reviendrait à offrir un hébergement de fichiers sous notre nom.
 */

const LIEN = 'K7M2XQ4BN9PZ'
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])

function seau(contenu: Uint8Array | null = null): {
  env: { CARTES: { get: (c: string) => Promise<{ body: ReadableStream } | null>; put: (c: string, v: ArrayBuffer) => Promise<unknown> } }
  depose: Map<string, ArrayBuffer>
} {
  const depose = new Map<string, ArrayBuffer>()
  return {
    env: {
      CARTES: {
        get: () =>
          Promise.resolve(
            contenu === null
              ? null
              : { body: new Blob([contenu as unknown as BlobPart]).stream() },
          ),
        put: (c: string, v: ArrayBuffer) => {
          depose.set(c, v)
          return Promise.resolve(undefined)
        },
      },
    },
    depose,
  }
}

function deposer(corps: Uint8Array, lien = `${LIEN}.png`): ReturnType<typeof onRequest> {
  const s = seau()
  return onRequest({
    request: new Request('https://exemple.cm/c/x.png', {
      method: 'PUT',
      body: corps as unknown as BodyInit,
    }),
    params: { lien },
    env: s.env,
  })
}

describe('la signature d’un PNG', () => {
  it('reconnaît un PNG et refuse tout le reste', () => {
    expect(estPng(PNG)).toBe(true)
    expect(estPng(new Uint8Array([0x3c, 0x73, 0x76, 0x67]))).toBe(false)
    expect(estPng(new Uint8Array([0x89, 0x50]))).toBe(false)
    expect(estPng(new Uint8Array())).toBe(false)
  })
})

describe('déposer une carte', () => {
  it('accepte un PNG', async () => {
    expect((await deposer(PNG)).status).toBe(200)
  })

  it('refuse ce qui n’est pas une image, quel que soit l’en-tête annoncé', async () => {
    // `content-type` est déclaratif. C'est la signature qui décide.
    const r = await onRequest({
      request: new Request('https://exemple.cm/c/x.png', {
        method: 'PUT',
        headers: { 'content-type': 'image/png' },
        body: '<svg onload="alert(1)"/>',
      }),
      params: { lien: `${LIEN}.png` },
      env: seau().env,
    })
    expect(r.status).toBe(415)
    expect((await r.json() as { erreur: string }).erreur).toBe('pas-une-image')
  })

  it('refuse une carte plus grosse qu’une carte', async () => {
    const grosse = new Uint8Array(TAILLE_MAX_CARTE + 1)
    grosse.set(PNG.slice(0, 8))
    expect((await deposer(grosse)).status).toBe(413)
  })

  it('refuse un lien mal formé, avant de toucher au seau', async () => {
    expect((await deposer(PNG, 'court.png')).status).toBe(404)
    expect((await deposer(PNG, '../../../etc.png')).status).toBe(404)
  })

  it('range sous le lien, sans le suffixe', async () => {
    const s = seau()
    await onRequest({
      request: new Request('https://exemple.cm/c/x.png', { method: 'PUT', body: PNG as unknown as BodyInit }),
      params: { lien: `${LIEN}.png` },
      env: s.env,
    })
    expect([...s.depose.keys()]).toEqual([LIEN])
  })
})

describe('servir une carte', () => {
  it('la rend en image, immuable pour un an', async () => {
    // La carte d'une publication ne change pas. Une republication en dépose une
    // nouvelle ; l'aperçu d'une discussion garde l'ancienne, qui est celle
    // qu'on a envoyée ce jour-là.
    const r = await onRequest({
      request: new Request('https://exemple.cm/c/x.png'),
      params: { lien: `${LIEN}.png` },
      env: seau(PNG).env,
    })
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toBe('image/png')
    expect(r.headers.get('cache-control')).toContain('immutable')
    expect(r.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('rend 404 quand la carte n’a pas été déposée', async () => {
    const r = await onRequest({
      request: new Request('https://exemple.cm/c/x.png'),
      params: { lien: `${LIEN}.png` },
      env: seau(null).env,
    })
    expect(r.status).toBe(404)
  })

  it('refuse les autres méthodes', async () => {
    const r = await onRequest({
      request: new Request('https://exemple.cm/c/x.png', { method: 'DELETE' }),
      params: { lien: `${LIEN}.png` },
      env: seau().env,
    })
    expect(r.status).toBe(405)
  })
})
