// @vitest-environment happy-dom
import 'fake-indexeddb/auto'
import { render as monter } from 'preact'
import { act } from 'preact/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Apercu } from '../src/apercu.js'
import { clear, createStore } from 'idb-keyval'
import { MARQUE, lecons, textes } from '@a237/etabli'
import type { Projet } from '@a237/etabli'

const PROJET: Projet = {
  id: 'p1', nom: 'Ma page', maj: 0,
  fichiers: [{ nom: 'index.html', contenu: '<h1>Salut</h1>' }],
}

let hote: HTMLDivElement

function poser(tour = 0): void {
  act(() => { monter(<Apercu projet={PROJET} tour={tour} langue="fr" t={textes('fr')}
      lecon={undefined} onReussie={() => {}} />, hote) })
}

/*
 * Le moteur Python est vidé entre les essais.
 *
 * Sans ça, les fichiers descendus par un essai restent en base pour le
 * suivant : celui qui vérifie la coupure n'avait plus rien à télécharger, donc
 * plus rien à couper. Il passait, sans rien garder.
 */
const MOTEUR_PY = createStore('etabli-python', 'moteur')

beforeEach(async () => {
  hote = document.createElement('div')
  document.body.appendChild(hote)
  await clear(MOTEUR_PY)
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
    act(() => { monter(
      <Apercu projet={PROJET} tour={0} langue={langue} t={textes(langue)}
        lecon={undefined} onReussie={() => {}} />,
      hote,
    ) })
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

/**
 * Python, et le prix affiché avant qu'on appuie.
 *
 * C'est la règle du produit : personne ne dépense cinq mégaoctets de forfait
 * sans l'avoir su et voulu. Ces essais gardent l'ordre des choses — le chiffre,
 * puis le bouton, jamais l'inverse.
 */
const PYTHON: Projet = {
  id: 'p2', nom: 'Mon calcul', maj: 0,
  fichiers: [{ nom: 'main.py', contenu: 'print(2 + 2)' }],
}

function poserPython(langue: 'fr' | 'en' = 'fr'): void {
  act(() => {
    monter(
      <Apercu projet={PYTHON} tour={0} langue={langue} t={textes(langue)}
        lecon={undefined} onReussie={() => {}} />,
      hote,
    )
  })
}

/** Le temps que les promesses du crochet se dénouent. */
async function laisserRespirer(): Promise<void> {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() })
}

/**
 * Attendre qu'une condition tienne, pas un nombre de tours.
 *
 * IndexedDB rend la main par macro-tâches, pas par micro-tâches : compter les
 * `Promise.resolve()` marchait pour le manifeste et pas pour le stockage. Un
 * essai qui dépend d'un nombre de tours passe sur cette machine-ci et tombe sur
 * une machine plus lente, ce qui est la pire sorte d'essai.
 */
async function attendre(tient: () => boolean, quoi: string): Promise<void> {
  for (let i = 0; i < 200; i += 1) {
    if (tient()) return
    await act(async () => { await new Promise((r) => { setTimeout(r, 1) }) })
  }
  throw new Error(`toujours pas : ${quoi}`)
}

const MANIFESTE = {
  version: '0.28.3',
  fichiers: [{
    nom: 'pyodide.js', forme: 'texte', octets: 12_262_929, surLeFil: 5_304_678,
    empreinte: 'a'.repeat(64),
  }],
  octets: 12_262_929,
  surLeFil: 5_304_678,
}

describe('un projet Python', () => {
  it('n’exécute rien tant que le moteur n’est pas là', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(JSON.stringify(MANIFESTE))))
    poserPython()
    await laisserRespirer()
    expect(hote.querySelector('iframe')).toBe(null)
    vi.unstubAllGlobals()
  })

  /*
   * Le chiffre est dans le libellé du bouton, pas seulement au-dessus. On ne
   * peut donc pas appuyer sans l'avoir eu sous les yeux — c'est la seule
   * garantie qui tienne quand quelqu'un appuie vite.
   */
  it('annonce le prix, dans le bouton même', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(JSON.stringify(MANIFESTE))))
    poserPython()
    await laisserRespirer()
    const bouton = hote.querySelector('.python-oui')
    expect(bouton?.textContent).toContain('5,1 Mo')
    vi.unstubAllGlobals()
  })

  it('et l’annonce en anglais avec le point décimal', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(JSON.stringify(MANIFESTE))))
    poserPython('en')
    await laisserRespirer()
    expect(hote.querySelector('.python-oui')?.textContent).toContain('5.1 MB')
    vi.unstubAllGlobals()
  })

  /*
   * Sans manifeste, cette installation n'a pas Python. Le dire vaut mieux qu'un
   * bouton qui échoue — et il ne faut pas le dire pendant qu'on cherche encore.
   */
  it('le dit quand cette installation n’a pas Python du tout', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('', { status: 404 })))
    poserPython()
    await laisserRespirer()
    expect(hote.textContent).toContain('n’est pas installé')
    expect(hote.querySelector('.python-oui')).toBe(null)
    vi.unstubAllGlobals()
  })

  it('ne propose rien du tout pour un projet qui n’est pas Python', () => {
    poser()
    expect(hote.querySelector('.python')).toBe(null)
    expect(hote.querySelector('iframe')).not.toBe(null)
  })
})

