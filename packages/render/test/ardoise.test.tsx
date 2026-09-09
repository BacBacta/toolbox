// @vitest-environment happy-dom
import type { EtatArdoise, RenderContext, ShareSpec } from '@a237/engine'
import { ESPACE_INSECABLE } from '@a237/engine'
import { render as monter } from 'preact'
import { act } from 'preact/test-utils'
import { render as enChaine } from 'preact-render-to-string'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RegistreArdoise } from '../src/registre/ardoise.js'

const E = ESPACE_INSECABLE
const LE_9_SEPT = new Date('2026-09-09T07:45:00.000Z')
const CTX: RenderContext = { lien: 'atl.cm/d/ZBV3', maintenant: LE_9_SEPT }

function ilYA(n: number): string {
  return new Date(LE_9_SEPT.getTime() - n * 86_400_000).toISOString()
}

const BOUTIQUE: EtatArdoise = {
  nom: 'Ardoise clients',
  encre: 'bordeaux',
  boutique: 'Quincaillerie Bépanda',
  dettes: [
    { client: 'Adèle Ngo Bell', montant: 45_000, depuis: ilYA(62), tel: '699410277', regle: false },
    { client: 'Ernest Fotso', montant: 12_000, depuis: ilYA(9), regle: false },
    { client: 'Théodore Kamdem', montant: 8_000, depuis: ilYA(40), regle: true },
  ],
}

const VIDE: EtatArdoise = { ...BOUTIQUE, boutique: '', dettes: [] }

function html(etat: EtatArdoise, onglet?: 'Encours' | 'Analyse'): string {
  return enChaine(
    <RegistreArdoise
      glyphe="◷"
      etat={etat}
      ctx={CTX}
      onChange={() => undefined}
      onDiffuser={() => undefined}
      {...(onglet !== undefined ? { ongletInitial: onglet } : {})}
    />,
  )
}

describe('l’ardoise à l’écran', () => {
  const sortie = html(BOUTIQUE)

  it('affiche encours, recouvré et nombre de clients', () => {
    expect(sortie).toContain('Encours')
    expect(sortie).toContain(`57${E}000${E}F`)
    expect(sortie).toContain('Recouvré')
    expect(sortie).toContain(`8${E}000${E}F`)
    expect(sortie).toContain('Clients')
  })

  it('dit l’âge de chaque dette en toutes lettres', () => {
    expect(sortie).toContain('retard de 62 jours')
    expect(sortie).toContain('depuis 9 jours')
    expect(sortie).toContain('réglé')
  })

  it('signale le retard sans voler la place au nom', () => {
    // Un badge « +30 j » disait une troisième fois ce que « retard de 62
    // jours » et le montant en rouge disent déjà — et coûtait les soixante
    // pixels qui faisaient tenir « Adèle Ngo Bell » en entier.
    expect(sortie).toContain('retard de 62 jours')
    expect(sortie).toContain('outil-montant retard')
    expect(sortie).toContain('1 client au-delà de 30 jours')
  })

  it('ne coupe pas le nom du client : ni avatar, ni bouton de trop', () => {
    // Sur 390 px, une ardoise portait « Adèle… » et « Rosal… ». Un cahier de
    // dettes où on ne lit pas le nom du client ne sert à rien.
    expect(sortie).toContain('<span class="n1">Adèle Ngo Bell</span>')
    expect(sortie).not.toContain('class="ini"')
    // Le retrait n'est pas un geste quotidien : il attend la ligne soldée.
    expect(sortie).toContain('aria-label="Retirer Théodore Kamdem de l’ardoise"')
    expect(sortie).not.toContain('aria-label="Retirer Adèle Ngo Bell de l’ardoise"')
  })

  it('ouvre sur ce qui est dû, le plus vieux en tête', () => {
    const i = (nom: string): number => sortie.indexOf(nom)
    expect(i('Adèle Ngo Bell')).toBeLessThan(i('Ernest Fotso'))
    expect(i('Ernest Fotso')).toBeLessThan(i('Théodore Kamdem'))
  })

  it('dit quoi faire quand l’ardoise est vide', () => {
    expect(html(VIDE)).toContain('Aucune dette pour l’instant')
  })

  it('ne montre la recherche que si la liste dépasse le coup d’œil', () => {
    // Sur cinq lignes, un champ de recherche est un obstacle de plus entre le
    // pouce et le bouton « doit ».
    expect(sortie).not.toContain('Chercher un client')
    const longue: EtatArdoise = {
      ...BOUTIQUE,
      dettes: Array.from({ length: 9 }, (_, i) => ({
        client: `Client ${i}`, montant: 1_000, depuis: ilYA(i), regle: false,
      })),
    }
    expect(html(longue)).toContain('Chercher un client')
  })

  it('donne à chaque bascule une étiquette qui nomme le client', () => {
    // Une rangée d'« doit / doit / doit » ne dit rien à un lecteur d'écran.
    expect(sortie).toContain('aria-label="Adèle Ngo Bell : doit encore"')
    expect(sortie).toContain('aria-label="Théodore Kamdem : a réglé"')
  })
})

