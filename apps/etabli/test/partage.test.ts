import { afterEach, describe, expect, it, vi } from 'vitest'
import { adressePartagee, deposer, lienDemande, recuperer } from '../src/partage.js'
import type { Projet } from '@a237/etabli'

const PROJET: Projet = {
  id: 'p1', nom: 'Ma page', maj: 0,
  fichiers: [{ nom: 'index.html', contenu: '<h1>Salut</h1>' }],
}

const vrai = globalThis.fetch
afterEach(() => { globalThis.fetch = vrai })

function repond(statut: number, corps: unknown): void {
  globalThis.fetch = vi.fn(async () =>
    new Response(JSON.stringify(corps), { status: statut })) as unknown as typeof fetch
}

describe('déposer', () => {
  it('rend le projet muni de son lien et de sa clef', async () => {
    repond(200, { lien: 'ABCDEFGHJK' })
    const r = await deposer(PROJET)
    expect(r.sorte).toBe('depose')
    if (r.sorte !== 'depose') return
    expect(r.projet.lien).toHaveLength(10)
    expect(r.projet.clef).toHaveLength(32)
  })

  /*
   * Le lien et la clef se tirent sur l'appareil : un premier dépôt tient en un
   * aller simple, sans rien demander à personne.
   */
  it('en un seul aller', async () => {
    const appels = vi.fn(async () => new Response('{}', { status: 200 }))
    globalThis.fetch = appels as unknown as typeof fetch
    await deposer(PROJET)
    expect(appels).toHaveBeenCalledTimes(1)
  })

  it('garde le même lien quand le projet en a déjà un', async () => {
    repond(200, {})
    const r = await deposer({ ...PROJET, lien: 'ABCDEFGHJK', clef: 'b'.repeat(32) })
    expect(r.sorte === 'depose' && r.projet.lien).toBe('ABCDEFGHJK')
  })

  /*
   * Hors ligne, c'est le cas courant ici, et ce n'est pas une panne : le projet
   * reste sur le téléphone, entier.
   */
  it('dit qu’il n’y a pas de réseau, plutôt que d’échouer', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('offline') }) as unknown as typeof fetch
    expect((await deposer(PROJET)).sorte).toBe('pas-de-reseau')
  })

  it('et traduit le refus du serveur en français', async () => {
    repond(400, { erreur: 'projet-invalide' })
    const r = await deposer(PROJET)
    expect(r.sorte).toBe('refuse')
    expect(r.sorte === 'refuse' && r.pourquoi).toMatch(/renomme/i)
  })
})

describe('ouvrir un lien reçu', () => {
  it('rend le projet quand il est lisible', async () => {
    repond(200, { nom: 'Reçu', fichiers: [{ nom: 'index.html', contenu: '<p>x</p>' }] })
    const r = await recuperer('ABCDEFGHJK')
    expect(r.sorte).toBe('ouvert')
    expect(r.sorte === 'ouvert' && r.nom).toBe('Reçu')
  })

  it('dit « introuvable » sur un lien qui n’existe pas', async () => {
    repond(404, { erreur: 'lien-inconnu' })
    expect((await recuperer('ABCDEFGHJK')).sorte).toBe('introuvable')
  })

  /*
   * Ce qui revient a pu être trafiqué : un dépôt qui ne tient pas le contrat
   * ne devient pas un projet, il devient un message.
   */
  it('et refuse un dépôt qui ne tient pas le contrat, sans tomber', async () => {
    repond(200, { nom: 'x', fichiers: [{ nom: '../secret.js', contenu: '' }] })
    expect((await recuperer('ABCDEFGHJK')).sorte).toBe('refuse')
  })
})

describe('l’adresse qu’on envoie', () => {
  it('ouvre l’éditeur sur le projet, et ne sert pas la page', () => {
    const a = adressePartagee('ABCDEFGHJK', 'https://etabli237.pages.dev')
    expect(a).toBe('https://etabli237.pages.dev/?p=ABCDEFGHJK')
  })

  it('et se relit à l’ouverture', () => {
    expect(lienDemande('?p=ABCDEFGHJK')).toBe('ABCDEFGHJK')
    expect(lienDemande('?autre=1')).toBe(null)
    expect(lienDemande('')).toBe(null)
  })
})

/**
 * Ce que le serveur refuse sans le dire clairement.
 *
 * Un code d'erreur qu'on ne connaît pas ne doit pas laisser la personne devant
 * un écran muet : on dit qu'on a échoué et qu'on peut réessayer, ce qui est
 * vrai dans tous les cas qu'on n'a pas prévus.
 */
describe('un refus qu’on ne connaît pas', () => {
  it('se dit quand même, en français', async () => {
    repond(500, { erreur: 'quelque-chose-de-neuf' })
    const r = await deposer(PROJET)
    expect(r.sorte).toBe('refuse')
    expect(r.sorte === 'refuse' && r.pourquoi).toMatch(/réessaie/i)
  })

  it('et même quand le serveur ne dit rien du tout', async () => {
    globalThis.fetch = (async () => new Response('pas du json', { status: 500 })) as typeof fetch
    expect((await deposer(PROJET)).sorte).toBe('refuse')
  })
})

describe('ouvrir un lien quand le réseau manque', () => {
  it('le dit, plutôt que de laisser l’écran vide', async () => {
    globalThis.fetch = (async () => { throw new Error('offline') }) as typeof fetch
    expect((await recuperer('ABCDEFGHJK')).sorte).toBe('pas-de-reseau')
  })

  it('et un serveur en panne n’est pas un lien introuvable', async () => {
    repond(500, {})
    expect((await recuperer('ABCDEFGHJK')).sorte).toBe('refuse')
  })
})
