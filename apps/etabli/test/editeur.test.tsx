// @vitest-environment happy-dom
import { render as monter } from 'preact'
import { act } from 'preact/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { Editeur } from '../src/editeur.js'
import type { Fichier, Projet } from '@a237/etabli'

/**
 * Écrire du code sur un téléphone.
 *
 * Deux choses cassent ici en silence, et aucune ne se voit à l'œil : le clavier
 * qui corrige ce qu'on tape, et les caractères qu'il enterre. Ce sont les deux
 * que ces essais tiennent.
 */

const PROJET: Projet = {
  id: 'p1', nom: 'Ma page', maj: 0,
  fichiers: [
    { nom: 'index.html', contenu: '<h1>a</h1>' },
    { nom: 'script.js', contenu: 'let a = 1' },
  ],
}

let hote: HTMLDivElement
let ecrits: [string, string][]
let ajoutes: Fichier[]

function poser(projet: Projet = PROJET, ouvert = 'script.js'): void {
  act(() => {
    monter(
      <Editeur
        projet={projet}
        ouvert={ouvert}
        onOuvrir={() => undefined}
        onEcrire={(nom, contenu) => ecrits.push([nom, contenu])}
        onAjouter={(f) => ajoutes.push(f)}
      />,
      hote,
    )
  })
}

beforeEach(() => {
  hote = document.createElement('div')
  document.body.appendChild(hote)
  ecrits = []
  ajoutes = []
})

/**
 * Un clavier Android met une majuscule après chaque point, corrige les mots
 * qu'il ne connaît pas, et propose la suite.
 *
 * Appliqué à du code, ça donne `Const` au lieu de `const`,
 * `document.GetElementById`, et des guillemets courbes que le navigateur
 * refuse. La personne voit son travail cassé sans comprendre par quoi — et
 * elle n'a rien fait. Ces quatre attributs sont la différence entre un éditeur
 * utilisable sur un téléphone et un jouet.
 */
describe('la zone de saisie', () => {
  it('coupe la correction, la majuscule automatique et la complétion', () => {
    poser()
    const zone = hote.querySelector('textarea')
    expect(zone?.getAttribute('spellcheck')).toBe('false')
    expect(zone?.getAttribute('autocapitalize')).toBe('off')
    expect(zone?.getAttribute('autocorrect')).toBe('off')
    expect(zone?.getAttribute('autocomplete')).toBe('off')
  })

  it('montre le fichier ouvert, et lui seul', () => {
    poser()
    expect(hote.querySelector('textarea')?.value).toBe('let a = 1')
  })

  it('rapporte ce qu’on tape, en nommant le fichier', () => {
    poser()
    const zone = hote.querySelector('textarea') as HTMLTextAreaElement
    zone.value = 'let a = 2'
    act(() => { zone.dispatchEvent(new Event('input', { bubbles: true })) })
    expect(ecrits).toEqual([['script.js', 'let a = 2']])
  })
})

/**
 * Les accolades sont à trois appuis de profondeur sur un clavier Android,
 * derrière deux pages de symboles.
 *
 * C'est la vraie raison pour laquelle personne ne code sur un téléphone, bien
 * avant la taille de l'écran. Un appui au lieu de trois, sur les seize
 * caractères qu'on va chercher en écrivant du HTML et du JavaScript.
 */
describe('la rangée de symboles', () => {
  it('offre les caractères que le clavier enterre', () => {
    poser()
    const symboles = [...hote.querySelectorAll('.symbole')].map((b) => b.textContent)
    for (const attendu of ['{', '}', '(', ')', '<', '>', ';', '=', '"']) {
      expect(symboles, attendu).toContain(attendu)
    }
  })

  it('insère au curseur, pas à la fin', () => {
    poser()
    const zone = hote.querySelector('textarea') as HTMLTextAreaElement
    zone.selectionStart = 3
    zone.selectionEnd = 3
    const accolade = [...hote.querySelectorAll('.symbole')].find((b) => b.textContent === '{')
    act(() => { (accolade as HTMLButtonElement).click() })
    expect(ecrits).toEqual([['script.js', 'let{ a = 1']])
  })

  it('remplace la sélection plutôt que de s’ajouter à côté', () => {
    poser()
    const zone = hote.querySelector('textarea') as HTMLTextAreaElement
    zone.selectionStart = 0
    zone.selectionEnd = 3
    const chevron = [...hote.querySelectorAll('.symbole')].find((b) => b.textContent === '<')
    act(() => { (chevron as HTMLButtonElement).click() })
    expect(ecrits).toEqual([['script.js', '< a = 1']])
  })
})

