// @vitest-environment happy-dom
import type { ShareSpec } from '@a237/engine'
import { render as monter } from 'preact'
import { act } from 'preact/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Diffusion } from '../src/diffusion.js'

const PARTAGE: ShareSpec = {
  title: 'Njangi Nkolbisson',
  desc: 'Semaine 36 · 2 sur 4 ont versé',
  name: 'njangi-s36',
  txt: 'NJANGI NKOLBISSON — semaine 36\nCollecté : 10 000 F sur 20 000 F\natl.cm/n/ZBV3?t=36',
  broad: null,
  warn: null,
  card: {
    kicker: 'CARNET DE NJANGI', title: 'Njangi Nkolbisson', sub: '4 membres', tag: 'S36',
    bigLabel: 'COLLECTÉ', big: '10 000 F', pct: 0.5, subline: '2 sur 4', listTitle: 'VERSEMENTS',
    items: [], link: 'atl.cm/n/ZBV3?t=36', stamp: 'Arrêté le 9 septembre 2026 à 08h45',
  },
  relances: [
    { nom: 'Adèle', tel: '699445566', message: 'Bonjour Adèle, ta part de 5 000 F ?' },
    { nom: 'Serge', tel: null, message: 'Bonjour Serge, ta part de 5 000 F ?' },
  ],
  relancesVides: 'Personne à relancer — tout le monde est à jour.',
}

let hote: HTMLDivElement

async function reposer(tours = 4): Promise<void> {
  for (let i = 0; i < tours; i += 1) await new Promise((r) => setTimeout(r, 0))
  act(() => undefined)
}

beforeEach(() => {
  hote = document.createElement('div')
  document.body.appendChild(hote)
})

afterEach(() => {
  monter(null, hote)
  hote.remove()
  vi.restoreAllMocks()
})

async function poser(partage: ShareSpec = PARTAGE, onFermer = vi.fn()): Promise<typeof onFermer> {
  act(() => monter(<Diffusion partage={partage} onFermer={onFermer} />, hote))
  await reposer()
  return onFermer
}

describe('la feuille de diffusion', () => {
  it('montre le résumé prêt à coller', async () => {
    await poser()
    expect(hote.querySelector('.resume')?.textContent).toContain('NJANGI NKOLBISSON')
    expect(hote.querySelector('.resume')?.textContent).toContain('atl.cm/n/ZBV3?t=36')
  })

  it('décrit la carte pour ceux qui ne la voient pas', async () => {
    await poser()
    expect(hote.querySelector('canvas')?.getAttribute('aria-label')).toBe(PARTAGE.desc)
  })

  it('n’affiche pas d’avertissement quand il n’y en a pas', async () => {
    await poser()
    expect(hote.querySelector('.alerte')).toBeNull()
  })

  it('affiche l’avertissement de l’ardoise quand il y en a un', async () => {
    await poser({ ...PARTAGE, warn: 'Cette carte est pour toi, pas pour un groupe.' })
    expect(hote.querySelector('.alerte')?.textContent).toContain('pas pour un groupe')
  })

  it('se ferme', async () => {
    const onFermer = await poser()
    hote.querySelector<HTMLButtonElement>('.feuille-fermer')?.click()
    expect(onFermer).toHaveBeenCalledOnce()
  })
})

describe('les relances partent du pouce du propriétaire', () => {
  it('ouvre WhatsApp avec le message déjà écrit', async () => {
    await poser()
    const lien = hote.querySelector<HTMLAnchorElement>('a.outil-bascule')
    expect(lien?.href).toContain('https://wa.me/237699445566?text=')
    expect(lien?.href).toContain('Ad%C3%A8le')
    expect(lien?.textContent).toBe('Relancer')
  })

  it('propose de copier quand on n’a pas le numéro', async () => {
    await poser()
    const boutons = [...hote.querySelectorAll('button')].filter((b) => b.textContent === 'Copier')
    expect(boutons).toHaveLength(1)
    expect(hote.textContent).toContain('numéro inconnu')
  })

  it('n’envoie rien tout seul : il n’y a que des liens et des boutons', async () => {
    await poser()
    for (const a of hote.querySelectorAll('a')) {
      expect(a.getAttribute('href')?.startsWith('https://wa.me/')).toBe(true)
      expect(a.getAttribute('rel')).toBe('noreferrer')
    }
  })

  it('le dit quand il n’y a personne à relancer', async () => {
    await poser({ ...PARTAGE, relances: [] })
    expect(hote.textContent).toContain('tout le monde est à jour')
  })

  it('copie le message quand le presse-papiers répond', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await poser()
    const copier = [...hote.querySelectorAll('button')].find((b) => b.textContent === 'Copier')
    copier?.click()
    await reposer()
    expect(writeText).toHaveBeenCalledWith(PARTAGE.relances[1]?.message)
    expect(hote.textContent).toContain('Message pour Serge copié.')
  })

  it('le dit plutôt que de faire semblant quand la copie échoue', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('refusé')) },
      configurable: true,
    })
    await poser()
    const copier = [...hote.querySelectorAll('button')].find((b) => b.textContent === 'Copier le texte')
    copier?.click()
    await reposer()
    expect(hote.textContent).toContain('Copie impossible')
  })
})

describe('la carte', () => {
  it('le dit quand l’appareil ne sait pas la dessiner, au lieu de rester blanche', async () => {
    // happy-dom ne fournit pas de contexte 2D : c'est le cas d'un navigateur
    // qui refuse le canvas, et il doit se voir.
    await poser()
    expect(hote.textContent).toContain('n’a pas pu être dessinée')
  })

  it('est dessinée et pesée quand le contexte existe', async () => {
    const appels: string[] = []
    const contexte = new Proxy(
      {
        measureText: () => ({ width: 10 }),
      } as Record<string, unknown>,
      {
        get(cible, clef: string) {
          if (clef in cible) return cible[clef]
          return (...args: unknown[]) => {
            appels.push(`${clef}(${args.length})`)
          }
        },
        set: () => true,
      },
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      contexte as unknown as CanvasRenderingContext2D,
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((rappel) => {
      rappel(new Blob(['x'.repeat(2048)], { type: 'image/png' }))
    })

    await poser()
    expect(hote.textContent).not.toContain('n’a pas pu être dessinée')
    expect(appels.length).toBeGreaterThan(10)
    expect(hote.textContent).toContain('PNG de 2 Ko')
  })
})
