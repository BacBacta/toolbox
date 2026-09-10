// @vitest-environment happy-dom
import { EXTRAIT_VIDE } from '@a237/engine'
import type { PageDemande, RenderContext } from '@a237/engine'
import { render as monter } from 'preact'
import { act } from 'preact/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PAGE_VIDE, Outil, creer } from '../src/outils/page.js'
import type { OutilEnregistre } from '../src/stockage.js'

/**
 * L'écran d'une page composée.
 *
 * Ce qu'on éprouve ici tient en une phrase : **ce qu'on modifie est ce qui se
 * publie**. Un registre a un squelette d'un côté et des lignes de l'autre ;
 * une page n'a pas cette séparation, et un aperçu qui ne serait pas le
 * composant de la page publiée mentirait au moment où ça compte — quand le
 * lien est déjà parti.
 */

const LE_9_SEPT = new Date('2026-09-09T07:45:00.000Z')
const CTX: RenderContext = { lien: 'atl.cm/d/K7M2XQ4BN9PZ', maintenant: LE_9_SEPT }

const PAGE: PageDemande = {
  titre: 'Quincaillerie Bépanda',
  kicker: 'QUINCAILLERIE',
  accroche: 'Tôles, ciment et outillage, à Bépanda depuis 2012.',
  sections: [
    { titre: 'Ce que je vends', sorte: 'liste', lignes: [{ nom: 'Tôles bac 30/100' }] },
    { titre: 'Quelques prix', sorte: 'prix', lignes: [{ nom: 'Sac de ciment', valeur: '5 800 F' }] },
  ],
  telephone: '699412708',
  adresse: 'Rue Bépanda-Omnisport',
}

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
  etat: unknown,
  onChange = vi.fn(),
  onDiffuser = vi.fn(),
): { onChange: typeof onChange; onDiffuser: typeof onDiffuser } {
  const outil: OutilEnregistre = {
    id: 'abc', skeleton: 'compose-page', nom: 'Essai', etat, version: 0,
    creeLe: LE_9_SEPT.getTime(), majLe: LE_9_SEPT.getTime(),
  }
  act(() => {
    monter(
      <Outil outil={outil} glyphe="✳" ctx={CTX} onChange={onChange} onDiffuser={onDiffuser} />,
      hote,
    )
  })
  return { onChange, onDiffuser }
}

function cliquer(texte: string): void {
  const b = [...hote.querySelectorAll('button')].find((x) => x.textContent?.trim() === texte)
  if (b === undefined) throw new Error(`bouton introuvable : ${texte}`)
  act(() => b.click())
}

describe('la création', () => {
  it('prend ce que le modèle a écrit, et le nomme comme lui', () => {
    expect(creer('compose-page', LE_9_SEPT, EXTRAIT_VIDE, { page: PAGE })).toEqual({
      nom: 'Quincaillerie Bépanda',
      etat: PAGE,
    })
  })

  it('ouvre une page vide quand personne n’en a composé — et elle tient debout', () => {
    // Une page neuve doit être publiable telle quelle : un outil qui s'ouvre
    // sur un état que son propre contrôle refuse est un outil cassé à
    // l'ouverture.
    const neuf = creer('compose-page', LE_9_SEPT, EXTRAIT_VIDE)
    expect(neuf.etat).toEqual(PAGE_VIDE)
    poser(neuf.etat)
    expect(hote.textContent).toContain('Ma page')
  })
})

describe('l’aperçu', () => {
  it('montre la vitrine, pas un résumé', () => {
    poser(PAGE)
    expect(hote.textContent).toContain('Quincaillerie Bépanda')
    expect(hote.textContent).toContain('Sac de ciment')
    expect(hote.textContent).toContain('5 800 F')
  })

  it('porte le bouton WhatsApp que le lecteur touchera', () => {
    poser(PAGE)
    const lien = hote.querySelector<HTMLAnchorElement>('a.vitrine-appel')
    expect(lien?.href).toContain('wa.me/237699412708')
  })

  it('ne contient aucun script : c’est le contrat, pas un filtre', () => {
    poser(PAGE)
    expect(hote.querySelector('script')).toBeNull()
    expect(hote.innerHTML).not.toContain('javascript:')
  })
})

describe('la modification', () => {
  it('édite la configuration elle-même : ce qu’on change est ce qui se publie', () => {
    const { onChange } = poser(PAGE)
    cliquer('Modifier')
    const champ = [...hote.querySelectorAll('input')].find(
      (i) => (i.value as string) === 'Quincaillerie Bépanda',
    )
    if (champ === undefined) throw new Error('le nom ne s’édite pas')
    act(() => {
      champ.value = 'Quincaillerie de Deido'
      champ.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ titre: 'Quincaillerie de Deido' }))
  })

  it('ne propose pas de régler le sommaire : il ne se voit qu’à trois sections', () => {
    // Une case à cocher qui ne change rien à l'écran fait douter de tout le
    // reste. C'est la demande qui le décide, et l'aperçu qui le montre.
    poser(PAGE)
    cliquer('Modifier')
    expect(hote.textContent).not.toContain('Menu en haut')
  })
})

describe('le partage', () => {
  it('emporte le lien, les prix et le numéro', () => {
    const { onDiffuser } = poser(PAGE)
    cliquer('Publier et partager')
    const batir = onDiffuser.mock.calls[0]?.[0] as (c: RenderContext) => { txt: string }
    const txt = batir(CTX).txt
    expect(txt).toContain('QUINCAILLERIE BÉPANDA')
    expect(txt).toContain('Sac de ciment — 5 800 F')
    expect(txt).toContain(CTX.lien)
  })
})

describe('un état qui ne tient pas le contrat', () => {
  it('se dit, au lieu de dessiner une page à trous', () => {
    // Une page publiée sous le nom de quelqu'un avec une section vide est pire
    // qu'un écran qui refuse : le lien est déjà parti.
    poser({ ...PAGE, sections: [{ titre: 'Nos prix', sorte: 'prix' }] })
    expect(hote.textContent).toContain('ne correspond pas à ce que l’application sait dessiner')
  })
})
