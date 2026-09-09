// @vitest-environment happy-dom
import type { EtatCallbox, RenderContext, ShareSpec } from '@a237/engine'
import { callbox } from '@a237/engine'
import { render as monter } from 'preact'
import { act } from 'preact/test-utils'
import { render as enChaine } from 'preact-render-to-string'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RegistreCallbox } from '../src/registre/callbox.js'

const CTX: RenderContext = {
  lien: 'atl.cm/c/ZBV3',
  maintenant: new Date('2026-09-09T07:45:00.000Z'),
}

const CABINE: EtatCallbox = {
  ...callbox.defaults,
  operations: [
    { montant: 3_000, commission: 100, heure: '08h10', jour: '2026-09-08' },
    { montant: 40_000, commission: 500, heure: '09h30', jour: '2026-09-09' },
    { montant: 12_000, commission: 200, heure: '11h05', jour: '2026-09-09' },
  ],
}

function html(etat: EtatCallbox, onglet?: 'Caisse' | 'Registre' | 'Semaine'): string {
  return enChaine(
    <RegistreCallbox
      glyphe="▧"
      etat={etat}
      ctx={CTX}
      onChange={() => undefined}
      onDiffuser={() => undefined}
      {...(onglet !== undefined ? { ongletInitial: onglet } : {})}
    />,
  )
}

describe('la caisse', () => {
  const sortie = html(CABINE)

  it('met le calcul devant, avec le montant de départ', () => {
    expect(sortie).toContain('Montant remis')
    expect(sortie).toContain('Tu gardes')
    expect(sortie).toContain('Le client reçoit')
  })

  it('montre la grille, modifiable, sous le calcul', () => {
    expect(sortie).toContain('Grille de commission')
    expect(sortie).toContain('jusqu’à 5')
    expect(sortie).toContain('au-delà')
    expect(sortie).toContain('callbox-tarif')
    // Le champ porte un nombre nu : la rangée disait « jusqu’à 100 000 F » à
    // gauche et « 1000 » à droite.
    expect(sortie).toContain('<span class="unite" aria-hidden="true">F</span>')
  })

  it('donne à chaque tarif une étiquette que seul un lecteur d’écran lit', () => {
    // Quatre champs qui se suivent ne disent rien à qui ne voit pas la rangée.
    expect(sortie).toContain('Commission jusqu’à 5')
    expect(sortie).toContain('Commission au-delà')
    expect(sortie).toContain('visuellement-cache')
  })

  it('ne compte que la journée dans l’entête', () => {
    // L'opération de la veille est dans le registre, pas dans le gain du jour.
    expect(sortie).toContain('Gagné')
    expect(sortie).toContain('700')
    expect(sortie).toContain('2 opérations aujourd’hui')
  })
})

describe('le registre', () => {
  it('liste la journée, la plus récente en tête', () => {
    const sortie = html(CABINE, 'Registre')
    expect(sortie.indexOf('11h05')).toBeLessThan(sortie.indexOf('09h30'))
    // La veille n'est pas dans le registre du jour.
    expect(sortie).not.toContain('08h10')
  })

  it('dit qu’il n’y a rien plutôt que d’afficher un tableau vide', () => {
    expect(html(callbox.defaults, 'Registre')).toContain('Aucune opération aujourd’hui')
  })
})

describe('la semaine', () => {
  it('trace la commission par jour', () => {
    const sortie = html(CABINE, 'Semaine')
    expect(sortie).toContain('Commission par jour')
    expect(sortie).toContain('08/09')
    expect(sortie).toContain('09/09')
  })

  it('ne trace rien quand rien n’est enregistré', () => {
    expect(html(callbox.defaults, 'Semaine')).toContain('Rien d’enregistré')
  })
})

describe('les gestes du call-box', () => {
  let hote: HTMLDivElement

  beforeEach(() => {
    hote = document.createElement('div')
    document.body.appendChild(hote)
  })

  afterEach(() => {
    monter(null, hote)
    hote.remove()
  })

  function poser(etat: EtatCallbox): {
    change: ReturnType<typeof vi.fn>
    diffuse: ReturnType<typeof vi.fn>
  } {
    const change = vi.fn()
    const diffuse = vi.fn()
    act(() => {
      monter(
        <RegistreCallbox
          glyphe="▧"
          etat={etat}
          ctx={CTX}
          onChange={change}
          onDiffuser={diffuse}
        />,
        hote,
      )
    })
    return { change, diffuse }
  }

  it('recalcule la commission à chaque frappe', () => {
    poser(callbox.defaults)
    const champ = hote.querySelector<HTMLInputElement>('#callbox-montant')!
    expect(hote.querySelector('.calc-valeur')?.textContent).toContain('200')
    champ.value = '150000'
    act(() => {
      champ.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(hote.querySelector('.calc-valeur')?.textContent).toContain('1')
    expect(hote.textContent).toContain('Le client reçoit')
  })

  it('ne calcule rien sur une saisie qui n’est pas un montant', () => {
    poser(callbox.defaults)
    const champ = hote.querySelector<HTMLInputElement>('#callbox-montant')!
    champ.value = 'abc'
    act(() => {
      champ.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(hote.querySelector('.calc-valeur')?.textContent).toBe('—')
    expect(hote.textContent).toContain('Entre un montant')
  })

  it('enregistre l’opération avec l’heure du contexte', () => {
    const { change } = poser(callbox.defaults)
    act(() =>
      [...hote.querySelectorAll<HTMLButtonElement>('.outil-action')]
        .find((b) => b.textContent === 'Enregistrer')
        ?.click(),
    )
    const suivant = change.mock.calls[0]?.[0] as EtatCallbox
    expect(suivant.operations).toEqual([
      { montant: 10_000, commission: 200, heure: '08h45', jour: '2026-09-09' },
    ])
  })

  it('corrige un tarif dans la rangée', () => {
    const { change } = poser(callbox.defaults)
    const tarif = hote.querySelectorAll<HTMLInputElement>('.callbox-tarif input')[1]!
    tarif.value = '250'
    act(() => {
      tarif.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const suivant = change.mock.calls[0]?.[0] as EtatCallbox
    expect(suivant.tranches[1]?.commission).toBe(250)
    // Le passé ne bouge pas.
    expect(suivant.operations).toEqual([])
  })

  it('diffuse une carte qui dit qu’elle n’est pas pour un groupe', () => {
    const { diffuse } = poser(CABINE)
    act(() =>
      [...hote.querySelectorAll<HTMLButtonElement>('.outil-action')]
        .find((b) => b.textContent === 'Diffuser')
        ?.click(),
    )
    const partage = diffuse.mock.calls[0]?.[0] as ShareSpec
    expect(partage.warn).toContain('pas pour un groupe')
    expect(partage.relances).toEqual([])
  })
})
