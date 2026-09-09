import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * La fonction serveur, éprouvée sans réseau ni clef.
 *
 * Ce qui se joue ici n'est pas de la plomberie : c'est le seul endroit du
 * dépôt où une clef d'API existe, et le seul robinet qui coûte de l'argent à
 * chaque ouverture. Deux propriétés valent d'être tenues par un test —
 * **poser la clef n'ouvre pas le robinet**, et **la clef ne ressort jamais**,
 * même quand le fournisseur la renvoie dans un message d'erreur.
 */

const ENV = { ...process.env }

async function appeler(
  req: { method?: string; body?: unknown },
): Promise<{ statut: number; corps: Record<string, unknown> }> {
  const { default: handler } = await import('../src/fonction.js')
  let statut = 0
  let corps: unknown
  const res = {
    status(code: number) {
      statut = code
      return res
    },
    json(c: unknown) {
      corps = c
    },
  }
  await handler(req, res)
  return { statut, corps: (corps ?? {}) as Record<string, unknown> }
}

beforeEach(() => {
  vi.resetModules()
  process.env = { ...ENV }
})

afterEach(() => {
  process.env = ENV
  vi.unstubAllGlobals()
})

describe('le robinet reste fermé tant qu’on ne l’ouvre pas', () => {
  it('refuse sans clef', async () => {
    delete process.env.A237_CLEF_IA
    const r = await appeler({ method: 'POST', body: { demande: 'un registre' } })
    expect(r.statut).toBe(503)
  })

  it('refuse avec la clef mais sans ouverture explicite', async () => {
    // Le point important. Poser `A237_CLEF_IA` sur un déploiement public
    // ouvrirait, sans quota et sans comptes, un service payant à qui passe.
    // Il faut le vouloir en deux gestes, pas en un.
    process.env.A237_CLEF_IA = 'une-clef'
    delete process.env.A237_IA_OUVERTE
    const r = await appeler({ method: 'POST', body: { demande: 'un registre' } })
    expect(r.statut).toBe(503)
  })

  it('refuse toute méthode qui n’est pas POST', async () => {
    const r = await appeler({ method: 'GET' })
    expect(r.statut).toBe(405)
  })
})

describe('une fois ouvert', () => {
  beforeEach(() => {
    process.env.A237_CLEF_IA = 'une-clef'
    process.env.A237_IA_OUVERTE = '1'
  })

  it.each([
    ['une demande absente', {}],
    ['une demande vide', { demande: '   ' }],
    ['une demande à rallonge', { demande: 'x'.repeat(401) }],
  ])('refuse %s', async (_quoi, body) => {
    const r = await appeler({ method: 'POST', body })
    expect(r.statut).toBe(400)
  })

  it('ne laisse jamais fuiter la clef quand le fournisseur échoue', async () => {
    // Un fournisseur peut renvoyer la clef dans le corps de son erreur. Ce
    // corps ne doit pas traverser jusqu'au navigateur.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: { message: 'API key une-clef invalide' } }),
    }))
    const r = await appeler({ method: 'POST', body: { demande: 'un registre' } })
    expect(r.statut).toBe(502)
    expect(JSON.stringify(r.corps)).not.toContain('une-clef')
  })

  it('rend un 422 quand le modèle ne produit rien d’utilisable, sans boucler', async () => {
    const appels = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        candidates: [{ content: { parts: [{ text: '<div>bonjour</div>' }] } }],
        usageMetadata: { promptTokenCount: 1500, candidatesTokenCount: 500 },
      }),
    })
    vi.stubGlobal('fetch', appels)
    const r = await appeler({ method: 'POST', body: { demande: 'un registre' } })
    expect(r.statut).toBe(422)
    // Un essai, une reprise, puis on s'arrête (§ 3).
    expect(appels).toHaveBeenCalledTimes(2)
  })

  it('rend la configuration validée, et ce qu’elle a coûté', async () => {
    const registre = {
      titre: 'Suivi des livraisons',
      kicker: 'SUIVI DES LIVRAISONS',
      titreNom: 'Nom du dépôt',
      colonnes: [{ clef: 'client', titre: 'Client', type: 'texte' }],
      libelleVide: 'Aucune livraison pour l’instant.',
      libelleAjout: 'Ajouter une livraison',
      relancesVides: 'Un suivi se consulte, il ne se relance pas.',
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        candidates: [{ content: { parts: [{ text: JSON.stringify(registre) }] } }],
        usageMetadata: { promptTokenCount: 1500, candidatesTokenCount: 500 },
      }),
    }))
    const r = await appeler({ method: 'POST', body: { demande: 'suivre mes livraisons' } })
    expect(r.statut).toBe(200)
    expect(r.corps.registre).toMatchObject({ titre: 'Suivi des livraisons' })
    // La promesse du brief : moins d'un franc la génération (§ 8).
    expect(r.corps.fcfa as number).toBeLessThan(1)
  })
})
