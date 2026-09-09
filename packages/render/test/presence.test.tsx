// @vitest-environment happy-dom
import type { EtatPresence, RenderContext, ShareSpec } from '@a237/engine'
import { render as monter } from 'preact'
import { act } from 'preact/test-utils'
import { render as enChaine } from 'preact-render-to-string'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RegistrePresence } from '../src/registre/presence.js'

const CTX: RenderContext = {
  lien: 'atl.cm/s/ZBV3',
  maintenant: new Date('2026-09-09T07:45:00.000Z'),
}

const CLASSE: EtatPresence = {
  nom: 'Cours du soir',
  encre: 'foret',
  noms: ['Adèle', 'Ernest', 'Rosalie'],
  seances: [
    { titre: '', presents: [true, true, true] },
    { titre: '12 mars', presents: [true, false, true] },
    { titre: '', presents: [false, false, true] },
  ],
}

const VIDE: EtatPresence = { ...CLASSE, noms: [], seances: [] }

function html(
  etat: EtatPresence,
  onglet?: 'Appel' | 'Assiduité',
  seance?: number,
): string {
  return enChaine(
    <RegistrePresence
      glyphe="◰"
      etat={etat}
      ctx={CTX}
      onChange={() => undefined}
      onDiffuser={() => undefined}
      {...(onglet !== undefined ? { ongletInitial: onglet } : {})}
      {...(seance !== undefined ? { seanceInitiale: seance } : {})}
    />,
  )
}

describe('l’appel', () => {
  const sortie = html(CLASSE)

  it('ouvre sur la dernière séance', () => {
    // C'est celle qu'on vient de commencer : personne n'ouvre une feuille de
    // présence pour relire l'appel du mois dernier.
    expect(sortie).toContain('aria-label="Rosalie : présent"')
    expect(sortie).toContain('aria-label="Adèle : absent"')
  })

  it('affiche présents et taux', () => {
    expect(sortie).toContain('Présents')
    expect(sortie).toContain('1 / 3')
    expect(sortie).toContain('33 %')
  })

  it('nomme les absents en toutes lettres sous la liste', () => {
    expect(sortie).toContain('2 absents : Adèle, Ernest.')
  })

  it('n’affiche pas le sélecteur quand il n’y a qu’une séance', () => {
    const une = { ...CLASSE, seances: [CLASSE.seances[0]!] }
    expect(html(une)).not.toContain('presence-seances')
    expect(sortie).toContain('presence-seances')
  })

  it('donne à chaque séance son titre, ou son rang', () => {
    expect(sortie).toContain('>séance 1<')
    expect(sortie).toContain('>12 mars<')
  })

  it('distingue « pas de monde » de « pas de séance »', () => {
    expect(html(VIDE)).toContain('Personne sur la feuille')
    const gens = { ...VIDE, noms: ['Adèle'] }
    expect(html(gens)).toContain('Aucune séance ouverte')
  })

  it('ne montre jamais le taux d’assiduité sur l’écran de l’appel', () => {
    // L'appel se fait en regardant les gens. Un « 33 % » à côté d'un nom
    // pendant qu'on pointe, c'est un jugement affiché devant l'assemblée.
    expect(sortie).not.toContain('outil-montant')
  })
})