describe('l’onglet Analyse', () => {
  const sortie = html(BOUTIQUE, 'Analyse')

  it('range l’encours en trois tranches d’ancienneté', () => {
    expect(sortie).toContain('0–15 j')
    expect(sortie).toContain('16–30 j')
    expect(sortie).toContain('+30 j')
  })

  it('dit la part critique en pourcentage, pas seulement en francs', () => {
    // « 45 000 F au-delà de trente jours » ne se compare à rien ; « 79 % de
    // l'encours » se compare à la semaine dernière.
    expect(sortie).toContain('79 % de l’encours a plus de trente jours')
  })

  it('ne donne pas d’initiales à une tranche d’ancienneté', () => {
    // « 0–15 j » devenait un jeton rond marqué « 0J », comme un client.
    expect(sortie).not.toContain('class="ini"')
  })

  it('ne divise pas par zéro quand rien n’est ouvert', () => {
    const solde = { ...BOUTIQUE, dettes: BOUTIQUE.dettes.map((d) => ({ ...d, regle: true })) }
    expect(html(solde, 'Analyse')).toContain('rien à vieillir')
  })
})

describe('les gestes de l’ardoise', () => {
  let hote: HTMLDivElement

  beforeEach(() => {
    hote = document.createElement('div')
    document.body.appendChild(hote)
  })

  afterEach(() => {
    monter(null, hote)
    hote.remove()
  })

  function poser(etat: EtatArdoise): { change: ReturnType<typeof vi.fn>; diffuse: ReturnType<typeof vi.fn> } {
    const change = vi.fn()
    const diffuse = vi.fn()
    act(() => {
      monter(
        <RegistreArdoise
          glyphe="◷"
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

  it('bascule une dette en réglée sans toucher aux autres', () => {
    const { change } = poser(BOUTIQUE)
    const bouton = [...hote.querySelectorAll<HTMLButtonElement>('.outil-bascule')].find(
      (b) => b.getAttribute('aria-label')?.startsWith('Ernest') === true,
    )
    act(() => bouton?.click())
    const suivant = change.mock.calls[0]?.[0] as EtatArdoise
    expect(suivant.dettes[1]?.regle).toBe(true)
    expect(suivant.dettes[0]?.regle).toBe(false)
  })

  it('ajoute une dette datée d’aujourd’hui', () => {
    const { change } = poser(VIDE)
    const [nom, montant] = [...hote.querySelectorAll<HTMLInputElement>('.outil-formulaire input')]
    nom!.value = 'Rosalie'
    montant!.value = '15 000'
    act(() => {
      nom!.dispatchEvent(new Event('input', { bubbles: true }))
      montant!.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const ajouter = [...hote.querySelectorAll<HTMLButtonElement>('.outil-action')].find(
      (b) => b.textContent === 'Ajouter',
    )
    act(() => ajouter?.click())
    const suivant = change.mock.calls.at(-1)?.[0] as EtatArdoise
    expect(suivant.dettes).toEqual([
      { client: 'Rosalie', montant: 15_000, depuis: LE_9_SEPT.toISOString(), regle: false },
    ])
  })

  it('diffuse une carte qui porte l’avertissement du brief', () => {
    const { diffuse } = poser(BOUTIQUE)
    const bouton = [...hote.querySelectorAll<HTMLButtonElement>('.outil-action')].find(
      (b) => b.textContent === 'Diffuser',
    )
    act(() => bouton?.click())
    const partage = diffuse.mock.calls[0]?.[0] as ShareSpec
    expect(partage.warn).toContain('pour toi, pas pour un groupe')
    expect(partage.relances.map((r) => r.nom)).toEqual(['Adèle Ngo Bell', 'Ernest Fotso'])
  })
})