/**
 * Le parcours entier : le prix, l'appui, l'aiguille, puis Python qui tourne.
 *
 * Les essais précédents gardent l'ordre des écrans ; celui-ci garde le chemin
 * complet, y compris la panne au milieu. C'est là que vivent les fautes qui
 * coûtent de l'argent — un moteur qu'on redescend, un fichier tronqué qu'on
 * garde — et aucune ne se voit sur un écran fixe.
 */
const CORPS_PY: Readonly<Record<string, string>> = {
  'pyodide.js': 'la façade',
  'pyodide.asm.js': 'le moteur',
  'pyodide-lock.json': '{}',
  'pyodide.asm.wasm': 'du wasm',
  'python_stdlib.zip': 'la bibliothèque',
}

async function manifesteVrai(): Promise<unknown> {
  const fichiers = await Promise.all(Object.entries(CORPS_PY).map(async ([nom, corps]) => {
    const brut = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(corps))
    return {
      nom,
      forme: nom.endsWith('.wasm') || nom.endsWith('.zip') ? 'octets' : 'texte',
      octets: new TextEncoder().encode(corps).byteLength,
      surLeFil: 1_000_000,
      empreinte: [...new Uint8Array(brut)].map((o) => o.toString(16).padStart(2, '0')).join(''),
    }
  }))
  return {
    version: '0.28.3',
    fichiers,
    octets: fichiers.reduce((t, f) => t + f.octets, 0),
    surLeFil: fichiers.reduce((t, f) => t + f.surLeFil, 0),
  }
}

function serveurPy(manifeste: unknown, casse: readonly string[] = []): () => Promise<Response> {
  return ((url: string) => {
    const nom = String(url).replace('pyodide/', '')
    if (nom === 'manifeste.json') return Promise.resolve(new Response(JSON.stringify(manifeste)))
    if (casse.includes(nom)) return Promise.resolve(new Response('', { status: 500 }))
    return Promise.resolve(new Response(CORPS_PY[nom] ?? ''))
  }) as unknown as () => Promise<Response>
}

describe('descendre Python depuis l’écran', () => {
  it('l’appui fait descendre le moteur, puis le cadre exécute le Python', async () => {
    vi.stubGlobal('fetch', serveurPy(await manifesteVrai()))
    poserPython()
    await laisserRespirer()

    const bouton = hote.querySelector('.python-oui') as HTMLButtonElement
    expect(bouton).not.toBe(null)
    act(() => { bouton.click() })
    await attendre(() => hote.querySelector('iframe') !== null, 'le cadre Python')

    const cadre = hote.querySelector('iframe')
    expect(cadre?.getAttribute('sandbox')).toBe('allow-scripts')
    expect(cadre?.getAttribute('srcdoc')).toContain('print(2 + 2)')
    // Et le document Python, pas celui des pages.
    expect(cadre?.getAttribute('srcdoc')).toContain('a237-py')
    vi.unstubAllGlobals()
  })

  it('une coupure au milieu propose de reprendre, sans perdre ce qui est arrivé', async () => {
    vi.stubGlobal('fetch', serveurPy(await manifesteVrai(), ['python_stdlib.zip']))
    poserPython()
    await laisserRespirer()
    act(() => { (hote.querySelector('.python-oui') as HTMLButtonElement).click() })
    await attendre(() => hote.querySelector('.python-echoue') !== null, 'le reproche')

    expect(hote.querySelector('.python-echoue')).not.toBe(null)
    expect(hote.querySelector('.python-oui')?.textContent).toBe(textes('fr').pythonReessayer)
    expect(hote.querySelector('iframe')).toBe(null)
    vi.unstubAllGlobals()
  })
})

