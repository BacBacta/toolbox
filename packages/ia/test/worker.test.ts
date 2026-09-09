import { describe, expect, it } from 'vitest'
import { baseDEssai } from '../../comptes/test/sqlite.js'
import { onRequest } from '../src/worker.js'

/**
 * L'adaptateur Cloudflare, éprouvé pour ce qu'il est : trente lignes
 * d'emballage. Il ne décide rien, mais il est le seul endroit qui touche à un
 * `Request` — et une erreur ici rend le proxy muet sans que rien n'échoue au
 * déploiement.
 */

const FERME = {} as const

/** Un jeton d'appareil bien formé : cent vingt-huit bits en hexadécimal. */
const JETON = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'

function poste(
  corps: unknown,
  env: Record<string, string | undefined> = FERME,
  entetes: Record<string, string> = { authorization: `Appareil ${JETON}` },
): Promise<Response> {
  return onRequest({
    request: new Request('https://exemple.cm/api/ai', {
      method: 'POST',
      body: JSON.stringify(corps),
      headers: { 'content-type': 'application/json', ...entetes },
    }),
    env: { ...env, COMPTES: baseDEssai() },
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
      request: new Request('https://exemple.cm/api/ai', {
        method: 'POST',
        body: 'pas du json',
        headers: { authorization: `Appareil ${JETON}` },
      }),
      env: { A237_CLEF_IA: 'k', A237_IA_OUVERTE: '1', COMPTES: baseDEssai() },
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

describe('l’appareil doit se présenter', () => {
  const OUVERT = { A237_CLEF_IA: 'k', A237_IA_OUVERTE: '1' }

  it('sans en-tête, rien ne part', async () => {
    const r = await poste({ demande: 'un devis' }, OUVERT, {})
    expect(r.status).toBe(401)
    expect((await r.json() as { erreur: string }).erreur).toBe('appareil-inconnu')
  })

  it('un jeton mal formé se refuse sur sa forme, sans toucher à la base', async () => {
    for (const faux of ['Appareil pas-un-jeton', 'Bearer ' + JETON, JETON, 'Appareil ']) {
      const r = await poste({ demande: 'un devis' }, OUVERT, { authorization: faux })
      expect(r.status, faux).toBe(401)
    }
  })

  it('et sans base de comptes, on ne sert pas — surtout pas gratuitement', async () => {
    /*
     * La liaison peut manquer : un déploiement de prévisualisation qui n'a pas
     * les mêmes ressources. Servir quand même ouvrirait un robinet qui coûte de
     * l'argent à chaque appel et que personne ne compte.
     */
    const r = await onRequest({
      request: new Request('https://exemple.cm/api/ai', {
        method: 'POST',
        body: JSON.stringify({ demande: 'un devis' }),
        headers: { authorization: `Appareil ${JETON}` },
      }),
      env: OUVERT,
    })
    expect(r.status).toBe(503)
  })
})
