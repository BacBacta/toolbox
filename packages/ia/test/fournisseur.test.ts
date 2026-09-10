import { afterEach, describe, expect, it, vi } from 'vitest'
import { reglagesDe } from '../src/fonction.js'
import { ErreurFournisseur, gemini, openrouter } from '../src/fournisseur.js'

/**
 * Le fournisseur, éprouvé sans réseau.
 *
 * Ce qui compte ici n'est pas qu'on sache appeler une API — c'est ce qui arrive
 * quand elle répond mal. Un flux se coupe au milieu d'un mot, et parfois au
 * milieu d'un caractère accentué : c'est le cas courant sur une connexion
 * mobile, pas l'exception. Un lecteur qui suppose des morceaux bien découpés
 * affiche des losanges là où le modèle a écrit du français.
 */

afterEach(() => vi.unstubAllGlobals())

/** Un corps de flux, coupé en morceaux d'octets — jamais sur des frontières. */
function fluxOctets(texte: string, taille: number): ReadableStream<Uint8Array> {
  const octets = new TextEncoder().encode(texte)
  let i = 0
  return new ReadableStream({
    pull(file) {
      if (i >= octets.length) {
        file.close()
        return
      }
      file.enqueue(octets.slice(i, i + taille))
      i += taille
    },
  })
}

function repondEnFlux(texte: string, taille = 5, statut = 200): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: statut >= 200 && statut < 300,
    status: statut,
    body: statut >= 400 ? null : fluxOctets(texte, taille),
  }))
}

/** Les événements que le routeur envoie vraiment, dans sa forme à lui. */
function sse(morceaux: readonly string[], usage?: unknown): string {
  const lignes = morceaux.map(
    (m) => `data: ${JSON.stringify({ choices: [{ delta: { content: m } }] })}\n\n`,
  )
  if (usage !== undefined) lignes.push(`data: ${JSON.stringify({ choices: [], usage })}\n\n`)
  lignes.push('data: [DONE]\n\n')
  return lignes.join('')
}

async function tout(f: ReturnType<typeof openrouter>): Promise<{ morceaux: string[]; fin: unknown }> {
  const flux = f.diffuser?.({ invite: 'x' })
  if (flux === undefined) throw new Error('pas de flux')
  const morceaux: string[] = []
  let suivant = await flux.next()
  while (suivant.done !== true) {
    morceaux.push(suivant.value.texte)
    suivant = await flux.next()
  }
  return { morceaux, fin: suivant.value }
}

describe('le flux du routeur', () => {
  it('rend les morceaux dans l’ordre, et le texte entier à la fin', async () => {
    repondEnFlux(sse(['Je te ', 'fais un ', 'suivi.'], { prompt_tokens: 1_500, completion_tokens: 40 }))
    const { morceaux, fin } = await tout(openrouter('clef'))
    expect(morceaux).toEqual(['Je te ', 'fais un ', 'suivi.'])
    expect(fin).toMatchObject({ texte: 'Je te fais un suivi.', jetonsEntree: 1_500, jetonsSortie: 40 })
  })

  it('recolle un caractère accentué coupé en deux octets', async () => {
    /*
     * Le cas qui produit des losanges. « é » fait deux octets en UTF-8, et un
     * morceau de réseau n'a aucune raison de s'arrêter entre les deux.
     */
    repondEnFlux(sse(['Déjà payé, très bien — ça marche.']), 3)
    const { fin } = await tout(openrouter('clef'))
    expect((fin as { texte: string }).texte).toBe('Déjà payé, très bien — ça marche.')
  })

  it('tient quand un événement est coupé en plein milieu', async () => {
    // Le tampon garde ce qui dépasse : sans lui, une ligne sur deux est perdue.
    repondEnFlux(sse(['un', 'deux', 'trois', 'quatre']), 1)
    const { fin } = await tout(openrouter('clef'))
    expect((fin as { texte: string }).texte).toBe('undeuxtroisquatre')
  })

  it('ignore ce qui n’est pas un événement, plutôt que de tomber', async () => {
    // Les commentaires de maintien en vie, et les lignes abîmées.
    repondEnFlux(`: ping\n\ndata: pas du json\n\n${sse(['bonjour'])}`)
    const { fin } = await tout(openrouter('clef'))
    expect((fin as { texte: string }).texte).toBe('bonjour')
  })

  it('prend le coût du routeur quand il le donne : il applique sa marge', async () => {
    repondEnFlux(sse(['x'], { prompt_tokens: 10, completion_tokens: 2, cost: 0.000_42 }))
    const { fin } = await tout(openrouter('clef'))
    expect(fin).toMatchObject({ dollars: 0.000_42 })
  })

  it('nomme le crédit épuisé, qui n’est pas une panne', async () => {
    // Envoyer quelqu'un chercher un problème qui n'existe pas pendant que la
    // vraie cause tient en une phrase.
    repondEnFlux('', 5, 402)
    await expect(tout(openrouter('clef'))).rejects.toMatchObject({ sorte: 'credit-epuise' })
  })

  it('ne laisse pas fuir le corps d’une erreur : il peut porter la clef en écho', async () => {
    repondEnFlux('', 5, 500)
    await expect(tout(openrouter('clef-secrete'))).rejects.toThrow(ErreurFournisseur)
    await expect(tout(openrouter('clef-secrete'))).rejects.not.toThrow(/clef-secrete/)
  })
})

