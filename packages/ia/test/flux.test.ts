import type { Seance } from '@a237/comptes'
import { describe, expect, it } from 'vitest'
import type { Accord } from '../src/conversation.js'
import { jouerLeTour } from '../src/flux.js'
import type { EvenementAgent } from '../src/flux.js'
import { ErreurFournisseur } from '../src/fournisseur.js'
import type { Fournisseur, MorceauModele, ReponseModele } from '../src/fournisseur.js'

/**
 * Un tour d'agent, du premier morceau au dernier événement.
 *
 * Aucun réseau : un faux fournisseur rend les morceaux qu'on lui donne, coupés
 * là où on veut. C'est le point — un flux réel coupe au milieu d'un mot et
 * parfois au milieu d'un caractère accentué, et il n'y a aucune raison qu'il
 * coupe à un endroit commode.
 */

const SECRET = 'un-secret'
const LE_9_SEPT = new Date('2026-09-09T07:45:00.000Z')

const REGISTRE = {
  titre: 'Suivi des livraisons',
  kicker: 'SUIVI DES LIVRAISONS',
  titreNom: 'Nom du dépôt',
  colonnes: [{ clef: 'client', titre: 'Client', type: 'texte' }],
  libelleVide: 'Aucune livraison.',
  libelleAjout: 'Ajouter',
  relancesVides: 'Un suivi ne se relance pas.',
}

function seance(): Seance & { journaux: unknown[] } {
  const journaux: unknown[] = []
  return {
    compte: { id: 'compte-1', plan: 'essai', planExpire: null, credits: 4 },
    maintenant: LE_9_SEPT,
    journaux,
    prendreUnCredit: () => Promise.resolve(true),
    rendreUnCredit: () => Promise.resolve(),
    journaliser: (a: unknown) => {
      journaux.push(a)
      return Promise.resolve()
    },
  } as never
}

const ACCORD: Accord = {
  conversation: [{ qui: 'personne', texte: 'un suivi de livraisons' }],
  famille: null,
  etage: 2,
  laissez: { compteId: 'compte-1', tours: 1, expire: 9e15 },
  paye: true,
}

/** Un fournisseur qui rend un texte, coupé en morceaux de `taille`. */
function diffuseur(texte: string, taille = 7): Fournisseur {
  return {
    nom: 'faux',
    prix: { entree: 0.1, sortie: 0.4 },
    appeler: () => Promise.resolve({ texte, jetonsEntree: 1_500, jetonsSortie: 400 }),
    async *diffuser(): AsyncGenerator<MorceauModele, ReponseModele> {
      for (let i = 0; i < texte.length; i += taille) {
        yield { texte: texte.slice(i, i + taille) }
      }
      return { texte, jetonsEntree: 1_500, jetonsSortie: 400 }
    },
  }
}

async function jouer(f: Fournisseur, accord = ACCORD, s = seance()): Promise<EvenementAgent[]> {
  const vus: EvenementAgent[] = []
  for await (const e of jouerLeTour(accord, f, s, { tauxFcfa: 600, secret: SECRET })) vus.push(e)
  return vus
}

const REPONSE = JSON.stringify({ mot: 'Voilà ton suivi de livraisons.', outil: REGISTRE })

describe('un tour qui aboutit', () => {
  it('montre l’outil s’écrire avant de le rendre', async () => {
    const vus = await jouer(diffuseur(REPONSE))
    const ebauches = vus.filter((e) => e.sorte === 'ebauche')
    expect(ebauches.length).toBeGreaterThan(3)
    expect(vus.at(-1)?.sorte).toBe('fin')
  })

  it('écrit le mot avant de montrer l’outil', async () => {
    // Le modèle rend ses clefs dans l'ordre du schéma : la phrase s'écrit dans
    // la conversation pendant que l'outil se construit à côté.
    const vus = await jouer(diffuseur(REPONSE))
    const premiereAvecMot = vus.findIndex((e) => e.sorte === 'ebauche' && e.ebauche.mot !== '')
    const premiereAvecTitre = vus.findIndex((e) => e.sorte === 'ebauche' && e.ebauche.titre !== '')
    expect(premiereAvecMot).toBeGreaterThanOrEqual(0)
    expect(premiereAvecMot).toBeLessThan(premiereAvecTitre)
  })

  it('ne redessine que quand ce qu’on montrerait a changé', async () => {
    /*
     * Le modèle envoie plusieurs morceaux par mot. Recalculer une ébauche
     * vingt fois par seconde pour la même image occupe un téléphone d'entrée
     * de gamme sans rien montrer de plus.
     */
    const vus = await jouer(diffuseur(REPONSE, 1))
    const ebauches = vus.filter((e) => e.sorte === 'ebauche')
    expect(ebauches.length).toBeLessThan(REPONSE.length / 2)
  })

  it('rend l’outil validé, le coût, et de quoi continuer sans repayer', async () => {
    const vus = await jouer(diffuseur(REPONSE))
    const fin = vus.at(-1)
    expect(fin?.sorte).toBe('fin')
    if (fin?.sorte !== 'fin') return
    expect(fin.tour.sorte).toBe('outil')
    expect(fin.tour.sorte === 'outil' && fin.tour.outil.sorte).toBe('registre')
    expect(fin.fcfa).toBeGreaterThan(0)
    expect(fin.conversation.split('.')).toHaveLength(4)
    expect(fin.credits).toBe(3)
  })

  it('journalise ce que le tour a coûté, même sans outil au bout', async () => {
    // Un tour qui n'aboutit pas a coûté des jetons quand même ; l'omettre
    // ferait sous-estimer la dépense de tout le monde.
    const s = seance()
    await jouer(diffuseur('pas du json du tout'), ACCORD, s)
    expect(s.journaux).toHaveLength(1)
    expect(s.journaux[0]).toMatchObject({ ok: false, jetonsEntree: 1_500 })
  })
})

