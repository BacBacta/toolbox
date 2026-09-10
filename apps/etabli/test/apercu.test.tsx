// @vitest-environment happy-dom
import { render as monter } from 'preact'
import { act } from 'preact/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { Apercu } from '../src/apercu.js'
import { textes } from '@a237/etabli'
import type { Projet } from '@a237/etabli'

const PROJET: Projet = {
  id: 'p1', nom: 'Ma page', maj: 0,
  fichiers: [{ nom: 'index.html', contenu: '<h1>Salut</h1>' }],
}

let hote: HTMLDivElement

function poser(tour = 0): void {
  act(() => { monter(<Apercu projet={PROJET} tour={tour} langue="fr" t={textes('fr')} />, hote) })
}

beforeEach(() => {
  hote = document.createElement('div')
  document.body.appendChild(hote)
})

/**
 * L'isolement du cadre est la seule chose qui rend tout le reste acceptable.
 *
 * On exécute ici du code écrit par quelqu'un — le sien, ou celui d'un projet
 * reçu sur WhatsApp. Sans `allow-same-origin`, ce code s'exécute dans une
 * origine opaque : il n'atteint ni le stockage de l'Établi, ni ses cookies, ni
 * son DOM. Avec, il pourrait retirer son propre bac à sable et lire les projets
 * de la personne.
 *
 * L'attribut est vérifié **sur l'élément rendu**, et pas seulement dans la
 * constante : c'est le poser qui compte, et l'oublier ne se voit pas à l'œil —
 * la page s'affiche exactement pareil.
 */
describe('le cadre d’exécution', () => {
  it('porte son bac à sable', () => {
    poser()
    const cadre = hote.querySelector('iframe')
    expect(cadre?.getAttribute('sandbox')).toBe('allow-scripts')
  })

  it('et jamais son origine', () => {
    poser()
    expect(hote.querySelector('iframe')?.getAttribute('sandbox')).not.toContain('allow-same-origin')
  })

  it('porte le projet, et un titre pour qui n’y voit pas', () => {
    poser()
    const cadre = hote.querySelector('iframe')
    expect(cadre?.getAttribute('srcdoc')).toContain('<h1>Salut</h1>')
    expect(cadre?.getAttribute('title')).not.toBe('')
  })
})

/**
 * La console : ce qui fait qu'on voit ses erreurs sur un téléphone.
 *
 * Il n'y a ni touche F12 ni outils de développement sur un Android d'entrée de
 * gamme. Sans cet écran, une page blanche est indiscernable d'une page qui
 * charge, et quelqu'un qui apprend en conclut qu'il n'y arrive pas.
 */
describe('la console', () => {
  function poster(donnees: unknown, source?: unknown): void {
    const cadre = hote.querySelector('iframe') as HTMLIFrameElement
    const evenement = new MessageEvent('message', { data: donnees })
    // `source` est en lecture seule sur l'événement : on le pose à la main,
    // comme le navigateur le ferait pour un message venu du cadre.
    Object.defineProperty(evenement, 'source', {
      value: source === undefined ? cadre.contentWindow : source,
    })
    act(() => { dispatchEvent(evenement) })
  }

  it('affiche ce que le code journalise', () => {
    poser()
    act(() => { (hote.querySelector('.console-titre') as HTMLButtonElement).click() })
    poster({ a237: 'etabli', sorte: 'journal', texte: 'salut' })
    expect(hote.querySelector('.console')?.textContent).toContain('salut')
  })

  it('signale les erreurs autrement : c’est ce qu’on cherche', () => {
    poser()
    poster({ a237: 'etabli', sorte: 'erreur', texte: 'a is not defined' })
    expect(hote.querySelector('.console-titre')?.className).toContain('a-des-erreurs')
    expect(hote.querySelector('.console-titre')?.textContent).toContain('1 erreur')
  })

  /*
   * N'importe quelle page, n'importe quelle extension peut poster dans cette
   * fenêtre. Sans la vérification de la source, leur texte s'afficherait comme
   * s'il venait du code de la personne — qui chercherait alors une faute qu'elle
   * n'a pas commise.
   */
  it('ignore ce qui ne vient pas de son cadre', () => {
    poser()
    act(() => { (hote.querySelector('.console-titre') as HTMLButtonElement).click() })
    poster({ a237: 'etabli', sorte: 'journal', texte: 'venu d’ailleurs' }, window)
    expect(hote.querySelector('.console')?.textContent).not.toContain('venu d’ailleurs')
  })

  it('et ignore un message de la bonne source mais de la mauvaise forme', () => {
    poser()
    act(() => { (hote.querySelector('.console-titre') as HTMLButtonElement).click() })
    poster({ sorte: 'journal', texte: 'sans marque' })
    poster('du texte tout seul')
    expect(hote.querySelector('.console')?.textContent).not.toContain('sans marque')
  })

  /*
   * Mélanger deux exécutions fait chercher une erreur qu'on vient de corriger.
   */
  it('repart vide à chaque lancement', () => {
    poser(1)
    act(() => { (hote.querySelector('.console-titre') as HTMLButtonElement).click() })
    poster({ a237: 'etabli', sorte: 'journal', texte: 'du tour d’avant' })
    expect(hote.querySelector('.console')?.textContent).toContain('du tour d’avant')

    poser(2)
    expect(hote.querySelector('.console')?.textContent ?? '').not.toContain('du tour d’avant')
  })
})

