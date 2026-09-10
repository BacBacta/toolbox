// @vitest-environment happy-dom
import 'fake-indexeddb/auto'
import { render as monter } from 'preact'
import { act } from 'preact/test-utils'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { EcranAgent } from '../src/ecran-agent.js'

/**
 * L'agent, et surtout la fenêtre.
 *
 * Ce qui est éprouvé ici est ce que la conversation apporte et que le bouton
 * n'avait pas : **on voit ce qui est en train d'être fabriqué**, on peut dire
 * « non, plutôt comme ça », et le deuxième tour ne repaie pas un crédit.
 *
 * Le flux est un vrai flux : les morceaux sont coupés à des endroits
 * quelconques, comme le réseau les coupe. Un aperçu qui ne tiendrait qu'avec
 * des morceaux bien découpés ne tiendrait pas une minute en production.
 */

const REGISTRE = {
  titre: 'Suivi des livraisons',
  kicker: 'SUIVI DES LIVRAISONS',
  titreNom: 'Nom du dépôt',
  colonnes: [
    { clef: 'client', titre: 'Client', type: 'texte' },
    { clef: 'montant', titre: 'Montant', type: 'montant' },
  ],
  libelleVide: 'Aucune livraison.',
  libelleAjout: 'Ajouter',
  relancesVides: 'Un suivi ne se relance pas.',
}

let hote: HTMLDivElement
let creations: { skeleton: string; compose: unknown; fcfa: number | undefined }[]
let ferme: number

beforeAll(async () => {
  const { jetonDeCetAppareil } = await import('../src/appareil.js')
  await jetonDeCetAppareil()
})

beforeEach(() => {
  hote = document.createElement('div')
  document.body.appendChild(hote)
  creations = []
  ferme = 0
})

afterEach(() => {
  monter(null, hote)
  hote.remove()
  vi.unstubAllGlobals()
})

/** Un flux d'événements, coupé n'importe où — comme le réseau le fait. */
function flux(evenements: readonly unknown[], taille = 11): ReadableStream<Uint8Array> {
  const texte = evenements.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('')
  const octets = new TextEncoder().encode(texte)
  let i = 0
  return new ReadableStream({
    pull(file) {
      if (i >= octets.length) {
        file.close()
        return
      }
      file.enqueue(octets.slice(i, i + taille))
      i += taille
    },
  })
}

/**
 * Un flux **neuf à chaque appel**.
 *
 * Rendre deux fois le même `ReadableStream` le fait lire verrouillé au
 * deuxième tour — ce qui n'arrive jamais en production, où chaque requête a sa
 * réponse, mais fabrique ici un échec qui ne dit rien du produit.
 */
function repond(evenements: readonly unknown[], statut = 200): ReturnType<typeof vi.fn> {
  const appel = vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: statut >= 200 && statut < 300,
      status: statut,
      body: flux(evenements),
      json: () => Promise.resolve({}),
    }),
  )
  vi.stubGlobal('fetch', appel)
  return appel
}

function poser(demande = 'un suivi de mes livraisons de gaz'): void {
  act(() => {
    monter(
      <EcranAgent
        demande={demande}
        onCreer={(skeleton, _e, compose, fcfa) => creations.push({ skeleton, compose, fcfa })}
        onFermer={() => {
          ferme++
        }}
      />,
      hote,
    )
  })
}

const jusqua = async (dit: () => boolean): Promise<void> => {
  for (let i = 0; i < 200 && !dit(); i++) {
    await act(() => new Promise((r) => setTimeout(r, 1)))
  }
}

const texte = (): string => hote.textContent ?? ''

const FIN_REGISTRE = {
  sorte: 'fin',
  tour: { sorte: 'outil', mot: 'Voilà ton suivi.', outil: { sorte: 'registre', registre: REGISTRE } },
  fcfa: 0.31,
  conversation: 'compte-1.1.9e15.sig',
  plan: 'essai',
  credits: 4,
}

