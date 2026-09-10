// @vitest-environment happy-dom
import 'fake-indexeddb/auto'
import { clear, createStore } from 'idb-keyval'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { oublierEnMemoire } from '../src/appareil.js'
import {
  dernierEtatConnu, lireCompte, noterApresComposition, retenirEtat,
} from '../src/compte.js'

const vraiFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = vraiFetch
})
/*
 * Une ardoise vierge à chaque cas.
 *
 * IndexedDB survit d'un cas à l'autre dans le même fichier, et un état laissé
 * par le précédent ferait passer ou échouer celui-ci selon l'ordre — la pire
 * sorte d'essai, celui qui ne dit pas la vérité au moment où on en a besoin.
 */
const COMPTE = createStore('atelier237-compte', 'compte')

beforeEach(async () => {
  oublierEnMemoire()
  await clear(COMPTE)
})

function serveur(statut: number, corps: unknown): ReturnType<typeof vi.fn> {
  const appel = vi.fn().mockResolvedValue({
    ok: statut >= 200 && statut < 300,
    status: statut,
    json: () => Promise.resolve(corps),
  })
  globalThis.fetch = appel as unknown as typeof fetch
  return appel
}

describe('lire le compte', () => {
  it('présente l’appareil à chaque requête', async () => {
    const appel = serveur(200, { plan: 'essai', credits: 5, expire: null, aUnCode: false })
    await lireCompte()
    const [, options] = appel.mock.calls[0] as [string, RequestInit]
    expect((options.headers as Record<string, string>).authorization).toMatch(/^Appareil [0-9a-f]{32}$/)
  })

  it('hors ligne, ce n’est pas une panne du compte', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('hors ligne')) as unknown as typeof fetch
    expect((await lireCompte()).sorte).toBe('differe')
  })

  it('et un serveur non branché non plus : ça se réessaie', async () => {
    serveur(503, { erreur: 'les comptes ne sont pas branchés' })
    expect((await lireCompte()).sorte).toBe('differe')
  })

  it('un refus porte sa raison, pour qu’on la montre telle quelle', async () => {
    serveur(402, { erreur: 'credits-epuises', pourquoi: 'Tes compositions sont utilisées.' })
    const issue = await lireCompte()
    expect(issue.sorte).toBe('refuse')
    if (issue.sorte !== 'refuse') throw new Error('impossible')
    expect(issue.pourquoi).toBe('Tes compositions sont utilisées.')
  })

  it('et rend le nom de l’erreur quand le serveur n’explique pas', async () => {
    // Mieux vaut « code-inconnu » que le vide : l'écran a alors quelque chose
    // à montrer, et nous quelque chose à chercher.
    serveur(404, { erreur: 'code-inconnu' })
    const issue = await lireCompte()
    if (issue.sorte !== 'refuse') throw new Error('impossible')
    expect(issue.pourquoi).toBe('code-inconnu')
  })

  it('et « refus » quand il n’explique rien du tout', async () => {
    serveur(500, {})
    const issue = await lireCompte()
    if (issue.sorte !== 'refuse') throw new Error('impossible')
    expect(issue.pourquoi).toBe('refus')
  })
})

describe('ce que l’appareil retient', () => {
  it('garde le dernier état connu, pour l’afficher en mode avion', async () => {
    await retenirEtat({ plan: 'atelier', credits: 40, expire: 123, aUnCode: true })
    expect(await dernierEtatConnu()).toEqual({ plan: 'atelier', credits: 40, expire: 123, aUnCode: true })
  })

  it('met à jour le solde que la composition rapporte, sans oublier le reste', async () => {
    // Le proxy renvoie le solde avec la composition : le compte se tient à
    // jour sans qu'on l'interroge, et sans coûter un aller-retour de plus.
    await retenirEtat({ plan: 'atelier', credits: 40, expire: 999, aUnCode: true })
    await noterApresComposition('atelier', 39)
    expect(await dernierEtatConnu()).toEqual({ plan: 'atelier', credits: 39, expire: 999, aUnCode: true })
  })

  it('note un solde même quand rien n’était encore su', async () => {
    // Premier lancement, première composition : il n'y a pas d'état précédent
    // à compléter, et il ne faut pas pour autant perdre le solde.
    await noterApresComposition('essai', 4)
    expect(await dernierEtatConnu()).toEqual({ plan: 'essai', credits: 4, expire: null, aUnCode: false })
  })

  it('et ignore ce qui n’est pas un solde', async () => {
    await retenirEtat({ plan: 'essai', credits: 5, expire: null, aUnCode: false })
    await noterApresComposition(undefined, undefined)
    await noterApresComposition('inconnu', 3)
    await noterApresComposition('essai', 'trois')
    expect((await dernierEtatConnu())?.credits).toBe(5)
  })
})
