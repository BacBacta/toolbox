// @vitest-environment happy-dom
import type { BatirPartage, EtatNjangi, RenderContext } from '@a237/engine'
import { ESPACE_INSECABLE } from '@a237/engine'
import { render as monter } from 'preact'
import { act } from 'preact/test-utils'
import { render as enChaine } from 'preact-render-to-string'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RegistreNjangi } from '../src/registre/njangi.js'

const E = ESPACE_INSECABLE

const CTX: RenderContext = {
  lien: 'atl.cm/n/ZBV3?t=36',
  maintenant: new Date('2026-09-09T07:45:00.000Z'),
}

const CARNET: EtatNjangi = {
  nom: 'Njangi Nkolbisson',
  cotisation: 5_000,
  periode: 'semaine',
  tour: 36,
  historique: [
    { tour: 34, collecte: 25_000 },
    { tour: 35, collecte: 30_000 },
  ],
  membres: [
    { nom: 'Mama Céline', aVerse: true, aRecu: true, estAuTour: false, versements: 12, tours: 12 },
    { nom: 'Ernest', tel: '699112233', aVerse: true, aRecu: false, estAuTour: true, versements: 11, tours: 12 },
    { nom: 'Adèle', tel: '699445566', aVerse: false, aRecu: false, estAuTour: false, versements: 7, tours: 12 },
    { nom: 'Serge', aVerse: false, aRecu: false, estAuTour: false, versements: 9, tours: 12 },
  ],
}

const VIDE: EtatNjangi = { ...CARNET, tour: 1, historique: [], membres: [] }

function html(etat: EtatNjangi, onglet?: 'Cagnotte' | 'Membres' | 'Historique'): string {
  return enChaine(
    <RegistreNjangi
      glyphe="◉"
      etat={etat}
      ctx={CTX}
      onChange={() => undefined}
      onDiffuser={() => undefined}
      {...(onglet !== undefined ? { ongletInitial: onglet } : {})}
    />,
  )
}

describe('l’entête dit où en est la cagnotte', () => {
  const sortie = html(CARNET)

  it('nomme le njangi, le tour et la cotisation', () => {
    expect(sortie).toContain('Njangi Nkolbisson')
    expect(sortie).toContain(`semaine 36 · cotisation 5${E}000${E}F`)
  })

  it('affiche les trois indicateurs', () => {
    expect(sortie).toContain('Collecté')
    expect(sortie).toContain(`10${E}000${E}F`)
    expect(sortie).toContain('Attendu')
    expect(sortie).toContain(`20${E}000${E}F`)
    expect(sortie).toContain('Retard')
  })

  it('marque l’onglet courant pour les lecteurs d’écran', () => {
    expect(sortie).toContain('aria-selected="true"')
  })

  it('adapte le vocabulaire au rythme du njangi', () => {
    expect(html({ ...CARNET, periode: 'mois' })).toContain('mois 36')
    expect(html({ ...CARNET, periode: 'mois' })).toContain('Mois suivant')
    expect(html({ ...CARNET, periode: 'quinzaine' })).toContain('Quinzaine suivante')
  })
})

describe('l’onglet Cagnotte', () => {
  const sortie = html(CARNET)

  it('montre l’avancement en pourcentage et le reste', () => {
    expect(sortie).toContain('aria-valuenow="50"')
    expect(sortie).toContain(`50 % · reste 10${E}000${E}F`)
  })

  it('dit où chacun en est dans le cycle', () => {
    expect(sortie).toContain('a déjà reçu')
    expect(sortie).toContain('reçoit ce tour')
    expect(sortie).toContain('pas encore servi')
  })

  it('distingue celui qui a versé de celui qui doit', () => {
    expect(sortie).toContain('aria-label="Adèle : doit sa part"')
    expect(sortie).toContain('aria-label="Ernest : a versé"')
  })

  it('n’affiche le montant qu’une fois versé', () => {
    // Le bouton dit déjà « doit ». Un « — » à côté ne l'aidait pas et prenait
    // la place du nom, qui, lui, doit se lire en entier.
    const versements = sortie.match(/class="outil-montant regle"/g) ?? []
    expect(versements).toHaveLength(1)
    expect(sortie).not.toContain('outil-montant retard')
  })

  it('dit qui reçoit, et combien', () => {
    expect(sortie).toContain(`Ernest reçoit 10${E}000${E}F ce tour-ci`)
  })

  it('invite à commencer plutôt que d’afficher un tableau vide', () => {
    const vide = html(VIDE)
    expect(vide).toContain('Aucun membre pour l’instant')
    expect(vide).toContain('aria-valuenow="0"')
    expect(vide).not.toContain('reçoit ce tour-ci')
  })
})

describe('l’onglet Membres', () => {
  const sortie = html(CARNET, 'Membres')

  it('classe du moins fiable au plus fiable', () => {
    expect(sortie.indexOf('Adèle')).toBeLessThan(sortie.indexOf('Mama Céline'))
  })

  it('donne le compte des tours plutôt qu’un pourcentage seul', () => {
    expect(sortie).toContain('7 versements sur 12 tours')
    expect(sortie).toContain('58 %')
  })

  it('juge fiable au-dessus de 80 %, fragile en dessous', () => {
    expect(sortie).toContain('fragile')
    expect(sortie).toContain('fiable')
  })

  it('ne juge pas un membre qui n’a vécu aucun tour', () => {
    const neuf = html(
      { ...CARNET, membres: [{ nom: 'Rosalie', aVerse: false, aRecu: false, estAuTour: false, versements: 0, tours: 0 }] },
      'Membres',
    )
    expect(neuf).toContain('nouveau')
    expect(neuf).not.toContain('fragile')
    // Le badge dit « nouveau » : la ligne de détail et le pourcentage se
    // taisent plutôt que de le redire deux fois de plus.
    expect(neuf).not.toContain('class="n2"')
    expect(neuf).not.toContain('outil-montant')
  })

  it('ouvre un formulaire d’ajout, avec le téléphone facultatif', () => {
    expect(sortie).toContain('aria-label="Nom du membre"')
    expect(sortie).toContain('aria-label="Téléphone du membre, facultatif"')
  })
})