describe('la fenêtre où l’on voit ce qui se fabrique', () => {
  it('dit ce qu’elle attend, plutôt que de rester blanche', () => {
    // Un rectangle vide pendant huit secondes se lit comme une panne, et sur
    // une connexion qui hoquette huit secondes deviennent trente.
    repond([])
    poser()
    expect(texte()).toContain('Je regarde ce que tu demandes')
  })

  it('montre le titre puis les colonnes, une à une', async () => {
    repond([
      { sorte: 'ebauche', ebauche: { mot: 'Je te fais', famille: null, titre: '', pieces: [] } },
      { sorte: 'ebauche', ebauche: { mot: 'Je te fais un suivi.', famille: 'registre', titre: 'Suivi des livr', pieces: [] } },
      { sorte: 'ebauche', ebauche: { mot: 'Je te fais un suivi.', famille: 'registre', titre: 'Suivi des livraisons', pieces: ['Client'] } },
      { sorte: 'ebauche', ebauche: { mot: 'Je te fais un suivi.', famille: 'registre', titre: 'Suivi des livraisons', pieces: ['Client', 'Montant'] } },
      FIN_REGISTRE,
    ])
    poser()
    await jusqua(() => texte().includes('Montant'))
    expect(texte()).toContain('un registre')
    expect(texte()).toContain('Suivi des livraisons')
    expect([...hote.querySelectorAll('.fenetre-pieces li')].map((l) => l.textContent))
      .toEqual(['Client', 'Montant'])
  })

  it('écrit le mot dans la conversation pendant que l’outil se construit', async () => {
    repond([
      { sorte: 'ebauche', ebauche: { mot: 'Je te fais un suivi', famille: null, titre: '', pieces: [] } },
      FIN_REGISTRE,
    ])
    poser()
    await jusqua(() => texte().includes('Je te fais un suivi'))
    expect(hote.querySelector('.dit-agent')?.textContent).toContain('Je te fais un suivi')
  })

  it('reprend la phrase tapée dans l’atelier, sans la faire retaper', async () => {
    repond([FIN_REGISTRE])
    poser('un suivi de mes livraisons de gaz')
    expect(hote.querySelector('.dit-personne')?.textContent).toBe('un suivi de mes livraisons de gaz')
  })
})

describe('quand l’outil est prêt', () => {
  it('la fenêtre montre ce qui vient d’être fabriqué, au lieu de se vider', async () => {
    /*
     * Le défaut trouvé en regardant l'écran : l'ébauche est effacée quand le
     * flux se termine, et il n'y avait plus rien derrière. On voyait l'outil
     * s'écrire, puis disparaître au moment de le regarder — c'est-à-dire au
     * seul moment où on le regarde vraiment.
     */
    repond([FIN_REGISTRE])
    poser()
    await jusqua(() => texte().includes('Ouvrir cet outil'))
    expect(hote.querySelector('.fenetre-titre')?.textContent).toBe('Suivi des livraisons')
    expect([...hote.querySelectorAll('.fenetre-pieces li')].map((l) => l.textContent))
      .toEqual(['Client', 'Montant'])
  })

  it('propose de l’ouvrir, et le crée avec ce qu’il a coûté', async () => {
    repond([FIN_REGISTRE])
    poser()
    await jusqua(() => texte().includes('Ouvrir cet outil'))
    const bouton = [...hote.querySelectorAll('button')].find((b) => b.textContent === 'Ouvrir cet outil')
    act(() => bouton?.click())
    expect(creations[0]?.skeleton).toBe('compose')
    expect(creations[0]?.compose).toMatchObject({ registre: { titre: 'Suivi des livraisons' } })
    expect(creations[0]?.fcfa).toBeCloseTo(0.31)
  })

  it('montre ce que la conversation a coûté, centimes compris', async () => {
    // « 0 F » sous une dépense de trente et un centimes est le début d'une
    // facture qu'on découvre à la fin du mois.
    repond([FIN_REGISTRE])
    poser()
    await jusqua(() => texte().includes('Ouvrir cet outil'))
    expect(texte()).toContain('0,31')
  })
})

