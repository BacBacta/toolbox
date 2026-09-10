import { describe, expect, it } from 'vitest'
import { MARQUE, correction, juger, lecons, lireResultat } from '../src/lecons.js'
import type { Epreuve } from '../src/lecons.js'

/**
 * Ce que garde ce fichier tient en une phrase : **on ne doit pas pouvoir
 * réussir une leçon en trichant sans le savoir.**
 *
 * Quelqu'un qui apprend seul n'a personne pour lui dire que sa réponse marche
 * par accident. Si la correction acceptait `console.log(17400)`, il croirait
 * avoir compris la multiplication — et découvrirait le contraire beaucoup plus
 * tard, sans savoir où c'était parti de travers.
 */

const EPREUVES: readonly Epreuve[] = [
  { appel: 'total(5800, 3)', attendu: '17400' },
  { appel: 'total(1750, 4)', attendu: '7000' },
]

describe('la correction', () => {
  /*
   * Le cœur de l'affaire : la correction **appelle** ce qui a été écrit, avec
   * des valeurs qui ne sont ni dans l'énoncé ni dans le fichier de départ.
   */
  it('appelle la fonction de la personne, elle ne lit pas la console', () => {
    const code = correction(EPREUVES)
    expect(code).toContain('total(5800, 3)')
    expect(code).toContain('total(1750, 4)')
  })

  it('enveloppe chaque appel : une fonction absente ne doit pas tuer la page', () => {
    const code = correction(EPREUVES)
    expect(code.match(/try \{/g)).toHaveLength(2)
    expect(code.match(/catch \(/g)).toHaveLength(2)
  })

  it('rend un code vide quand il n’y a rien à corriger', () => {
    expect(correction([])).not.toContain('console.log')
  })
})

describe('relire une ligne de correction', () => {
  it('reconnaît la sienne', () => {
    expect(lireResultat(`${MARQUE}0=17400`)).toEqual({ rang: 0, obtenu: '17400' })
    expect(lireResultat(`${MARQUE}2=!total n’est pas défini`))
      .toEqual({ rang: 2, obtenu: '!total n’est pas défini' })
  })

  /*
   * Ce que la personne affiche ne doit jamais passer pour une correction : sa
   * sortie s'afficherait à la place du verdict, et le verdict à la place de sa
   * sortie.
   */
  it('et laisse tout le reste tranquille', () => {
    expect(lireResultat('17400')).toBe(null)
    expect(lireResultat('Total : 17400 F CFA')).toBe(null)
    expect(lireResultat(MARQUE)).toBe(null)
    expect(lireResultat(`${MARQUE}=17400`)).toBe(null)
    expect(lireResultat(`${MARQUE}x=17400`)).toBe(null)
    expect(lireResultat(`${MARQUE}-1=17400`)).toBe(null)
    expect(lireResultat(`avant ${MARQUE}0=17400`)).toBe(null)
  })

  it('garde une réponse qui contient un « = »', () => {
    expect(lireResultat(`${MARQUE}0=a=b`)?.obtenu).toBe('a=b')
  })
})

describe('le verdict', () => {
  it('réussi quand tout correspond', () => {
    const v = juger(EPREUVES, [{ rang: 0, obtenu: '17400' }, { rang: 1, obtenu: '7000' }])
    expect(v?.reussi).toBe(true)
    expect(v?.manque).toEqual([])
  })

  /*
   * Le cas qui compte. Écrire « console.log(17400) » affiche le bon nombre,
   * mais n'écrit aucune fonction : les appels de la correction échouent, et la
   * leçon n'est pas réussie.
   */
  it('n’est pas réussi quand la personne a seulement affiché la réponse', () => {
    const v = juger(EPREUVES, [
      { rang: 0, obtenu: '!total is not defined' },
      { rang: 1, obtenu: '!total is not defined' },
    ])
    expect(v?.reussi).toBe(false)
    expect(v?.manque).toHaveLength(2)
  })

  it('ni quand une seule des trois valeurs tombe juste', () => {
    const v = juger(EPREUVES, [{ rang: 0, obtenu: '17400' }, { rang: 1, obtenu: '17400' }])
    expect(v?.reussi).toBe(false)
    expect(v?.manque[0]?.appel).toBe('total(1750, 4)')
    expect(v?.manque[0]?.obtenu).toBe('17400')
  })

  /*
   * Tant qu'une réponse manque, on ne conclut pas : le code n'a peut-être pas
   * fini de tourner, et annoncer « raté » à quelqu'un dont le programme était
   * simplement lent est la façon la plus sûre de le faire abandonner.
   */
  it('attend toutes les réponses avant de conclure', () => {
    expect(juger(EPREUVES, [])).toBe(null)
    expect(juger(EPREUVES, [{ rang: 0, obtenu: '17400' }])).toBe(null)
    expect(juger([], [])).toBe(null)
  })

  it('ignore une réponse hors sujet plutôt que de s’y fier', () => {
    const v = juger(EPREUVES, [
      { rang: 0, obtenu: '17400' }, { rang: 1, obtenu: '7000' }, { rang: 9, obtenu: 'rien' },
    ])
    expect(v?.reussi).toBe(true)
  })
})

describe('les leçons elles-mêmes', () => {
  it('sont les mêmes dans les deux langues, sauf ce qui se lit', () => {
    const fr = lecons('fr')
    const en = lecons('en')
    expect(en.map((l) => l.id)).toEqual(fr.map((l) => l.id))
    expect(en.map((l) => l.epreuves)).toEqual(fr.map((l) => l.epreuves))
  })

  it('disent toutes quelque chose, dans les deux langues', () => {
    for (const langue of ['fr', 'en'] as const) {
      for (const l of lecons(langue)) {
        expect(l.titre, `${l.id}/${langue}`).not.toBe('')
        expect(l.enonce, `${l.id}/${langue}`).not.toBe('')
        expect(l.indice, `${l.id}/${langue}`).not.toBe('')
        expect(l.epreuves.length, `${l.id}/${langue}`).toBeGreaterThanOrEqual(2)
        expect(l.fichiers.length, `${l.id}/${langue}`).toBeGreaterThan(0)
      }
    }
  })

  /*
   * Le fichier de départ ne doit pas contenir les réponses. Sinon elles sont
   * sous les yeux, et la leçon devient une dictée.
   *
   * « Les réponses », et non « tout nombre attendu » : la première version de
   * cet essai refusait le zéro, et refusait donc l'énoncé de « monnaie » — qui
   * dit « rends 0 s'il n'y a pas assez ». Ce zéro-là est la consigne, pas une
   * fuite. Un chiffre isolé ne dit rien à personne ; « 17400 » recopié depuis
   * un commentaire, si.
   */
  it('ne laissent aucune réponse parlante dans le fichier de départ', () => {
    for (const langue of ['fr', 'en'] as const) {
      for (const l of lecons(langue)) {
        const depart = l.fichiers.map((f) => f.contenu).join('\n')
        for (const e of l.epreuves.filter((x) => x.attendu.length >= 3)) {
          expect(depart, `${l.id}/${langue} : ${e.attendu}`).not.toContain(e.attendu)
        }
      }
    }
  })

  it('et l’essai ci-dessus sait encore mordre', () => {
    // Sans quoi l'assouplissement d'au-dessus l'aurait vidé de son sens.
    const depart = '// le résultat est 17400\nfunction total() {}'
    expect(depart).toContain('17400')
  })

  /*
   * L'éditeur ouvre le premier fichier. Quand c'était `index.html`, quelqu'un
   * venu écrire une fonction tombait sur « <h1>Leçon</h1> » et devait
   * comprendre qu'il y avait des onglets, et lequel choisir, avant de
   * commencer.
   */
  it('s’ouvrent sur le fichier où se fait le travail', () => {
    for (const langue of ['fr', 'en'] as const) {
      for (const l of lecons(langue)) {
        expect(l.fichiers[0]?.nom, `${l.id}/${langue}`).toBe('script.js')
      }
    }
  })

  it('et donnent un indice qui dit où regarder, pas que c’est faux', () => {
    for (const l of lecons('fr')) {
      expect(l.indice).not.toMatch(/faux|erreur|mauvais/i)
    }
  })
})