/**
 * Ce que la console dit quand elle n'a rien à dire.
 *
 * « Rien pour l'instant » plutôt qu'un panneau vide : la différence entre les
 * deux, c'est savoir si la console marche. Et la phrase apprend la seule chose
 * qu'il faut savoir pour s'en servir.
 */
describe('la console vide', () => {
  it('explique comment s’en servir plutôt que de ne rien montrer', () => {
    poser()
    act(() => { (hote.querySelector('.console-titre') as HTMLButtonElement).click() })
    expect(hote.querySelector('.console-vide')?.textContent).toContain('console.log')
  })

  it('et compte les erreurs au pluriel quand il y en a plusieurs', () => {
    poser()
    const cadre = hote.querySelector('iframe') as HTMLIFrameElement
    for (const texte of ['une', 'deux']) {
      const e = new MessageEvent('message', { data: { a237: 'etabli', sorte: 'erreur', texte } })
      Object.defineProperty(e, 'source', { value: cadre.contentWindow })
      act(() => { dispatchEvent(e) })
    }
    expect(hote.querySelector('.console-titre')?.textContent).toContain('2 erreurs')
  })
})

/**
 * L'explication sous l'erreur : ce qui change l'outil de nature.
 *
 * `Uncaught SyntaxError: Unexpected token '{'` ne dit rien à quelqu'un qui
 * apprend — et rien du tout s'il ne lit pas l'anglais. C'est précisément le
 * moment où il conclut qu'il n'y arrive pas, alors qu'il lui manquait une
 * virgule.
 */
describe('l’erreur, expliquée', () => {
  function erreur(texte: string): void {
    const cadre = hote.querySelector('iframe') as HTMLIFrameElement
    const e = new MessageEvent('message', { data: { a237: 'etabli', sorte: 'erreur', texte } })
    Object.defineProperty(e, 'source', { value: cadre.contentWindow })
    act(() => { dispatchEvent(e) })
  }

  function poserEn(langue: 'fr' | 'en'): void {
    act(() => { monter(<Apercu projet={PROJET} tour={0} langue={langue} t={textes(langue)} />, hote) })
    act(() => { (hote.querySelector('.console-titre') as HTMLButtonElement).click() })
  }

  it('dit ce qui s’est passé et quoi faire, en français', () => {
    poserEn('fr')
    erreur('Uncaught ReferenceError: prix is not defined')
    const lu = hote.querySelector('.console-explication')?.textContent ?? ''
    expect(lu).toContain('prix')
    expect(lu).toMatch(/orthographe|déclare/i)
  })

  it('et en anglais quand c’est la langue choisie', () => {
    poserEn('en')
    erreur('Uncaught ReferenceError: prix is not defined')
    const lu = hote.querySelector('.console-explication')?.textContent ?? ''
    expect(lu).toMatch(/spelling|declare/i)
    expect(lu).not.toMatch(/orthographe/i)
  })

  /*
   * Le message d'origine reste affiché : il faudra bien le reconnaître le jour
   * où on le cherchera dans un moteur de recherche, et le cacher apprendrait à
   * dépendre de l'Établi.
   */
  it('sans cacher le message d’origine', () => {
    poserEn('fr')
    erreur('Uncaught ReferenceError: prix is not defined')
    expect(hote.querySelector('.console-brut')?.textContent).toContain('ReferenceError')
  })

  it('et n’invente rien quand elle ne connaît pas l’erreur', () => {
    poserEn('fr')
    erreur('Uncaught WeirdError: quelque chose de très inhabituel')
    expect(hote.querySelector('.console-explication')).toBe(null)
    expect(hote.querySelector('.console-brut')?.textContent).toContain('WeirdError')
  })

  it('un journal ordinaire n’est pas expliqué : il n’y a rien à expliquer', () => {
    poserEn('fr')
    const cadre = hote.querySelector('iframe') as HTMLIFrameElement
    const e = new MessageEvent('message', { data: { a237: 'etabli', sorte: 'journal', texte: 'salut' } })
    Object.defineProperty(e, 'source', { value: cadre.contentWindow })
    act(() => { dispatchEvent(e) })
    expect(hote.querySelector('.console-explication')).toBe(null)
  })
})
