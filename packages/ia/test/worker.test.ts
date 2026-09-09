import { describe, expect, it } from 'vitest'
import { onRequest } from '../src/worker.js'

/**
 * L'adaptateur Cloudflare, éprouvé pour ce qu'il est : trente lignes
 * d'emballage. Il ne décide rien, mais il est le seul endroit qui touche à un
 * `Request` — et une erreur ici rend le proxy muet sans que rien n'échoue au
 * déploiement.
 */

const FERME = {} as const

function poste(corps: unknown, env: Record<string, string | undefined> = FERME): Promise<Response> {
  return onRequest({
    request: new Request('https://exemple.cm/api/ai', {
      method: 'POST',
      body: JSON.stringify(corps),
      headers: { 'content-type': 'application/json' },
    }),
    env,
  })
}

describe('l’adaptateur Cloudflare', () => {
  it('refuse tout ce qui n’est pas un POST', async () => {
    const r = await onRequest({
      request: new Request('https://exemple.cm/api/ai'),
      env: FERME,
    })
    expect(r.status).toBe(405)
    expect(await r.json()).toEqual({ erreur: 'méthode non permise' })
  })

  it('rend du JSON, et interdit qu’on le mette en cache', async () => {
    // Une réponse du modèle est payée et unique : la mettre en cache servirait
    // la composition d'un autre à celui qui demande la sienne.
    const r = await poste({ demande: 'un devis' })
    expect(r.headers.get('content-type')).toContain('application/json')
    expect(r.headers.get('cache-control')).toBe('no-store')
  })

  it('reste fermé tant qu’on ne l’a pas ouvert, même avec la clef', async () => {
    // Deux gestes et non un : poser la clef n'ouvre pas un robinet qui coûte.
    const r = await poste({ demande: 'un devis' }, { A237_CLEF_IA: 'sk-secrete' })
    expect(r.status).toBe(503)
    expect(JSON.stringify(await r.json())).not.toContain('sk-secrete')
  })

  it('traite un corps illisible comme une demande absente', async () => {
    // Et non comme une panne : une exception qui remonte donnerait un 500,
    // et le client réessaierait indéfiniment.
    const r = await onRequest({
      request: new Request('https://exemple.cm/api/ai', { method: 'POST', body: 'pas du json' }),
      env: { A237_CLEF_IA: 'k', A237_IA_OUVERTE: '1' },
    })
    expect(r.status).toBe(400)
  })

  it('lit ses variables dans `env`, jamais dans `process`', async () => {
    // Un Worker n'a pas de `process`. Les lire au chargement du module aurait
    // marché sur Vercel et rendu partout `undefined` ici.
    const source = await import('node:fs').then((fs) =>
      fs.readFileSync(new URL('../src/fonction.ts', import.meta.url), 'utf8'),
    )
    expect(source).not.toMatch(/process\.env\.[A-Z]/)
  })
})
