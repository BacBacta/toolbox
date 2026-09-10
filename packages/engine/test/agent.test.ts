import { describe, expect, it } from 'vitest'
import {
  composeDe, ebaucheFinie, ebaucher, familleDe, lireTour, squeletteDe,
} from '../src/agent.js'

/**
 * L'agent : la frontière n'a pas bougé.
 *
 * Ce qui change, c'est qu'il y a une conversation et un aperçu qui se dessine.
 * Ce qui ne change pas : **seule une réponse complète fabrique un outil**. Ce
 * que l'aperçu montre est une ébauche, dessinée telle quelle et remplacée au
 * caractère suivant ; elle ne passe par aucun validateur et n'a le droit de
 * rien créer.
 */

const REGISTRE = {
  titre: 'Suivi des livraisons',
  kicker: 'SUIVI DES LIVRAISONS',
  titreNom: 'Nom du dépôt',
  colonnes: [{ clef: 'client', titre: 'Client', type: 'texte' }],
  libelleVide: 'Aucune livraison.',
  libelleAjout: 'Ajouter',
  relancesVides: 'Un suivi ne se relance pas.',
}

describe('un tour de conversation', () => {
  it('peut ne rien fabriquer, et c’est souvent la bonne réponse', () => {
    // Personne ne décrit du premier coup l'outil qu'il veut. Demander une
    // précision vaut mieux que de fabriquer au hasard, et coûte le même tour.
    expect(lireTour({ mot: 'Tu veux suivre quoi exactement ?' })).toEqual({
      sorte: 'mot',
      mot: 'Tu veux suivre quoi exactement ?',
    })
  })

  it('rend le mot et l’outil ensemble', () => {
    const lu = lireTour({ mot: 'Voilà ton suivi.', outil: REGISTRE })
    expect(lu?.sorte).toBe('outil')
    if (lu?.sorte === 'outil') {
      expect(lu.mot).toBe('Voilà ton suivi.')
      expect(lu.outil.sorte).toBe('registre')
    }
  })

  it('accepte un outil sans commentaire, plutôt que de perdre le tour', () => {
    /*
     * Ça a coûté un vrai deuxième tour de l'apprendre. Refuser semblait juste
     * — la personne resterait devant un écran qui a bougé sans rien dire —
     * mais l'alternative au silence n'était pas une phrase : c'était une
     * panne, écran figé et tour payé.
     */
    const lu = lireTour({ outil: REGISTRE })
    expect(lu?.sorte).toBe('outil')
    expect(lu?.mot).not.toBe('')
  })

  it('et même un outil rendu tout nu, sans enveloppe', () => {
    // Le modèle imite ce qu'il voit : un rappel de l'outil dans la
    // conversation lui a fait répondre par l'outil seul.
    const lu = lireTour(REGISTRE)
    expect(lu?.sorte === 'outil' && lu.outil.sorte).toBe('registre')
  })

  it('mais refuse ce qui ne porte ni mot ni outil', () => {
    expect(lireTour({})).toBeNull()
    expect(lireTour({ mot: '   ' })).toBeNull()
    expect(lireTour('bonjour')).toBeNull()
    expect(lireTour(null)).toBeNull()
  })

  it('rapporte une configuration invalide au lieu de la laisser passer', () => {
    const lu = lireTour({ mot: 'Voilà.', outil: { ...REGISTRE, colonnes: [] } })
    expect(lu?.sorte === 'outil' && lu.outil.sorte).toBe('invalide')
  })

  it('mène chaque forme à son écran', () => {
    const parSorte = [
      [{ sorte: 'registre', registre: REGISTRE }, 'compose'],
      [{ sorte: 'calcul', calcul: {} }, 'compose-calcul'],
      [{ sorte: 'page', page: {} }, 'compose-page'],
      [{ sorte: 'formulaire', formulaire: {} }, 'compose-formulaire'],
      [{ sorte: 'refus', pourquoi: 'non' }, null],
    ] as const
    for (const [reponse, attendu] of parSorte) {
      expect(squeletteDe(reponse as never)).toBe(attendu)
    }
  })

  it('donne au fragment ce qu’il attend, et rien d’autre', () => {
    expect(composeDe({ sorte: 'registre', registre: REGISTRE } as never)).toEqual({
      registre: REGISTRE,
    })
    expect(composeDe({ sorte: 'refus', pourquoi: 'non' } as never)).toBeNull()
  })
})

describe('la famille se lit sur la forme', () => {
  it.each([
    [{ colonnes: [] }, 'registre'],
    [{ entrees: [] }, 'calcul'],
    [{ sections: [] }, 'page'],
    [{ champs: [] }, 'formulaire'],
    [{ impossible: 'non' }, 'refus'],
    [{ titre: 'x' }, null],
    [null, null],
  ])('%o → %s', (outil, attendue) => {
    expect(familleDe(outil)).toBe(attendue)
  })

  it('reconnaît le refus avant tout le reste', () => {
    // Un modèle qui dit « je ne peux pas » a bien travaillé : on ne va pas
    // chercher une forme dans ce qu'il vient de refuser de fabriquer.
    expect(familleDe({ impossible: 'non', colonnes: [] })).toBe('refus')
  })
})