describe('l’appel d’un seul tenant, pour un fournisseur qui ne diffuse pas', () => {
  function repondJson(corps: unknown, statut = 200): ReturnType<typeof vi.fn> {
    const appel = vi.fn().mockResolvedValue({
      ok: statut >= 200 && statut < 300,
      status: statut,
      json: () => Promise.resolve(corps),
    })
    vi.stubGlobal('fetch', appel)
    return appel
  }

  const REPONSE = {
    choices: [{ message: { content: '{"mot":"Voilà."}' } }],
    usage: { prompt_tokens: 1_200, completion_tokens: 30 },
  }

  it('rend le texte et le compte des jetons', async () => {
    repondJson(REPONSE)
    const r = await openrouter('clef').appeler({ invite: 'x' })
    expect(r).toMatchObject({ texte: '{"mot":"Voilà."}', jetonsEntree: 1_200, jetonsSortie: 30 })
  })

  it('recommence sans contrainte de format quand le modèle ne la comprend pas', async () => {
    /*
     * `response_format` réduit les reprises, et une reprise double le coût —
     * on le demande donc. Mais tous les modèles du routeur ne le comprennent
     * pas, et le refuser reviendrait à choisir le modèle à leur place : le
     * brief pose un budget, pas une marque.
     */
    const appel = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 400, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(REPONSE) })
    vi.stubGlobal('fetch', appel)

    const r = await openrouter('clef').appeler({ invite: 'x' })
    expect(r.texte).toBe('{"mot":"Voilà."}')
    expect(appel).toHaveBeenCalledTimes(2)
    const premier = JSON.parse((appel.mock.calls[0]?.[1] as { body: string }).body) as object
    const second = JSON.parse((appel.mock.calls[1]?.[1] as { body: string }).body) as object
    expect(premier).toHaveProperty('response_format')
    expect(second).not.toHaveProperty('response_format')
  })

  it('ne recommence pas sur un refus d’authentification', async () => {
    // Une clef refusée le restera : réessayer ne fait que doubler l'attente.
    const appel = repondJson({}, 401)
    await expect(openrouter('clef').appeler({ invite: 'x' })).rejects.toMatchObject({
      sorte: 'refuse',
    })
    expect(appel).toHaveBeenCalledTimes(1)
  })

  it('nomme le crédit épuisé du routeur', async () => {
    repondJson({}, 402)
    await expect(openrouter('clef').appeler({ invite: 'x' })).rejects.toMatchObject({
      sorte: 'credit-epuise',
    })
  })

  it('porte la reprise dans les messages, avec ce que le modèle avait dit', async () => {
    const appel = repondJson(REPONSE)
    await openrouter('clef').appeler({
      invite: 'consignes',
      reprise: { sortie: '{"faux":1}', reproches: 'corrige ceci' },
    })
    const corps = JSON.parse((appel.mock.calls[0]?.[1] as { body: string }).body) as {
      messages: { role: string; content: string }[]
    }
    expect(corps.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user'])
    expect(corps.messages[1]?.content).toBe('{"faux":1}')
  })

  it('prend le coût du routeur quand il le donne', async () => {
    repondJson({ ...REPONSE, usage: { ...REPONSE.usage, cost: 0.001 } })
    expect(await openrouter('clef').appeler({ invite: 'x' })).toMatchObject({ dollars: 0.001 })
  })
})

describe('Gemini, appelé directement', () => {
  it('rend le texte et les jetons, dans sa forme à lui', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        candidates: [{ content: { parts: [{ text: '{"mot":"Voilà."}' }] } }],
        usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 20 },
      }),
    }))
    const r = await gemini('clef').appeler({ invite: 'x' })
    expect(r).toMatchObject({ texte: '{"mot":"Voilà."}', jetonsEntree: 900, jetonsSortie: 20 })
  })

  it('nomme ses pannes sans propager son corps', async () => {
    for (const [statut, sorte] of [[429, 'credit-epuise'], [403, 'refuse'], [500, 'panne']] as const) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: statut }))
      await expect(gemini('clef-secrete').appeler({ invite: 'x' })).rejects.toMatchObject({ sorte })
    }
  })

  it('survit à une réponse vide plutôt que de jeter', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve({}),
    }))
    expect(await gemini('clef').appeler({ invite: 'x' })).toMatchObject({ texte: '' })
  })
})