describe('l’assiduité', () => {
  const sortie = html(CLASSE, 'Assiduité')

  it('donne à chacun son taux sur toutes les séances', () => {
    expect(sortie).toContain('2 sur 3 séances')
    expect(sortie).toContain('67 %')
    expect(sortie).toContain('33 %')
    expect(sortie).toContain('100 %')
  })

  it('marque en rouge qui décroche', () => {
    expect(sortie).toContain('outil-montant retard')
  })

  it('dit « nouveau » plutôt que zéro pour qui n’a vécu aucune séance', () => {
    const neuf = { ...VIDE, noms: ['Adèle'] }
    const sortie = html(neuf, 'Assiduité')
    expect(sortie).toContain('nouveau')
    // Le zéro qui compterait serait dans la rangée, pas dans l'entête.
    expect(sortie).not.toContain('outil-montant')
  })

  it('n’annonce ni présents ni taux tant qu’aucune séance n’est ouverte', () => {
    // « 0 présents sur 3 » se lit comme une assemblée déserte. Il n'y a
    // simplement rien à quoi être présent.
    const sortie = html({ ...VIDE, noms: ['Adèle', 'Ernest', 'Rosalie'] })
    expect(sortie).toContain('<span class="v">—</span>')
    expect(sortie).not.toContain('0 / 3')
    expect(sortie).not.toContain('outil-barre')
  })
})

describe('les gestes de la feuille', () => {
  let hote: HTMLDivElement

  beforeEach(() => {
    hote = document.createElement('div')
    document.body.appendChild(hote)
  })

  afterEach(() => {
    monter(null, hote)
    hote.remove()
  })

  function poser(etat: EtatPresence): {
    change: ReturnType<typeof vi.fn>
    diffuse: ReturnType<typeof vi.fn>
  } {
    const change = vi.fn()
    const diffuse = vi.fn()
    act(() => {
      monter(
        <RegistrePresence
          glyphe="◰"
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

  it('pointe une personne sur la séance affichée, pas sur une autre', () => {
    const { change } = poser(CLASSE)
    const bouton = [...hote.querySelectorAll<HTMLButtonElement>('.outil-bascule')].find(
      (b) => b.getAttribute('aria-label') === 'Adèle : absent',
    )
    act(() => bouton?.click())
    const suivant = change.mock.calls[0]?.[0] as EtatPresence
    expect(suivant.seances[2]?.presents).toEqual([true, false, true])
    expect(suivant.seances[1]?.presents).toEqual([true, false, true])
  })

  it('ouvre une séance avec tout le monde présent', () => {
    const { change } = poser(CLASSE)
    const bouton = [...hote.querySelectorAll<HTMLButtonElement>('.outil-action')].find(
      (b) => b.textContent === 'Nouvelle séance',
    )
    act(() => bouton?.click())
    const suivant = change.mock.calls[0]?.[0] as EtatPresence
    expect(suivant.seances).toHaveLength(4)
    expect(suivant.seances[3]?.presents).toEqual([true, true, true])
  })

  it('bascule sur la séance qu’on choisit', () => {
    poser(CLASSE)
    const onglet = [...hote.querySelectorAll<HTMLButtonElement>('.presence-seances button')]
    act(() => onglet[1]?.click())
    const marque = hote.querySelector('[aria-label="Ernest : absent"]')
    expect(marque).not.toBeNull()
    expect(hote.querySelector('[aria-label="Adèle : présent"]')).not.toBeNull()
  })

  it('diffuse la séance affichée, pas la dernière', () => {
    poser(CLASSE)
    const onglets = [...hote.querySelectorAll<HTMLButtonElement>('.presence-seances button')]
    act(() => onglets[1]?.click())
    const diffuser = [...hote.querySelectorAll<HTMLButtonElement>('.outil-action')].find(
      (b) => b.textContent === 'Diffuser',
    )
    let partage: ShareSpec | undefined
    const change = vi.fn()
    act(() => {
      monter(
        <RegistrePresence
          glyphe="◰"
          etat={CLASSE}
          ctx={CTX}
          onChange={change}
          onDiffuser={(p) => {
            partage = p
          }}
          seanceInitiale={1}
        />,
        hote,
      )
    })
    act(() =>
      [...hote.querySelectorAll<HTMLButtonElement>('.outil-action')]
        .find((b) => b.textContent === 'Diffuser')
        ?.click(),
    )
    expect(diffuser).not.toBeUndefined()
    expect(partage?.card.tag).toBe('12 mars')
    expect(partage?.relances.map((r) => r.nom)).toEqual(['Ernest'])
  })
})
