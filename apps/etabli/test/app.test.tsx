// @vitest-environment happy-dom
import 'fake-indexeddb/auto'
import { MODELES } from '@a237/etabli'
import { render as monter } from 'preact'
import { act } from 'preact/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { clear, createStore } from 'idb-keyval'
import { App } from '../src/app.js'
import { lireProjets } from '../src/stockage.js'

const PROJETS = createStore('etabli-projets', 'projets')

let hote: HTMLDivElement

/**
 * Laisse le stockage répondre.
 *
 * IndexedDB ne se résout pas en un tour de boucle : une requête traverse
 * plusieurs tâches. Attendre une micro-tâche laissait l'écran sur « Un
 * instant… », et les essais mesuraient un chargement plutôt qu'une application.
 */
async function reposer(): Promise<void> {
  await act(async () => {
    await new Promise((suite) => setTimeout(suite, 0))
  })
}

async function ouvrir(): Promise<void> {
  hote = document.createElement('div')
  document.body.appendChild(hote)
  act(() => { monter(<App />, hote) })
  for (let i = 0; i < 20 && hote.querySelector('.chargement') !== null; i += 1) await reposer()
}

function cliquer(selecteur: string, texte?: string): void {
  const cibles = [...hote.querySelectorAll(selecteur)]
  const cible = texte === undefined ? cibles[0] : cibles.find((c) => c.textContent?.includes(texte))
  act(() => { (cible as HTMLButtonElement).click() })
}

beforeEach(async () => {
  await clear(PROJETS)
})

/**
 * L'Établi s'ouvre sur ce qu'on peut faire, pas sur un éditeur vide.
 *
 * Un curseur qui clignote dans le noir n'apprend rien à personne. Trois modèles
 * qui font quelque chose de visible dès qu'on appuie sur « Lancer », si.
 */
describe('l’écran d’accueil', () => {
  it('propose les modèles', async () => {
    await ouvrir()
    for (const m of MODELES) expect(hote.textContent).toContain(m.nom)
  })

  it('ne montre pas de liste de projets quand il n’y en a pas', async () => {
    await ouvrir()
    expect(hote.textContent).not.toContain('Tes projets')
  })

  it('ouvre un projet neuf à partir d’un modèle, et le range tout de suite', async () => {
    await ouvrir()
    cliquer('.modele', 'Un bouton qui répond')

    // On est dans l'éditeur, sur le premier fichier du modèle.
    expect(hote.querySelector('textarea')).not.toBe(null)
    expect(hote.textContent).toContain('index.html')

    /*
     * Rangé avant qu'on ait rien tapé : une coupure de courant entre la
     * création et la première frappe ne doit pas effacer le projet. Ici, elles
     * arrivent.
     */
    await reposer()
    expect(await lireProjets()).toHaveLength(1)
  })
})

describe('un projet ouvert', () => {
  async function creer(): Promise<void> {
    await ouvrir()
    cliquer('.modele', 'Page vide')
  }

  it('bascule entre écrire et voir : 360 pixels ne se partagent pas', async () => {
    await creer()
    expect(hote.querySelector('textarea')).not.toBe(null)
    expect(hote.querySelector('iframe')).toBe(null)

    cliquer('.lancer')
    expect(hote.querySelector('iframe')).not.toBe(null)
    expect(hote.querySelector('textarea')).toBe(null)

    cliquer('.lancer')
    expect(hote.querySelector('textarea')).not.toBe(null)
  })

  it('garde ce qu’on écrit, et le rend au retour', async () => {
    await creer()
    const zone = hote.querySelector('textarea') as HTMLTextAreaElement
    zone.value = '<h1>Mon quartier</h1>'
    act(() => { zone.dispatchEvent(new Event('input', { bubbles: true })) })

    cliquer('.retour')
    expect(hote.textContent).toContain('Tes projets')
    cliquer('.projet')
    expect((hote.querySelector('textarea') as HTMLTextAreaElement).value)
      .toBe('<h1>Mon quartier</h1>')
  })

  it('et l’écrit sur le téléphone, pas seulement à l’écran', async () => {
    await creer()
    const zone = hote.querySelector('textarea') as HTMLTextAreaElement
    zone.value = '<p>rangé</p>'
    act(() => { zone.dispatchEvent(new Event('input', { bubbles: true })) })
    await reposer()

    const [range] = await lireProjets()
    expect(range?.fichiers.find((f) => f.nom === 'index.html')?.contenu).toBe('<p>rangé</p>')
  })

  it('exécute ce qu’on vient d’écrire, pas ce qui était là au départ', async () => {
    await creer()
    const zone = hote.querySelector('textarea') as HTMLTextAreaElement
    zone.value = '<h1>Nouveau</h1>'
    act(() => { zone.dispatchEvent(new Event('input', { bubbles: true })) })
    cliquer('.lancer')
    expect(hote.querySelector('iframe')?.getAttribute('srcdoc')).toContain('<h1>Nouveau</h1>')
  })
})