describe('l’onglet Historique', () => {
  it('trace les tours passés et celui en cours', () => {
    const sortie = html(CARNET, 'Historique')
    expect(sortie).toContain('<svg')
    expect(sortie).toContain('t34')
    expect(sortie).toContain('t35')
    expect(sortie).toContain('t36')
    expect(sortie).toContain('role="img"')
  })

  it('ne divise pas par zéro sur un njangi qui n’a rien collecté', () => {
    const sortie = html(VIDE, 'Historique')
    expect(sortie).toContain('<svg')
    expect(sortie).not.toContain('NaN')
  })
})

describe('les gestes appellent le moteur, et rien d’autre', () => {
  let hote: HTMLDivElement

  beforeEach(() => {
    hote = document.createElement('div')
    document.body.appendChild(hote)
  })

  afterEach(() => {
    monter(null, hote)
    hote.remove()
  })

  function poser(etat: EtatNjangi, onChange: (e: EtatNjangi) => void, onDiffuser = () => undefined) {
    act(() => {
      monter(
        <RegistreNjangi glyphe="◉" etat={etat} ctx={CTX} onChange={onChange} onDiffuser={onDiffuser} />,
        hote,
      )
    })
  }

  /** `act` vide la file de rendu de Preact : sans lui le DOM a un tour de retard. */
  function cliquer(selecteur: string): void {
    const bouton = hote.querySelector<HTMLButtonElement>(selecteur)
    if (bouton === null) throw new Error(`bouton introuvable : ${selecteur}`)
    act(() => {
      bouton.click()
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

  it('bascule le versement du bon membre', () => {
    const onChange = vi.fn()
    poser(CARNET, onChange)
    cliquer('[aria-label="Adèle : doit sa part"]')
    expect(onChange).toHaveBeenCalledTimes(1)
    const suivant = onChange.mock.calls[0]?.[0] as EtatNjangi
    expect(suivant.membres[2]).toMatchObject({ nom: 'Adèle', aVerse: true })
    expect(suivant.membres[0]?.aVerse).toBe(true)
  })

  it('ne modifie pas l’état qu’on lui a passé', () => {
    poser(CARNET, () => undefined)
    cliquer('[aria-label="Adèle : doit sa part"]')
    expect(CARNET.membres[2]?.aVerse).toBe(false)
  })

  it('clôture le tour et passe la main au suivant', () => {
    const onChange = vi.fn()
    poser(CARNET, onChange)
    cliquer('.outil-action:not(.principale)')
    const suivant = onChange.mock.calls[0]?.[0] as EtatNjangi
    expect(suivant.tour).toBe(37)
    expect(suivant.membres.every((m) => !m.aVerse)).toBe(true)
    expect(suivant.historique).toHaveLength(3)
  })

  it('remonte la spécification de partage, sans rien envoyer lui-même', () => {
    const onDiffuser = vi.fn()
    poser(CARNET, () => undefined, onDiffuser)
    cliquer('.outil-action.principale')
    const partage = (onDiffuser.mock.calls[0]?.[0] as BatirPartage)(CTX)
    expect(partage.title).toBe('Njangi Nkolbisson')
    expect(partage.card.link).toBe('atl.cm/n/ZBV3?t=36')
    // Les relances attendent le pouce du trésorier (invariant § 2.4).
    expect(partage.relances.map((r) => r.nom)).toEqual(['Adèle', 'Serge'])
  })

  it('ajoute un membre saisi au clavier, puis vide le formulaire', () => {
    const onChange = vi.fn()
    poser(CARNET, onChange)
    cliquer('[role="tab"][aria-selected="false"]')
    saisir('[aria-label="Nom du membre"]', 'Rosalie')
    cliquer('.outil-action.principale')

    const suivant = onChange.mock.calls[0]?.[0] as EtatNjangi
    expect(suivant.membres.map((m) => m.nom)).toContain('Rosalie')
    expect(hote.querySelector<HTMLInputElement>('[aria-label="Nom du membre"]')?.value).toBe('')
  })

  it('n’ajoute rien sur un nom vide', () => {
    const onChange = vi.fn()
    poser(CARNET, onChange)
    cliquer('[role="tab"][aria-selected="false"]')
    cliquer('.outil-action.principale')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('retire un membre depuis l’onglet Membres', () => {
    const onChange = vi.fn()
    poser(CARNET, onChange)
    cliquer('[role="tab"][aria-selected="false"]')
    cliquer('[aria-label="Retirer Adèle"]')
    const suivant = onChange.mock.calls[0]?.[0] as EtatNjangi
    expect(suivant.membres.map((m) => m.nom)).toEqual(['Mama Céline', 'Ernest', 'Serge'])
  })

  it('change d’onglet sans perdre l’état', () => {
    poser(CARNET, () => undefined)
    expect(hote.textContent).toContain('reste')
    cliquer('[role="tab"][aria-selected="false"]')
    expect(hote.textContent).toContain('Fiabilité du cycle')
  })
})