describe('un tour qui ne fabrique rien', () => {
  it('rend le mot seul quand le modèle pose une question', async () => {
    const vus = await jouer(diffuseur(JSON.stringify({ mot: 'Tu suis quoi exactement ?' })))
    const fin = vus.at(-1)
    expect(fin?.sorte === 'fin' && fin.tour.sorte).toBe('mot')
  })

  it('le dit plutôt que de laisser l’écran figé sur une phrase à moitié', async () => {
    const vus = await jouer(diffuseur('{"mot":'))
    expect(vus.at(-1)?.sorte).toBe('panne')
  })
})

describe('quand ça casse', () => {
  function quiCasse(sorte: 'credit-epuise' | 'panne'): Fournisseur {
    return {
      nom: 'faux',
      prix: { entree: 0.1, sortie: 0.4 },
      appeler: () => Promise.reject(new ErreurFournisseur(sorte, 'non')),
      // eslint-disable-next-line require-yield
      async *diffuser(): AsyncGenerator<MorceauModele, ReponseModele> {
        throw new ErreurFournisseur(sorte, 'non')
      },
    }
  }

  it('dit la panne au lieu de jeter : le client n’a rien à recoller', async () => {
    const vus = await jouer(quiCasse('panne'))
    expect(vus).toEqual([{ sorte: 'panne', pourquoi: 'le modèle n’a pas répondu' }])
  })

  it('distingue le crédit épuisé d’une panne', async () => {
    // Envoyer quelqu'un chercher un problème qui n'existe pas pendant que la
    // vraie cause tient en une phrase.
    const vus = await jouer(quiCasse('credit-epuise'))
    expect(vus[0]).toMatchObject({ sorte: 'panne', sansCredit: true })
  })
})

describe('un fournisseur qui ne sait pas diffuser', () => {
  it('reste utilisable : on rend tout d’un coup', async () => {
    // Mieux vaut un aperçu qui apparaît d'un seul tenant qu'un modèle qu'on ne
    // peut pas essayer.
    const sansFlux: Fournisseur = {
      nom: 'faux',
      prix: { entree: 0.1, sortie: 0.4 },
      appeler: () => Promise.resolve({ texte: REPONSE, jetonsEntree: 1_500, jetonsSortie: 400 }),
    }
    const vus = await jouer(sansFlux)
    expect(vus.filter((e) => e.sorte === 'ebauche')).toHaveLength(0)
    expect(vus.at(-1)?.sorte).toBe('fin')
  })
})

describe('le numéro inventé, dans une conversation', () => {
  it('est retiré comme ailleurs', async () => {
    const page = {
      titre: 'Quincaillerie', kicker: 'QUINCAILLERIE', accroche: 'Tôles et ciment.',
      sections: [{ titre: 'Prix', sorte: 'prix', lignes: [{ nom: 'Ciment', valeur: '5 800 F' }] }],
      telephone: '699 12 34 56',
    }
    const vus = await jouer(diffuseur(JSON.stringify({ mot: 'Voilà.', outil: page })))
    const fin = vus.at(-1)
    expect(fin?.sorte === 'fin' && fin.tour.sorte === 'outil' && fin.tour.outil.sorte).toBe('page')
    if (fin?.sorte === 'fin' && fin.tour.sorte === 'outil' && fin.tour.outil.sorte === 'page') {
      expect(fin.tour.outil.page.telephone).toBeUndefined()
    }
  })

  it('mais celui donné plus tôt dans la conversation reste', async () => {
    /*
     * Quelqu'un donne son numéro au deuxième tour et parle d'autre chose au
     * troisième : il ne doit pas le perdre en chemin. La demande, ici, est la
     * conversation entière — pas seulement le dernier message.
     */
    const page = {
      titre: 'Quincaillerie', kicker: 'QUINCAILLERIE', accroche: 'Tôles et ciment.',
      sections: [{ titre: 'Prix', sorte: 'prix', lignes: [{ nom: 'Ciment', valeur: '5 800 F' }] }],
      telephone: '699412708',
    }
    const accord: Accord = {
      ...ACCORD,
      conversation: [
        { qui: 'personne', texte: 'une page pour ma quincaillerie' },
        { qui: 'personne', texte: 'mon whatsapp est le 6 99 41 27 08' },
        { qui: 'personne', texte: 'mets le sommaire' },
      ],
    }
    const vus = await jouer(diffuseur(JSON.stringify({ mot: 'Voilà.', outil: page })), accord)
    const fin = vus.at(-1)
    if (fin?.sorte === 'fin' && fin.tour.sorte === 'outil' && fin.tour.outil.sorte === 'page') {
      expect(fin.tour.outil.page.telephone).toBe('699412708')
    } else throw new Error('pas une page')
  })
})
