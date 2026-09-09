// @vitest-environment happy-dom
import type { EtatCalc, RenderContext, ShareSpec } from '@a237/engine'
import { course, ESPACE_INSECABLE, scolarite } from '@a237/engine'
import { render as monter } from 'preact'
import { act } from 'preact/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Calculatrice } from '../src/registre/calc.js'

const E = ESPACE_INSECABLE
const CTX: RenderContext = { lien: '', maintenant: new Date('2026-09-09T07:45:00Z') }

let hote: HTMLDivElement

beforeEach(() => {
  hote = document.createElement('div')
  document.body.appendChild(hote)
})

afterEach(() => {
  monter(null, hote)
  hote.remove()
})

function poser(
  squelette: typeof scolarite,
  etat: EtatCalc,
  onChange: (e: EtatCalc) => void = () => undefined,
  onDiffuser: (p: ShareSpec) => void = () => undefined,
): void {
  act(() => {
    monter(
      <Calculatrice
        config={squelette.config}
        titre={squelette.title}
        etat={etat}
        ctx={CTX}
        onChange={onChange}
        onDiffuser={onDiffuser}
        partage={squelette.share}
      />,
      hote,
    )
  })
}

function saisir(selecteur: string, valeur: string): void {
  const champ = hote.querySelector<HTMLInputElement>(selecteur)
  if (champ === null) throw new Error(`champ introuvable : ${selecteur}`)
  act(() => {
    champ.value = valeur
    champ.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('les frais scolaires à l’écran', () => {
  beforeEach(() => poser(scolarite, { nom: 'Aïcha', valeurs: { total: 75_000, verse: 30_000 } }))

  it('met le résultat en grand, et l’annonce aux lecteurs d’écran', () => {
    const resultat = hote.querySelector('.calc-resultat')
    expect(resultat?.textContent).toContain('Reste à payer')
    expect(resultat?.textContent).toContain(`45${E}000${E}F`)
    expect(hote.querySelector('[aria-live="polite"]')).not.toBeNull()
  })

  it('montre la part réglée dans une barre', () => {
    expect(hote.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('40')
    expect(hote.textContent).toContain('40 % réglé.')
  })

  it('ouvre un clavier numérique sur chaque entrée', () => {
    const champs = hote.querySelectorAll<HTMLInputElement>('.champ input')
    expect(champs).toHaveLength(2)
    for (const c of champs) expect(c.inputMode).toBe('decimal')
  })

  it('précise l’unité dans le libellé', () => {
    expect(hote.textContent).toContain('Total de l’année (F CFA)')
  })
})

describe('la saisie', () => {
  it('remonte la valeur au moteur', () => {
    const onChange = vi.fn()
    poser(scolarite, { nom: 'Aïcha', valeurs: { total: 75_000, verse: 30_000 } }, onChange)
    saisir('#calc-verse', '45 000')
    expect((onChange.mock.calls[0]?.[0] as EtatCalc).valeurs['verse']).toBe(45_000)
  })

  it('accepte la virgule', () => {
    const onChange = vi.fn()
    poser(course, { nom: 'Moto', valeurs: { montant: 3_000, personnes: 4 } }, onChange)
    saisir('#calc-personnes', '2,0')
    expect((onChange.mock.calls[0]?.[0] as EtatCalc).valeurs['personnes']).toBe(2)
  })

  it('ramène à zéro une saisie illisible, au lieu de figer l’écran sur NaN', () => {
    const onChange = vi.fn()
    poser(scolarite, { nom: 'Aïcha', valeurs: { total: 75_000, verse: 30_000 } }, onChange)
    saisir('#calc-verse', 'beaucoup')
    expect((onChange.mock.calls[0]?.[0] as EtatCalc).valeurs['verse']).toBe(0)
    saisir('#calc-verse', '-500')
    expect((onChange.mock.calls[1]?.[0] as EtatCalc).valeurs['verse']).toBe(0)
  })
})

describe('le partage de course à l’écran', () => {
  it('affiche la part et ce que l’arrondi ajoute, sans barre', () => {
    poser(course, { nom: 'Retour du marché', valeurs: { montant: 1_000, personnes: 3 } })
    expect(hote.querySelector('.calc-valeur')?.textContent).toBe(`334${E}F`)
    expect(hote.textContent).toContain('2 F de plus que la course')
    expect(hote.querySelector('[role="progressbar"]')).toBeNull()
  })

  it('demande combien vous êtes plutôt que de diviser par zéro', () => {
    poser(course, { nom: 'Taxi', valeurs: { montant: 3_000, personnes: 0 } })
    expect(hote.querySelector('.calc-valeur')?.textContent).toBe(`0${E}F`)
    expect(hote.textContent).toContain('Indique combien vous êtes.')
  })

  it('ne dit rien de plus quand le partage tombe juste', () => {
    poser(course, { nom: 'Taxi', valeurs: { montant: 2_000, personnes: 4 } })
    expect(hote.textContent).not.toContain('de plus que la course')
  })
})

describe('diffuser un calcul', () => {
  it('remonte la spécification, sans relance', () => {
    const onDiffuser = vi.fn()
    poser(scolarite, { nom: 'Aïcha', valeurs: { total: 75_000, verse: 30_000 } }, () => undefined, onDiffuser)
    act(() => hote.querySelector<HTMLButtonElement>('.outil-action.principale')?.click())
    const partage = onDiffuser.mock.calls[0]?.[0] as ShareSpec
    expect(partage.card.kicker).toBe('FRAIS SCOLAIRES')
    expect(partage.relances).toEqual([])
    expect(partage.txt).toContain('Reste à payer')
  })
})
