// @vitest-environment happy-dom
import 'fake-indexeddb/auto'
import { lecons, modeles, textes } from '@a237/etabli'
import { render as monter } from 'preact'
import { act } from 'preact/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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
  localStorage.removeItem('etabli:lecons')
  /*
   * La langue est fixée, et non héritée du système.
   *
   * Sans ça ces essais dépendent de la locale du moteur — happy-dom annonce
   * `en-US`, et l'application s'ouvrait donc en anglais, ce qui les faisait
   * tous échouer sur des libellés français. Un essai qui change de résultat
   * selon la machine ne garde rien.
   */
  localStorage.setItem('etabli:langue', 'fr')
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
    for (const m of modeles('fr')) expect(hote.textContent).toContain(m.nom)
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

/**
 * Sauvegarder et partager, dans l'écran.
 *
 * C'était le premier écart bloquant face à Replit, et il en refermait deux : le
 * projet survit au téléphone perdu, et « regarde ce que j'ai fait » devient une
 * adresse. L'un ne va pas sans l'autre — c'est le même dépôt.
 */
describe('le partage', () => {
  const vraiFetch = globalThis.fetch
  afterEach(() => { globalThis.fetch = vraiFetch })

  async function ouvrirUnProjet(): Promise<void> {
    await ouvrir()
    cliquer('.modele', 'Page vide')
    cliquer('.lancer')
  }

  it('propose de sauvegarder, et rend un lien qu’on garde', async () => {
    globalThis.fetch = (async () => new Response('{}', { status: 200 })) as typeof fetch
    await ouvrirUnProjet()
    cliquer('.partager')
    await reposer()

    expect(hote.querySelector('.adresse')?.textContent).toMatch(/\?p=[2-9A-Z]{10}$/)
    expect(hote.textContent).toContain('même si tu perds ce téléphone')
  })

  /*
   * Hors ligne est le cas courant ici, pas l'exception. Le dire sans alarmer :
   * le travail n'est pas perdu, il est sur le téléphone.
   */
  it('et quand il n’y a pas de réseau, le dit sans faire peur', async () => {
    globalThis.fetch = (async () => { throw new Error('offline') }) as typeof fetch
    await ouvrirUnProjet()
    cliquer('.partager')
    await reposer()

    expect(hote.querySelector('.alerte')?.textContent).toContain('en sécurité sur ce téléphone')
  })

  it('le lien est gardé avec le projet : la fois d’après met à jour, elle ne repart pas de zéro', async () => {
    globalThis.fetch = (async () => new Response('{}', { status: 200 })) as typeof fetch
    await ouvrirUnProjet()
    cliquer('.partager')
    await reposer()
    const premier = hote.querySelector('.adresse')?.textContent

    cliquer('.retour')
    cliquer('.projet')
    cliquer('.lancer')
    expect(hote.querySelector('.partager')?.textContent).toContain('Mettre à jour')
    expect(hote.querySelector('.adresse')?.textContent).toBe(premier)
  })
})

/**
 * Le bouton de partage sait aussi copier et envoyer.
 *
 * Sur un téléphone, recopier dix caractères à la main est exactement le genre
 * de friction qui fait renoncer. Et WhatsApp est le canal : c'est là que le
 * lien va, pas dans un courriel.
 */
describe('ce qu’on fait du lien une fois obtenu', () => {
  const vraiFetch = globalThis.fetch
  afterEach(() => { globalThis.fetch = vraiFetch })

  it('se copie, et le bouton le confirme', async () => {
    globalThis.fetch = (async () => new Response('{}', { status: 200 })) as typeof fetch
    let copie = ''
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (t: string) => { copie = t; return Promise.resolve() } },
    })

    await ouvrir()
    cliquer('.modele', 'Page vide')
    cliquer('.lancer')
    cliquer('.partager')
    await reposer()
    cliquer('.partage-actions button', 'Copier')
    await reposer()

    expect(copie).toMatch(/\?p=[2-9A-Z]{10}$/)
    expect(hote.querySelector('.partage-actions button')?.textContent).toBe('Copié')
  })

  it('et part sur WhatsApp avec le nom du projet', async () => {
    globalThis.fetch = (async () => new Response('{}', { status: 200 })) as typeof fetch
    await ouvrir()
    cliquer('.modele', 'Page vide')
    cliquer('.lancer')
    cliquer('.partager')
    await reposer()

    const wa = hote.querySelector('a.whatsapp') as HTMLAnchorElement
    expect(wa.href).toContain('wa.me')
    expect(decodeURIComponent(wa.href)).toContain('Page vide')
    expect(wa.getAttribute('rel')).toContain('noopener')
  })
})