describe('le deuxième tour', () => {
  it('renvoie l’outil et le laissez-passer : il ne repaie pas un crédit', async () => {
    const appel = repond([FIN_REGISTRE])
    poser()
    await jusqua(() => texte().includes('Ouvrir cet outil'))

    // On demande une modification.
    const champ = hote.querySelector<HTMLInputElement>('.agent-saisie input')
    if (champ === null) throw new Error('champ introuvable')
    act(() => {
      champ.value = 'ajoute une colonne pour la date'
      champ.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const envoyer = [...hote.querySelectorAll('button')].find((b) => b.textContent === 'Envoyer')
    act(() => envoyer?.click())
    await jusqua(() => appel.mock.calls.length > 1)

    const corps = JSON.parse((appel.mock.calls[1]?.[1] as { body: string }).body) as {
      messages: { qui: string; texte: string }[]
      outil: { titre: string }
      conversation: string
    }
    expect(corps.conversation).toBe('compte-1.1.9e15.sig')
    expect(corps.outil.titre).toBe('Suivi des livraisons')
    expect(corps.messages.at(-1)).toEqual({
      qui: 'personne', texte: 'ajoute une colonne pour la date',
    })
    // Le mot de l'agent est dans le fil, mais pas la configuration : elle
    // voyage à part, et une seule fois.
    expect(corps.messages.filter((m) => m.qui === 'agent')).toHaveLength(1)
  })
})

describe('la fenêtre montre la chose elle-même quand elle se dessine seule', () => {
  const PAGE = {
    titre: 'Quincaillerie Bépanda', kicker: 'QUINCAILLERIE',
    accroche: 'Tôles, ciment et outillage.',
    sections: [{ titre: 'Nos prix', sorte: 'prix', lignes: [{ nom: 'Ciment', valeur: '5 800 F' }] }],
  }

  it('une page se rend telle qu’un client la verra', async () => {
    // Une page se dessine à partir de sa seule configuration : montrer le plan
    // là où on peut montrer la chose serait montrer moins.
    repond([{
      sorte: 'fin',
      tour: { sorte: 'outil', mot: 'Voilà ta page.', outil: { sorte: 'page', page: PAGE } },
      fcfa: 0.38, conversation: 'c.1.9e15.s', plan: 'essai', credits: 4,
    }])
    poser('je veux un site pour ma quincaillerie')
    await jusqua(() => texte().includes('Ouvrir cet outil'))
    expect(hote.querySelector('.fenetre-vue .vitrine')).not.toBeNull()
    expect(texte()).toContain('5 800 F')
  })

  it('un formulaire aussi, mais inerte : il ne poste nulle part', async () => {
    /*
     * Un aperçu qui envoie vraiment ajouterait la réponse de celui qui
     * fabrique le formulaire à celles qu'il attend.
     */
    const FORM = {
      titre: 'Commandes', kicker: 'TRAITEUR', accroche: 'Avant vendredi.',
      champs: [{ clef: 'nom', titre: 'Ton nom', sorte: 'texte' }],
      bouton: 'Envoyer', merci: 'C’est noté.',
    }
    repond([{
      sorte: 'fin',
      tour: { sorte: 'outil', mot: 'Voilà.', outil: { sorte: 'formulaire', formulaire: FORM } },
      fcfa: 0.3, conversation: 'c.1.9e15.s', plan: 'essai', credits: 4,
    }])
    poser('ramasser mes commandes')
    await jusqua(() => texte().includes('Ouvrir cet outil'))
    expect(hote.querySelector('.fenetre-vue form')?.getAttribute('action')).toBe('')
    expect(hote.querySelector<HTMLInputElement>('.fenetre-vue .form-champ input')?.disabled).toBe(true)
  })

  it('un registre garde son plan : ses colonnes sont son essence', async () => {
    // Un registre est un écran qu'on remplit ; sans lignes il n'y a rien à
    // montrer de plus que ce que le plan dit déjà.
    repond([FIN_REGISTRE])
    poser()
    await jusqua(() => texte().includes('Ouvrir cet outil'))
    expect(hote.querySelector('.fenetre-vue')).toBeNull()
    expect(hote.querySelectorAll('.fenetre-pieces li')).toHaveLength(2)
  })
})

describe('un tour qui refuse', () => {
  it('le dit dans la fenêtre au lieu d’y dessiner un outil', async () => {
    repond([{
      sorte: 'fin',
      tour: { sorte: 'outil', mot: 'Un logo se dessine.', outil: { sorte: 'refus', pourquoi: 'Un logo se dessine.' } },
      fcfa: 0.12, conversation: 'c.1.9e15.s', plan: 'essai', credits: 4,
    }])
    poser('fais-moi un logo')
    await jusqua(() => texte().includes('pas un outil que je sais'))
    expect(texte()).not.toContain('Ouvrir cet outil')
  })
})

describe('un tour qui ne fabrique rien', () => {
  it('montre la question, et ne propose rien à ouvrir', async () => {
    // Personne ne décrit du premier coup l'outil qu'il veut, et une question
    // coûte le même tour qu'un outil inventé.
    repond([
      { sorte: 'fin', tour: { sorte: 'mot', mot: 'Tu suis quoi exactement ?' },
        fcfa: 0.2, conversation: 'c.1.9e15.s', plan: 'essai', credits: 4 },
    ])
    poser()
    await jusqua(() => texte().includes('Tu suis quoi'))
    expect(texte()).not.toContain('Ouvrir cet outil')
  })
})

describe('quand ça casse', () => {
  it('dit la panne au lieu de figer l’écran sur une phrase à moitié', async () => {
    repond([{ sorte: 'panne', pourquoi: 'le modèle n’a pas répondu' }])
    poser()
    await jusqua(() => texte().includes('pas pu continuer'))
    expect(hote.querySelector('.dit-panne')).not.toBeNull()
  })

  it('dit de recharger quand le crédit est épuisé, sans parler de panne', async () => {
    repond([], 402)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 402,
      json: () => Promise.resolve({ erreur: 'credits-epuises', pourquoi: 'plus de crédit' }),
    }))
    poser()
    await jusqua(() => texte().includes('plus de crédit'))
    expect(texte()).toContain('continuent de marcher')
  })

  it('dit que ce n’est pas ouvert, sans faire croire à une panne', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 503, json: () => Promise.resolve({}),
    }))
    poser()
    await jusqua(() => texte().includes('pas encore ouvert'))
    expect(texte()).toContain('l’outil le plus proche')
  })

  it('dit qu’une réponse s’est coupée en route', async () => {
    /*
     * Le cas courant ici, pas l'exception : une connexion mobile qui lâche
     * pendant que l'agent écrit coupe la réponse au milieu. Sans ce mot,
     * l'écran revenait au repos avec une phrase à moitié écrite et rien pour
     * dire pourquoi — et le tour, lui, a bien été payé.
     */
    repond([
      { sorte: 'ebauche', ebauche: { mot: 'Je te fais un su', famille: null, titre: '', pieces: [] } },
    ])
    poser()
    await jusqua(() => texte().includes('coupée en route'))
    expect(hote.querySelector('.dit-panne')).not.toBeNull()
  })

  it('rapporte le refus d’abonnement, qui n’est pas un crédit épuisé', async () => {
    // Ce ne sont pas les mêmes suites : l'un recharge, l'autre s'abonne.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 402,
      json: () => Promise.resolve({ erreur: 'abonnement-requis', pourquoi: '' }),
    }))
    poser()
    await jusqua(() => texte().includes('plusieurs outils'))
    expect(texte()).toContain('plusieurs outils')
  })

  it('dit qu’il n’y a pas de réseau', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    poser()
    await jusqua(() => texte().includes('pas de réseau'))
    expect(texte()).toContain('pas de réseau')
  })
})

describe('quitter', () => {
  it('referme sans rien créer', () => {
    repond([])
    poser()
    const retour = [...hote.querySelectorAll('button')].find((b) => b.textContent?.includes('Mes outils'))
    act(() => retour?.click())
    expect(ferme).toBe(1)
    expect(creations).toHaveLength(0)
  })
})