describe('le flux contraint son format, comme l’appel d’un seul tenant', () => {
  it('demande du JSON, et recommence sans la contrainte si le modèle la refuse', async () => {
    /*
     * `response_format` était posé sur l'appel d'un seul tenant et oublié sur
     * le flux. Mesuré sur de vrais deuxièmes tours : deux fois sur trois, le
     * modèle répondait en prose — « Voilà, j'ai retiré la date » — sans une
     * accolade, et en affirmant une modification qui n'était nulle part.
     */
    const corps = () => new ReadableStream({
      start(f) {
        f.enqueue(new TextEncoder().encode(sse(['{}'])))
        f.close()
      },
    })
    const appel = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 400, body: null })
      .mockResolvedValueOnce({ ok: true, status: 200, body: corps() })
    vi.stubGlobal('fetch', appel)

    await tout(openrouter('clef'))
    expect(appel).toHaveBeenCalledTimes(2)
    const premier = JSON.parse((appel.mock.calls[0]?.[1] as { body: string }).body) as object
    const second = JSON.parse((appel.mock.calls[1]?.[1] as { body: string }).body) as object
    expect(premier).toHaveProperty('response_format')
    expect(second).not.toHaveProperty('response_format')
  })

  it('ne recommence pas sur une clef refusée', async () => {
    const appel = vi.fn().mockResolvedValue({ ok: false, status: 401, body: null })
    vi.stubGlobal('fetch', appel)
    await expect(tout(openrouter('clef'))).rejects.toMatchObject({ sorte: 'refuse' })
    expect(appel).toHaveBeenCalledTimes(1)
  })
})

describe('la conversation, mise en messages', () => {
  it('met l’invite d’abord, seule, pour qu’un cache serve à quelque chose', async () => {
    // Un fournisseur qui sait mettre en cache son préfixe ne paie qu'une fois
    // ce qui ne change pas, et c'est ce qui rend une conversation abordable.
    const appel = vi.fn().mockResolvedValue({ ok: true, status: 200, body: fluxOctets(sse(['x']), 50) })
    vi.stubGlobal('fetch', appel)
    const f = openrouter('clef')
    await tout(f)
    const corps = JSON.parse((appel.mock.calls[0]?.[1] as { body: string }).body) as {
      messages: { role: string }[]
      stream: boolean
    }
    expect(corps.messages[0]?.role).toBe('user')
    expect(corps.stream).toBe(true)
  })
})

describe('les réglages, lus dans l’environnement du Worker', () => {
  it('restent fermés tant que personne n’a voulu ouvrir', () => {
    // Poser la clef ne suffit pas : servir sans l'avoir voulu ouvre un robinet
    // qui coûte de l'argent à chaque appel.
    expect(reglagesDe({ A237_CLEF_IA: 'k' }).ouverte).toBe(false)
    expect(reglagesDe({ A237_CLEF_IA: 'k', A237_IA_OUVERTE: '1' }).ouverte).toBe(true)
  })

  it('retombent sur des valeurs tenables quand rien n’est posé', () => {
    const r = reglagesDe({})
    expect(r.clef).toBe('')
    expect(r.tauxFcfa).toBeGreaterThan(0)
    expect(r.prixEntree).toBeGreaterThan(0)
  })

  it('ignorent un nombre qui n’en est pas un', () => {
    // Une variable mal saisie ferait journaliser des coûts en NaN, c'est-à-dire
    // ne rien journaliser du tout.
    expect(reglagesDe({ A237_TAUX_FCFA: 'six cents' }).tauxFcfa).toBe(600)
  })

  it('laissent choisir le modèle sans redéployer', () => {
    // Le brief pose un budget, pas une marque : pouvoir en essayer un autre le
    // lendemain vaut mieux que d'avoir bien deviné le premier jour.
    expect(reglagesDe({ A237_MODELE: 'x/y' }).modele).toBe('x/y')
  })
})

describe('Gemini, l’autre chemin', () => {
  it('met la conversation dans ses tours, avec ses noms de rôles à lui', async () => {
    const appel = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        candidates: [{ content: { parts: [{ text: '{}' }] } }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 2 },
      }),
    })
    vi.stubGlobal('fetch', appel)
    await gemini('clef').appeler({
      invite: 'consignes',
      conversation: [
        { qui: 'personne', texte: 'un suivi' },
        { qui: 'agent', texte: 'Voilà.' },
      ],
    })
    const corps = JSON.parse((appel.mock.calls[0]?.[1] as { body: string }).body) as {
      contents: { role: string }[]
    }
    expect(corps.contents.map((c) => c.role)).toEqual(['user', 'user', 'model'])
  })
})
