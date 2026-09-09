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

/**
 * On appelle `repondre` et non un adaptateur : les réglages arrivent en
 * argument, ce qui laisse chaque cas poser son environnement sans toucher à
 * celui du processus. L'adaptateur Cloudflare, lui, s'éprouve à part.
 */
async function appeler(
  req: { method?: string; body?: unknown },
): Promise<{ statut: number; corps: Record<string, unknown> }> {
  const { reglagesDe, repondre } = await import('../src/fonction.js')
  if (req.method !== undefined && req.method !== 'POST') {
    return { statut: 405, corps: { erreur: 'méthode non permise' } }
  }
  const { statut, corps } = await repondre(req.body, reglagesDe(process.env))
  return { statut, corps }
}

/** La forme d'OpenRouter, qui est le fournisseur par défaut. */
function repondOpenrouter(texte: string, cout?: number): unknown {
  return {
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        choices: [{ message: { content: texte } }],
        usage: {
          prompt_tokens: 1500,
          completion_tokens: 500,
          ...(cout !== undefined ? { cost: cout } : {}),
        },
      }),
  }
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
    const appels = vi.fn().mockResolvedValue(repondOpenrouter('<div>bonjour</div>'))
    vi.stubGlobal('fetch', appels)
    const r = await appeler({ method: 'POST', body: { demande: 'un registre' } })
    expect(r.statut).toBe(422)
    // Un essai, une reprise, puis on s'arrête (§ 3).
    expect(appels).toHaveBeenCalledTimes(2)
    // Un échec a coûté deux tours : l'omettre ferait sous-estimer la dépense.
    expect(r.corps.fcfa).toBeGreaterThan(0)
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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(repondOpenrouter(JSON.stringify(registre))))
    const r = await appeler({ method: 'POST', body: { demande: 'suivre mes livraisons' } })
    expect(r.statut).toBe(200)
    expect(r.corps.registre).toMatchObject({ titre: 'Suivi des livraisons' })
    // La promesse du brief : moins d'un franc la génération (§ 8).
    expect(r.corps.fcfa as number).toBeLessThan(1)
  })
})

describe('le fournisseur se choisit sans redéployer', () => {
  const REGISTRE = {
    titre: 'Suivi des livraisons',
    kicker: 'SUIVI DES LIVRAISONS',
    titreNom: 'Nom du dépôt',
    colonnes: [{ clef: 'client', titre: 'Client', type: 'texte' }],
    libelleVide: 'Aucune livraison pour l’instant.',
    libelleAjout: 'Ajouter une livraison',
    relancesVides: 'Un suivi se consulte, il ne se relance pas.',
  }

  beforeEach(() => {
    process.env.A237_CLEF_IA = 'une-clef'
    process.env.A237_IA_OUVERTE = '1'
  })

  it('passe par OpenRouter par défaut, avec le modèle du brief', async () => {
    const appels = vi.fn().mockResolvedValue(repondOpenrouter(JSON.stringify(REGISTRE)))
    vi.stubGlobal('fetch', appels)
    await appeler({ method: 'POST', body: { demande: 'suivre mes livraisons' } })

    const [url, options] = appels.mock.calls[0] as [string, { body: string }]
    expect(url).toContain('openrouter.ai')
    expect(JSON.parse(options.body).model).toBe('google/gemini-2.5-flash-lite')
  })

  it('suit A237_MODELE, parce que le brief pose un budget et non une marque', async () => {
    process.env.A237_MODELE = 'google/gemini-3.1-flash-lite'
    const appels = vi.fn().mockResolvedValue(repondOpenrouter(JSON.stringify(REGISTRE)))
    vi.stubGlobal('fetch', appels)
    await appeler({ method: 'POST', body: { demande: 'suivre mes livraisons' } })

    const [, options] = appels.mock.calls[0] as [string, { body: string }]
    expect(JSON.parse(options.body).model).toBe('google/gemini-3.1-flash-lite')
  })

  it('réessaie sans contrainte de format quand le modèle ne la comprend pas', async () => {
    // Tous les modèles du routeur ne savent pas contraindre leur sortie. Ce
    // n'est pas une raison de les refuser : l'invite exige déjà du JSON nu.
    const appels = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 400, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce(repondOpenrouter(JSON.stringify(REGISTRE)))
    vi.stubGlobal('fetch', appels)
    const r = await appeler({ method: 'POST', body: { demande: 'suivre mes livraisons' } })

    expect(r.statut).toBe(200)
    expect(JSON.parse((appels.mock.calls[0] as [string, { body: string }])[1].body).response_format)
      .toBeDefined()
    expect(JSON.parse((appels.mock.calls[1] as [string, { body: string }])[1].body).response_format)
      .toBeUndefined()
  })

  it('journalise le coût annoncé par le routeur plutôt que son estimation', async () => {
    // Un routeur applique sa marge : son chiffre est le vrai.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(repondOpenrouter(JSON.stringify(REGISTRE), 0.002)))
    const r = await appeler({ method: 'POST', body: { demande: 'suivre mes livraisons' } })
    expect(r.corps.fcfa).toBe(1.2)
  })

  it('sait encore parler à Gemini en direct', async () => {
    process.env.A237_FOURNISSEUR = 'gemini'
    const appels = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          candidates: [{ content: { parts: [{ text: JSON.stringify(REGISTRE) }] } }],
          usageMetadata: { promptTokenCount: 1500, candidatesTokenCount: 500 },
        }),
    })
    vi.stubGlobal('fetch', appels)
    const r = await appeler({ method: 'POST', body: { demande: 'suivre mes livraisons' } })

    expect(r.statut).toBe(200)
    expect((appels.mock.calls[0] as [string])[0]).toContain('generativelanguage.googleapis.com')
  })
})