/**
 * Une leçon corrigée à l'écran.
 *
 * Ce qui se garde ici n'est pas l'affichage : c'est que **la correction ne
 * traverse pas la console**, et qu'un verdict n'apparaît pas avant que toutes
 * les réponses soient là. Annoncer « raté » à quelqu'un dont le programme
 * n'avait pas fini de tourner est la façon la plus sûre de le faire abandonner.
 */
const LECON = lecons('fr')[0]!

const DEVOIR: Projet = {
  id: 'p3', nom: LECON.titre, maj: 0, lecon: LECON.id,
  fichiers: LECON.fichiers.map((f) => ({ ...f })),
}

function poserLecon(): { reussies: string[] } {
  const reussies: string[] = []
  act(() => {
    monter(
      <Apercu projet={DEVOIR} tour={0} langue="fr" t={textes('fr')}
        lecon={LECON} onReussie={(id) => reussies.push(id)} />,
      hote,
    )
  })
  return { reussies }
}

/** Fait comme si le cadre avait parlé. */
function duCadre(texte: string, sorte: 'journal' | 'erreur' = 'journal'): void {
  const cadre = hote.querySelector('iframe') as HTMLIFrameElement
  act(() => {
    dispatchEvent(Object.assign(
      new MessageEvent('message', { data: { a237: 'etabli', sorte, texte } }),
      { source: cadre.contentWindow },
    ))
  })
}

describe('une leçon corrigée', () => {
  it('ajoute la correction au code exécuté, sans toucher au projet', () => {
    poserLecon()
    const srcdoc = hote.querySelector('iframe')?.getAttribute('srcdoc') ?? ''
    expect(srcdoc).toContain('total(5800, 3)')
    // Et le projet lui-même n'a pas gagné de fichier : il ne partirait pas
    // dans l'export, et n'apparaîtrait pas dans les onglets.
    expect(DEVOIR.fichiers.map((f) => f.nom)).not.toContain('correction.js')
  })

  it('ne dit rien tant que toutes les réponses ne sont pas arrivées', () => {
    poserLecon()
    expect(hote.querySelector('.copie')).toBe(null)
    duCadre(`${MARQUE}0=17400`)
    expect(hote.querySelector('.copie')).toBe(null)
  })

  it('dit que c’est réussi quand les trois tombent juste', () => {
    const { reussies } = poserLecon()
    duCadre(`${MARQUE}0=17400`)
    duCadre(`${MARQUE}1=7000`)
    duCadre(`${MARQUE}2=0`)
    expect(hote.querySelector('.copie.reussie')).not.toBe(null)
    expect(reussies).toEqual([LECON.id])
  })

  /*
   * Le cas qui compte pour l'honnêteté de l'exercice : afficher le bon nombre
   * n'écrit aucune fonction, donc les appels échouent et la leçon reste à
   * faire.
   */
  it('et pas réussi quand la personne a seulement affiché la réponse', () => {
    const { reussies } = poserLecon()
    duCadre('17400')
    duCadre(`${MARQUE}0=!total is not defined`)
    duCadre(`${MARQUE}1=!total is not defined`)
    duCadre(`${MARQUE}2=!total is not defined`)
    expect(hote.querySelector('.copie.reussie')).toBe(null)
    expect(hote.querySelector('.copie-indice')?.textContent).toBe(LECON.indice)
    expect(reussies).toEqual([])
  })

  /*
   * La correction écrit une ligne par épreuve. Les laisser passer noierait la
   * sortie de la personne sous la nôtre — et c'est la sienne qu'elle regarde.
   */
  it('ne montre pas la correction dans la console, mais montre le reste', () => {
    poserLecon()
    duCadre('Bonjour Douala')
    duCadre(`${MARQUE}0=17400`)
    act(() => { (hote.querySelector('.console-titre') as HTMLButtonElement).click() })
    const lignes = Array.from(hote.querySelectorAll('.console-ligne')).map((l) => l.textContent)
    expect(lignes).toHaveLength(1)
    expect(lignes[0]).toContain('Bonjour Douala')
  })

  it('un projet ordinaire n’a ni correction ni copie', () => {
    poser()
    expect(hote.querySelector('iframe')?.getAttribute('srcdoc')).not.toContain('«a237»')
    expect(hote.querySelector('.copie')).toBe(null)
  })
})
