import { afterEach, describe, expect, it, vi } from 'vitest'
import { couter } from '../src/cout.js'
import type { DemandeModele, Fournisseur } from '../src/fournisseur.js'
import { traiter } from '../src/traiter.js'

/**
 * Aucun appel réseau ici. Un faux fournisseur rend les réponses qu'on lui
 * donne — y compris les mauvaises, qui sont celles qui comptent : c'est la
 * sortie de modèle abîmée qu'il faut arrêter, pas la bonne.
 */

const BON = JSON.stringify({
  titre: 'Suivi des livraisons',
  kicker: 'SUIVI DES LIVRAISONS',
  titreNom: 'Nom du dépôt',
  colonnes: [
    { clef: 'client', titre: 'Client', type: 'texte' },
    { clef: 'montant', titre: 'Montant (F CFA)', type: 'montant' },
  ],
  libelleVide: 'Aucune livraison pour l’instant.',
  libelleAjout: 'Ajouter une livraison',
  relancesVides: 'Un suivi se consulte, il ne se relance pas.',
})

afterEach(() => vi.unstubAllGlobals())

const MAUVAIS = JSON.stringify({ ...JSON.parse(BON), total: { type: 'somme', clef: 'inconnue', libelle: 'Total', unite: 'F' } })

function faux(reponses: readonly string[]): Fournisseur & { vus: DemandeModele[] } {
  const vus: DemandeModele[] = []
  return {
    nom: 'faux',
    prix: { entree: 0.1, sortie: 0.4 },
    vus,
    appeler: (d) => {
      vus.push(d)
      return Promise.resolve({
        texte: reponses[vus.length - 1] ?? '',
        jetonsEntree: 1_500,
        jetonsSortie: 500,
      })
    },
  }
}

describe('le chemin qui marche', () => {
  it('rend la configuration au premier essai', async () => {
    const f = faux([BON])
    const r = await traiter('je veux suivre mes livraisons', f, 600)
    expect(r.sorte).toBe('reussi')
    if (r.sorte !== 'reussi') return
    expect(r.essais).toBe(1)
    expect(r.registre.colonnes).toHaveLength(2)
    expect(f.vus).toHaveLength(1)
  })

  it('tient le budget du brief : moins d’un franc la génération', async () => {
    // 1 500 jetons en entrée, 500 en sortie, au tarif Flash-Lite (§ 5).
    const r = await traiter('un registre', faux([BON]), 600)
    expect(r.cout.fcfa).toBeLessThan(1)
  })

  it('déshabille un bloc de code, faute de forme et non de fond', async () => {
    const r = await traiter('un registre', faux(['```json\n' + BON + '\n```']), 600)
    expect(r.sorte).toBe('reussi')
  })
})

describe('la reprise, une seule fois', () => {
  it('reprend après une sortie invalide, et réussit', async () => {
    const f = faux([MAUVAIS, BON])
    const r = await traiter('je veux suivre mes livraisons', f, 600)
    expect(r.sorte).toBe('reussi')
    if (r.sorte === 'reussi') expect(r.essais).toBe(2)

    // La reprise porte ce que le modèle a dit et pourquoi c'était faux : sans
    // le reproche nommé, il recommencerait au hasard.
    const reprise = f.vus[1]?.reprise
    expect(reprise?.sortie).toBe(MAUVAIS)
    expect(reprise?.reproches).toContain('ne désigne aucune colonne')
  })

  it('abandonne après le deuxième échec, sans boucler', async () => {
    const f = faux([MAUVAIS, MAUVAIS, BON])
    const r = await traiter('un registre', f, 600)
    expect(r.sorte).toBe('invalide')
    // Trois appels brûleraient le budget d'un compte sur une demande perdue.
    expect(f.vus).toHaveLength(2)
  })

  it('compte les deux tours dans le coût, même quand ça rate', async () => {
    const r = await traiter('un registre', faux([MAUVAIS, MAUVAIS]), 600)
    const unTour = couter({ entree: 1_500, sortie: 500 }, { entree: 0.1, sortie: 0.4 }, 600)
    expect(r.cout.fcfa).toBeCloseTo(unTour.fcfa * 2, 2)
  })
})

describe('ce qui ne doit jamais atteindre l’écran', () => {
  it.each([
    ['du HTML', '<div onclick="alert(1)">Registre</div>'],
    ['du JavaScript', 'fetch("https://ailleurs").then(r => r.json())'],
    ['des politesses', 'Bien sûr ! Voici votre registre.'],
    ['rien', ''],
  ])('refuse %s, deux fois de suite', async (_quoi, sortie) => {
    const r = await traiter('un registre', faux([sortie, sortie]), 600)
    expect(r.sorte).toBe('invalide')
  })

  it('refuse un JSON bien formé qui décrit autre chose', async () => {
    // C'est le cas dangereux : la forme est bonne, le fond ne l'est pas.
    const r = await traiter('un registre', faux([
      JSON.stringify({ html: '<script>x</script>' }),
      JSON.stringify({ html: '<script>x</script>' }),
    ]), 600)
    expect(r.sorte).toBe('invalide')
  })
})