describe('la liste des projets', () => {
  it('efface un projet, sur l’écran et sur le téléphone', async () => {
    await ouvrir()
    cliquer('.modele', 'Page vide')
    await reposer()
    cliquer('.retour')

    expect(hote.querySelectorAll('.projet')).toHaveLength(1)
    cliquer('.effacer')
    await reposer()

    expect(hote.querySelectorAll('.projet')).toHaveLength(0)
    expect(await lireProjets()).toHaveLength(0)
  })
})

/**
 * Partager son travail, sans compte et sans réseau.
 *
 * Le fichier descend sur le téléphone ; de là, WhatsApp l'envoie comme
 * n'importe quelle pièce jointe. Celui qui le reçoit l'ouvre dans son
 * navigateur et voit exactement ce que l'auteur voyait dans l'aperçu.
 */
describe('exporter', () => {
  it('propose un fichier nommé d’après le projet, et qui contient le projet', async () => {
    const urls: string[] = []
    let telecharge: string | null = null

    // On intercepte la plomberie du navigateur, pas la décision : celle-ci est
    // pure et éprouvée dans le paquet.
    const blobs = new Map<string, Blob>()
    URL.createObjectURL = (blob: Blob): string => {
      const url = `blob:${blobs.size}`
      blobs.set(url, blob)
      urls.push(url)
      return url
    }
    URL.revokeObjectURL = (): void => undefined
    const vraiClick = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function remplace(this: HTMLAnchorElement): void {
      telecharge = this.download
    }

    await ouvrir()
    cliquer('.modele', 'Un bouton qui répond')
    cliquer('.lancer')
    cliquer('.actions button', 'Exporter')

    HTMLAnchorElement.prototype.click = vraiClick

    expect(telecharge).toBe('un-bouton-qui-repond.html')
    expect(await blobs.get(urls[0] ?? '')?.text()).toContain('addEventListener("click"')
  })
})

describe('les cas où l’on se rattrape', () => {
  it('relancer redessine l’aperçu sans repasser par l’éditeur', async () => {
    await ouvrir()
    cliquer('.modele', 'Page vide')
    cliquer('.lancer')
    const avant = hote.querySelector('iframe')
    cliquer('.actions button', 'Relancer')
    // Le cadre est reconstruit : c'est ce qui vide la console et repart de zéro.
    expect(hote.querySelector('iframe')).not.toBe(null)
    expect(hote.querySelector('iframe')).not.toBe(avant)
  })

  it('annuler l’ajout d’un fichier ne laisse ni champ ni reproche', async () => {
    await ouvrir()
    cliquer('.modele', 'Page vide')
    cliquer('.onglet.ajout')
    expect(hote.querySelector('.nouveau-fichier')).not.toBe(null)
    cliquer('.nouveau-fichier .discret')
    expect(hote.querySelector('.nouveau-fichier')).toBe(null)
  })

  it('ajouter un fichier l’ouvre tout de suite : sinon on écrit dans le précédent', async () => {
    await ouvrir()
    cliquer('.modele', 'Page vide')
    cliquer('.onglet.ajout')
    const champ = hote.querySelector('.nouveau-fichier input') as HTMLInputElement
    champ.value = 'autre.js'
    act(() => { champ.dispatchEvent(new Event('input', { bubbles: true })) })
    cliquer('.nouveau-fichier button', 'Ajouter')

    const actif = hote.querySelector('.onglet.actif')
    expect(actif?.textContent).toBe('autre.js')
    expect((hote.querySelector('textarea') as HTMLTextAreaElement).value).toBe('')
  })
})