describe('ajouter un fichier', () => {
  it('refuse un nom qui n’en est pas un, et dit pourquoi', () => {
    poser()
    act(() => { (hote.querySelector('.onglet.ajout') as HTMLButtonElement).click() })
    const champ = hote.querySelector('.nouveau-fichier input') as HTMLInputElement
    champ.value = 'dossier/page.html'
    act(() => { champ.dispatchEvent(new Event('input', { bubbles: true })) })
    act(() => { (hote.querySelector('.nouveau-fichier button') as HTMLButtonElement).click() })

    expect(ajoutes).toHaveLength(0)
    expect(hote.querySelector('.reproche')?.textContent).toMatch(/dossiers/)
  })

  it('accepte un nom valable', () => {
    poser()
    act(() => { (hote.querySelector('.onglet.ajout') as HTMLButtonElement).click() })
    const champ = hote.querySelector('.nouveau-fichier input') as HTMLInputElement
    champ.value = 'style.css'
    act(() => { champ.dispatchEvent(new Event('input', { bubbles: true })) })
    act(() => { (hote.querySelector('.nouveau-fichier button') as HTMLButtonElement).click() })

    expect(ajoutes).toEqual([{ nom: 'style.css', contenu: '' }])
  })

  it('et cesse de le proposer quand le projet est plein', () => {
    const plein: Projet = {
      ...PROJET,
      fichiers: Array.from({ length: 8 }, (_, i) => ({ nom: `f${i}.js`, contenu: '' })),
    }
    poser(plein, 'f0.js')
    expect(hote.querySelector('.onglet.ajout')).toBe(null)
  })
})

/**
 * La même règle vaut pour le nom d'un fichier.
 *
 * `Index.html` avec une majuscule ne s'exécute pas, et `index.HTML` corrigé en
 * « index. HTML » non plus. Un champ de code est un champ de code, où qu'il
 * soit.
 */
describe('le champ du nouveau fichier', () => {
  it('coupe aussi la correction du clavier', () => {
    poser()
    act(() => { (hote.querySelector('.onglet.ajout') as HTMLButtonElement).click() })
    const champ = hote.querySelector('.nouveau-fichier input')
    expect(champ?.getAttribute('spellcheck')).toBe('false')
    expect(champ?.getAttribute('autocapitalize')).toBe('off')
  })
})

/**
 * Un projet dont on a effacé tous les fichiers.
 *
 * Rare, mais atteignable, et une zone de saisie qui ne saisit rien est pire
 * qu'une phrase qui dit ce qui manque.
 */
describe('un projet sans fichier', () => {
  it('le dit, plutôt que de montrer une zone qui n’écrit nulle part', () => {
    poser({ ...PROJET, fichiers: [] }, '')
    expect(hote.querySelector('textarea')).toBe(null)
    expect(hote.querySelector('.vide')?.textContent).toContain('pas encore de fichier')
  })

  it('et la rangée de symboles n’écrit alors nulle part, sans casser', () => {
    poser({ ...PROJET, fichiers: [] }, '')
    const accolade = [...hote.querySelectorAll('.symbole')].find((b) => b.textContent === '{')
    act(() => { (accolade as HTMLButtonElement).click() })
    expect(ecrits).toHaveLength(0)
  })
})

/**
 * Une ligne longue se replie, au lieu de sortir par la droite.
 *
 * C'est l'inverse de ce que fait un éditeur de bureau, et c'est délibéré : sur
 * trois cent quatre-vingt-dix pixels, `<button id="bouton">Appuie ici</button>`
 * était coupé net au bord droit. Quelqu'un qui apprend ne sait pas encore qu'il
 * faut faire défiler, et conclut que son code s'est effacé.
 */
describe('les lignes longues', () => {
  it('reviennent à la ligne', () => {
    poser()
    expect(hote.querySelector('textarea')?.getAttribute('wrap')).toBe('soft')
  })
})