describe('le modèle a le droit de dire non', () => {
  it('rend le refus sans le reprendre', async () => {
    const f = faux([JSON.stringify({ impossible: 'Un site internet ne se range pas dans un registre.' })])
    const r = await traiter('je veux un site internet', f, 600)
    expect(r.sorte).toBe('hors-sujet')
    if (r.sorte === 'hors-sujet') expect(r.pourquoi).toContain('site internet')
    // Reprendre un refus, ce serait payer un tour pour lui faire inventer ce
    // qu'il vient justement de refuser d'inventer.
    expect(f.vus).toHaveLength(1)
  })

  it('compte quand même ce que le refus a coûté', async () => {
    const r = await traiter('un logo', faux([JSON.stringify({ impossible: 'Un logo se dessine.' })]), 600)
    expect(r.cout.fcfa).toBeGreaterThan(0)
  })
})

describe('les pannes de fournisseur se nomment', () => {
  it('reconnaît un crédit épuisé chez le routeur', async () => {
    const { openrouter, ErreurFournisseur } = await import('../src/index.js')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 402, json: () => Promise.resolve({}) }))
    await expect(openrouter('x').appeler({ invite: 'x' })).rejects.toMatchObject({
      sorte: 'credit-epuise',
    })
    expect(ErreurFournisseur).toBeDefined()
  })

  it('distingue une clef refusée d’une panne', async () => {
    const { openrouter } = await import('../src/index.js')
    for (const [statut, sorte] of [[401, 'refuse'], [500, 'panne']] as const) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: statut, json: () => Promise.resolve({}) }))
      await expect(openrouter('x').appeler({ invite: 'x' })).rejects.toMatchObject({ sorte })
    }
  })

  it('reconnaît aussi le quota chez Gemini en direct', async () => {
    const { gemini } = await import('../src/index.js')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429, json: () => Promise.resolve({}) }))
    await expect(gemini('x').appeler({ invite: 'x' })).rejects.toMatchObject({ sorte: 'credit-epuise' })
  })
})

describe('le JSON du modèle, tel qu’il arrive vraiment', () => {
  /*
   * Mesuré en production sur dix générations réelles : une demande sur dix a
   * échoué sur « la réponse n'est pas du JSON », deux fois de suite, pour
   * soixante centimes. On ne savait pas ce que le modèle avait renvoyé — rien
   * ne le gardait — et c'était le premier défaut à corriger : un échec qu'on
   * ne peut pas diagnostiquer se reproduit.
   *
   * Les formes ci-dessous sont celles qu'un modèle produit quand il déborde de
   * la consigne. Aucune n'est une faute de fond : la configuration est là,
   * enveloppée. On la déshabille plutôt que de faire payer un tour de plus.
   */
  const CAS: readonly (readonly [string, string])[] = [
    ['une phrase avant le bloc', `Voici la configuration demandée :\n\n\`\`\`json\n${BON}\n\`\`\``],
    ['une phrase après', `\`\`\`json\n${BON}\n\`\`\`\n\nDis-moi si ça te convient.`],
    ['des deux côtés', `Bien sûr !\n\`\`\`\n${BON}\n\`\`\`\nVoilà.`],
    ['sans bloc, juste de la prose autour', `Voici :\n${BON}\nJ’espère que ça ira.`],
    ['un bloc sans langue annoncée', `\`\`\`\n${BON}\n\`\`\``],
  ]

  for (const [quoi, texte] of CAS) {
    it(`se lit malgré ${quoi}`, async () => {
      const f = faux([texte])
      const r = await traiter('je veux suivre mes livraisons', f, 600)
      expect(r.sorte, quoi).toBe('reussi')
      // Et sans reprise : la faute de forme ne doit pas coûter un tour.
      expect(f.vus).toHaveLength(1)
    })
  }

  it('mais de la prose sans configuration reste un échec', async () => {
    // On déshabille ce qui est enveloppé ; on n'invente pas ce qui manque.
    const f = faux(['Je pense que tu devrais plutôt utiliser un tableur.', 'toujours pas de json'])
    const r = await traiter('je veux suivre mes livraisons', f, 600)
    expect(r.sorte).toBe('invalide')
  })
})