describe('le crédit épuisé se dit proprement', () => {
  beforeEach(() => {
    process.env.A237_CLEF_IA = 'une-clef'
    process.env.A237_IA_OUVERTE = '1'
  })

  it('traduit le 402 du routeur en 402, pas en panne', async () => {
    // Le brief en fait un critère d'arrêt : « le chemin plus de crédits est
    // propre » (§ 8). Un 502 enverrait chercher une panne inexistante.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 402, json: () => Promise.resolve({ error: { message: 'insufficient credits' } }),
    }))
    const r = await appeler({ method: 'POST', body: { demande: 'un registre' } })
    expect(r.statut).toBe(402)
    expect(String(r.corps.erreur)).toContain('crédit')
  })

  it('garde 502 pour une vraie panne', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 500, json: () => Promise.resolve({}),
    }))
    expect((await appeler({ method: 'POST', body: { demande: 'un registre' } })).statut).toBe(502)
  })

  it('ne laisse pas fuiter la clef dans le message de crédit épuisé', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 402,
      json: () => Promise.resolve({ error: { message: 'key une-clef has no credit' } }),
    }))
    const r = await appeler({ method: 'POST', body: { demande: 'un registre' } })
    expect(JSON.stringify(r.corps)).not.toContain('une-clef')
  })
})

describe('l’étage 3 est fermé tant qu’il n’y a pas d’abonnement', () => {
  beforeEach(() => {
    process.env.A237_CLEF_IA = 'une-clef'
    process.env.A237_IA_OUVERTE = '1'
  })

  it('refuse une demande qui vaut plusieurs outils, sans appeler le modèle', async () => {
    // Le point du modèle hybride : reconnaître la grosse demande **avant** de
    // la faire. Annoncer le prix après l'appel serait annoncer une facture.
    const appels = vi.fn()
    vi.stubGlobal('fetch', appels)
    const r = await appeler({
      method: 'POST',
      body: { demande: 'il me faut tout ce qu il faut pour ma boutique' },
    })
    expect(r.statut).toBe(402)
    expect(r.corps.erreur).toBe('abonnement-requis')
    expect(appels).not.toHaveBeenCalled()
  })

  it('laisse passer une demande d’un seul outil', async () => {
    const appels = vi.fn().mockResolvedValue(repondOpenrouter(JSON.stringify({
      titre: 'Suivi', kicker: 'SUIVI', titreNom: 'Nom',
      colonnes: [{ clef: 'client', titre: 'Client', type: 'texte' }],
      libelleVide: 'Rien pour l’instant.', libelleAjout: 'Ajouter',
      relancesVides: 'Un suivi se consulte.',
    })))
    vi.stubGlobal('fetch', appels)
    const r = await appeler({ method: 'POST', body: { demande: 'suivre mes livraisons de gaz' } })
    expect(r.statut).toBe(200)
    expect(appels).toHaveBeenCalled()
  })
})