describe('ce qu’on montre pendant que ça s’écrit', () => {
  /*
   * Les états successifs d'un vrai flux. L'aperçu doit avancer à chacun :
   * d'abord la phrase, puis la famille, puis le titre, puis les pièces une à
   * une. C'est ce qui donne à quelqu'un la certitude que ça travaille.
   */
  const FLUX = [
    '{"mot": "Je te fais un suivi',
    '{"mot": "Je te fais un suivi de livraisons.", "outil": {"titre": "Suivi des livra',
    '{"mot": "Je te fais un suivi de livraisons.", "outil": {"titre": "Suivi des livraisons", "colonnes": [{"clef": "client", "titre": "Client"}',
    '{"mot": "Je te fais un suivi de livraisons.", "outil": {"titre": "Suivi des livraisons", "colonnes": [{"clef": "client", "titre": "Client"}, {"clef": "date", "titre": "Date de livraison"}]}}',
  ]

  it('montre la phrase avant que l’outil existe', () => {
    expect(ebaucher(FLUX[0] as string)).toEqual({
      mot: 'Je te fais un suivi', famille: null, titre: '', pieces: [],
    })
  })

  it('montre le titre dès qu’il est écrit, même à moitié', () => {
    const e = ebaucher(FLUX[1] as string)
    expect(e?.titre).toBe('Suivi des livra')
  })

  it('montre les pièces une à une, et la famille avec elles', () => {
    expect(ebaucher(FLUX[2] as string)).toMatchObject({
      famille: 'registre', titre: 'Suivi des livraisons', pieces: ['Client'],
    })
    expect(ebaucher(FLUX[3] as string)?.pieces).toEqual(['Client', 'Date de livraison'])
  })

  it('ne recule jamais sur ce qui est acquis', () => {
    // Un aperçu qui clignote se lit comme une panne.
    const entier = FLUX.at(-1) as string
    let pieces = 0
    for (let i = 0; i <= entier.length; i++) {
      const e = ebaucher(entier.slice(0, i))
      const n = e?.pieces.length ?? 0
      expect(n, `l’aperçu a reculé au caractère ${i}`).toBeGreaterThanOrEqual(pieces)
      pieces = n
    }
    expect(pieces).toBe(2)
  })

  it('ne jette jamais, où que le flux soit coupé', () => {
    const entier = FLUX.at(-1) as string
    for (let i = 0; i <= entier.length; i++) {
      expect(() => ebaucher(entier.slice(0, i))).not.toThrow()
    }
  })

  it('nomme les pièces d’une page par leur titre, celles d’une liste par leur nom', () => {
    expect(ebaucher('{"mot":"x","outil":{"sections":[{"titre":"Nos prix"}]}}')?.pieces)
      .toEqual(['Nos prix'])
    expect(ebaucher('{"mot":"x","outil":{"champs":[{"titre":"Ton nom"}]}}')?.pieces)
      .toEqual(['Ton nom'])
  })

  it('rend rien tant que le modèle n’a pas ouvert la bouche', () => {
    expect(ebaucher('')).toBeNull()
    expect(ebaucher('je réfléchis')).toBeNull()
  })
})

describe('la fenêtre, une fois l’outil fini', () => {
  it('montre la même chose que pendant qu’il s’écrivait', () => {
    // Elle se vidait à l'instant précis où l'outil était prêt : on le voyait
    // s'écrire, puis disparaître au seul moment où on le regarde vraiment.
    const finie = ebaucheFinie('Voilà.', { sorte: 'registre', registre: REGISTRE } as never)
    expect(finie).toEqual({
      mot: 'Voilà.',
      famille: 'registre',
      titre: 'Suivi des livraisons',
      pieces: ['Client'],
    })
  })

  it('nomme les sections d’une page comme l’ébauche les nommait', () => {
    const page = {
      titre: 'Quincaillerie', kicker: 'QUINCAILLERIE', accroche: 'Tôles.',
      sections: [{ titre: 'Nos prix', sorte: 'prix', lignes: [{ nom: 'Ciment' }] }],
    }
    expect(ebaucheFinie('Voilà.', { sorte: 'page', page } as never)).toMatchObject({
      famille: 'page', titre: 'Quincaillerie', pieces: ['Nos prix'],
    })
  })

  it('dit le refus plutôt que d’inventer un outil à montrer', () => {
    expect(ebaucheFinie('Non.', { sorte: 'refus', pourquoi: 'non' } as never)).toEqual({
      mot: 'Non.', famille: 'refus', titre: '', pieces: [],
    })
  })
})