/**
 * Le Cameroun a deux langues officielles, et les régions du Nord-Ouest et du
 * Sud-Ouest sont anglophones.
 *
 * Un outil d'apprentissage qui ne parle que français en exclut une partie — et
 * ce n'est pas une partie qu'on choisit d'exclure.
 */
describe('les deux langues', () => {
  it('bascule tout l’écran, pas seulement un libellé', async () => {
    await ouvrir()
    expect(hote.textContent).toContain('Écris du code')
    expect(hote.textContent).toContain('Page vide')

    cliquer('.langue')
    expect(hote.textContent).toContain('Write code')
    expect(hote.textContent).toContain('Blank page')
    expect(hote.textContent).not.toContain('Écris du code')
  })

  /*
   * Le bouton porte le nom de l'autre langue : c'est ce vers quoi il mène.
   */
  it('et le bouton nomme celle vers laquelle il mène', async () => {
    await ouvrir()
    expect(hote.querySelector('.langue')?.textContent).toBe('English')
    cliquer('.langue')
    expect(hote.querySelector('.langue')?.textContent).toBe('Français')
  })

  it('le choix tient d’une visite à l’autre', async () => {
    await ouvrir()
    cliquer('.langue')
    expect(localStorage.getItem('etabli:langue')).toBe('en')

    await ouvrir()
    expect(hote.textContent).toContain('Write code')
  })

  /*
   * Le code du modèle est traduit aussi. Un anglophone devant
   * `const bouton = document.getElementById("bouton")` apprend à recopier sans
   * comprendre — c'est exactement ce qu'on essaie d'éviter.
   */
  it('et le code du modèle est dans la langue, pas seulement son titre', async () => {
    await ouvrir()
    cliquer('.langue')
    cliquer('.modele', 'A button that answers')
    const html = (hote.querySelector('textarea') as HTMLTextAreaElement).value
    expect(html).toContain('Press the button')
    expect(html).not.toContain('Appuie')
  })
})

/**
 * Les leçons, depuis l'écran d'accueil.
 *
 * Deux choses se gardent ici, et elles ont le même sujet : **le travail de la
 * personne**. Rouvrir une leçon déjà commencée ne doit pas la recommencer — ce
 * qu'elle a écrit disparaîtrait sans un mot. Et un stockage abîmé ne doit pas
 * faire tomber l'écran : refaire une leçon est ennuyeux, un écran blanc est
 * définitif.
 */
describe('les leçons', () => {
  it('sont proposées avec leur énoncé, pour qu’on ne choisisse pas au hasard', async () => {
    await ouvrir()
    const premieres = hote.querySelectorAll('.lecon')
    expect(premieres.length).toBe(lecons('fr').length)
    expect(premieres[0]?.textContent).toContain(lecons('fr')[0]?.enonce)
  })

  it('en ouvrir une crée le devoir avec son fichier de départ', async () => {
    await ouvrir()
    cliquer('.lecon')
    expect(hote.querySelector('textarea')?.value).toContain('function total(prix, nombre)')
    const gardes = await lireProjets()
    expect(gardes[0]?.lecon).toBe('total')
  })

  /*
   * Le cas qui protège le travail. Sans le « déjà commencé », chaque retour à
   * l'accueil puis clic sur la leçon repartirait du fichier vide — et ce qui
   * avait été écrit serait perdu sans un mot.
   */
  it('la rouvrir reprend le devoir, elle ne le recommence pas', async () => {
    await ouvrir()
    cliquer('.lecon')
    const zone = hote.querySelector('textarea') as HTMLTextAreaElement
    act(() => {
      zone.value = 'function total(prix, nombre) { return prix * nombre }'
      zone.dispatchEvent(new Event('input', { bubbles: true }))
    })
    cliquer('.retour')
    cliquer('.lecon')

    expect(hote.querySelector('textarea')?.value).toContain('return prix * nombre')
    expect((await lireProjets()).filter((p) => p.lecon === 'total')).toHaveLength(1)
  })

  it('une leçon réussie se retient d’une visite à l’autre', async () => {
    localStorage.setItem('etabli:lecons', JSON.stringify(['total']))
    await ouvrir()
    expect(hote.querySelector('.lecon-faite')?.textContent).toBe(textes('fr').leconFaite)
  })

  it('et un stockage abîmé n’emporte pas l’écran avec lui', async () => {
    for (const abime of ['pas du json', '{"total":true}', '"total"', '[1, 2]']) {
      localStorage.setItem('etabli:lecons', abime)
      await ouvrir()
      expect(hote.querySelectorAll('.lecon').length, abime).toBe(lecons('fr').length)
      expect(hote.querySelector('.lecon-faite'), abime).toBe(null)
    }
  })
})
