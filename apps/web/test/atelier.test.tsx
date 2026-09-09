// @vitest-environment happy-dom
import { CATALOGUE } from '@a237/engine'
import { render as monter } from 'preact'
import { act } from 'preact/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Atelier } from '../src/atelier.js'

/**
 * L'atelier de bout en bout, y compris le chemin qui coûte de l'argent.
 *
 * `fetch` est remplacé : ce qu'on vérifie, c'est que la composition ne part
 * jamais toute seule, et que chaque façon d'échouer se dit à l'utilisateur
 * plutôt que de laisser l'écran figé.
 */

const REGISTRE = {
  titre: 'Suivi des livraisons',
  kicker: 'SUIVI DES LIVRAISONS',
  titreNom: 'Nom du dépôt',
  colonnes: [{ clef: 'client', titre: 'Client', type: 'texte' }],
  libelleVide: 'Aucune livraison pour l’instant.',
  libelleAjout: 'Ajouter une livraison',
  relancesVides: 'Un suivi se consulte, il ne se relance pas.',
}

let hote: HTMLDivElement
let creations: { skeleton: string; registre: unknown }[]

beforeEach(() => {
  hote = document.createElement('div')
  document.body.appendChild(hote)
  creations = []
  act(() => {
    monter(
      <Atelier
        fiches={CATALOGUE}
        onCreer={(skeleton, _e, registre) => creations.push({ skeleton, registre })}
      />,
      hote,
    )
  })
})

afterEach(() => {
  monter(null, hote)
  hote.remove()
  vi.unstubAllGlobals()
})

function demander(texte: string): void {
  const champ = hote.querySelector<HTMLInputElement>('#demande')
  if (champ === null) throw new Error('champ introuvable')
  act(() => {
    champ.value = texte
    champ.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function cliquer(texte: string): void {
  const b = [...hote.querySelectorAll('button')].find((x) => x.textContent?.includes(texte))
  if (b === undefined) throw new Error(`bouton introuvable : ${texte}`)
  act(() => b.click())
}

const attendre = (): Promise<void> => act(() => new Promise((r) => setTimeout(r, 0)))

function repond(statut: number, corps: unknown): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: statut >= 200 && statut < 300,
    status: statut,
    json: () => Promise.resolve(corps),
  }))
}

describe('l’étage 1 ne coûte rien', () => {
  it('n’appelle jamais le réseau pour une demande qu’il comprend', () => {
    const appels = vi.fn()
    vi.stubGlobal('fetch', appels)
    demander('njangi de 20 000 F par mois')
    cliquer('Ouvrir carnet de njangi')
    expect(appels).not.toHaveBeenCalled()
    expect(creations[0]?.skeleton).toBe('njangi')
  })

  it('propose de composer sans le faire : ça part sur un geste', () => {
    const appels = vi.fn()
    vi.stubGlobal('fetch', appels)
    demander('il me faut un contrat de bail')
    expect(hote.textContent).toContain('Compose-le pour moi')
    // Une génération par frappe brûlerait le budget sur des phrases inachevées.
    expect(appels).not.toHaveBeenCalled()
  })
})

describe('l’étage 2, quand on le demande', () => {
  it('crée le registre composé', async () => {
    repond(200, { registre: REGISTRE, fcfa: 0.21 })
    demander('je veux suivre mes livraisons de gaz')
    cliquer('Compose-le pour moi')
    await attendre()
    expect(creations[0]?.skeleton).toBe('compose')
    expect(creations[0]?.registre).toMatchObject({ titre: 'Suivi des livraisons' })
  })

  it('dit que ce n’est pas encore ouvert, sans faire croire à une panne', async () => {
    repond(503, {})
    demander('je veux suivre mes livraisons de gaz')
    cliquer('Compose-le pour moi')
    await attendre()
    expect(hote.textContent).toContain('n’est pas encore ouverte')
    expect(creations).toHaveLength(0)
  })

  it('dit ce qui a raté plutôt que de figer l’écran', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    demander('je veux suivre mes livraisons de gaz')
    cliquer('Compose-le pour moi')
    await attendre()
    expect(hote.textContent).toContain('pas de réseau')
  })
})

describe('quand la demande n’est pas un registre', () => {
  it('rapporte le refus du modèle, sans créer d’outil', async () => {
    // Le défaut d'origine : « je veux un site internet » créait un registre
    // « Ventes » inventé de bout en bout. Un outil qui ne sait pas dire non
    // finit par mentir.
    repond(200, { impossible: 'Un site internet ne se range pas dans un registre.', fcfa: 0.13 })
    demander('je veux un site internet')
    cliquer('Compose-le pour moi')
    await attendre()
    expect(hote.textContent).toContain('ne se range pas dans un registre')
    expect(creations).toHaveLength(0)
  })

  it('ne propose pas de réessayer : la réponse ne changera pas', async () => {
    repond(200, { impossible: 'Un logo se dessine, il ne se tient pas en lignes.', fcfa: 0.13 })
    demander('fais-moi un logo')
    cliquer('Compose-le pour moi')
    await attendre()
    expect(hote.textContent).not.toContain('Réessaie')
  })
})
