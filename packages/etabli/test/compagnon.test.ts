import { describe, expect, it } from 'vitest'
import { appliquer, lireReponseCompagnon, revenir } from '../src/compagnon.js'
import type { Projet } from '../src/projet.js'
import { MAX_OCTETS_PROJET } from '../src/projet.js'

/**
 * Le modèle écrit du code. On ne le croit sur rien.
 *
 * Ce n'est pas de la méfiance de principe : le **nom** d'un fichier décide de
 * la façon dont son contenu s'exécute — `.js` devient un script, `.html`
 * devient la page. Un nom inventé, un dossier glissé dedans, et ce qu'on écrit
 * ne veut plus dire ce qu'on croit. Le modèle n'a pas plus de droits que la
 * personne qui tape au clavier.
 */

const PROJET: Projet = {
  id: 'p1', nom: 'Ma page', maj: 7,
  fichiers: [
    { nom: 'index.html', contenu: '<h1>Salut</h1>' },
    { nom: 'style.css', contenu: 'body { padding: 16px }' },
  ],
}

const bonne = { mot: 'J’ai ajouté le bouton.', fichiers: [{ nom: 'script.js', contenu: 'const a = 1' }] }

describe('ce que le modèle a le droit de rendre', () => {
  it('une réponse qui tient debout', () => {
    const r = lireReponseCompagnon(bonne)
    expect(r?.mot).toBe('J’ai ajouté le bouton.')
    expect(r?.fichiers).toEqual([{ nom: 'script.js', contenu: 'const a = 1' }])
  })

  it('rien d’autre', () => {
    expect(lireReponseCompagnon(null)).toBe(null)
    expect(lireReponseCompagnon('du code')).toBe(null)
    expect(lireReponseCompagnon({ ...bonne, mot: 42 })).toBe(null)
    expect(lireReponseCompagnon({ ...bonne, fichiers: [] })).toBe(null)
    expect(lireReponseCompagnon({ ...bonne, fichiers: 'script.js' })).toBe(null)
    expect(lireReponseCompagnon({ ...bonne, fichiers: [null] })).toBe(null)
    expect(lireReponseCompagnon({ ...bonne, fichiers: [{ nom: 'a.js' }] })).toBe(null)
  })

  /*
   * Le cas qui compte le plus. Un nom décide de l'exécution : une barre oblique
   * laisserait croire à des dossiers qui n'existent pas, et une extension
   * inconnue produirait un fichier que rien ne sait lancer — écrit quand même
   * par-dessus le projet de quelqu'un.
   */
  it('et surtout aucun nom que la personne n’aurait pas pu taper', () => {
    for (const nom of ['../evade.js', 'dossier/a.js', 'a b.js', '.js', 'notes.txt', 'image.png', '']) {
      expect(lireReponseCompagnon({ ...bonne, fichiers: [{ nom, contenu: '' }] }), nom).toBe(null)
    }
  })

  it('ni deux fois le même fichier dans un seul tour', () => {
    expect(lireReponseCompagnon({
      ...bonne,
      fichiers: [{ nom: 'a.js', contenu: '1' }, { nom: 'a.js', contenu: '2' }],
    })).toBe(null)
  })

  /*
   * Un fichier énorme remplirait le stockage du téléphone pour un tour que la
   * personne n'a peut-être même pas voulu.
   */
  it('ni un projet plus gros que ce que le téléphone accepte', () => {
    const enorme = { nom: 'gros.js', contenu: 'a'.repeat(MAX_OCTETS_PROJET + 1) }
    expect(lireReponseCompagnon({ ...bonne, fichiers: [enorme] })).toBe(null)
  })

  it('et coupe un mot qui n’en est plus un', () => {
    const r = lireReponseCompagnon({ ...bonne, mot: 'a'.repeat(5000) })
    expect(r?.mot.length).toBeLessThan(2100)
    expect(r?.mot.endsWith('…')).toBe(true)
  })
})

describe('appliquer au projet', () => {
  it('ajoute ce qui n’existait pas', () => {
    const { projet, changements } = appliquer(PROJET, lireReponseCompagnon(bonne)!)
    expect(projet.fichiers.map((f) => f.nom)).toEqual(['index.html', 'style.css', 'script.js'])
    expect(changements).toEqual([{ nom: 'script.js', quoi: 'ajoute', avant: null }])
  })

  it('remplace ce qui existait, en gardant l’avant', () => {
    const r = lireReponseCompagnon({ mot: 'x', fichiers: [{ nom: 'index.html', contenu: '<h1>Bonjour</h1>' }] })!
    const { projet, changements } = appliquer(PROJET, r)
    expect(projet.fichiers[0]?.contenu).toBe('<h1>Bonjour</h1>')
    expect(changements).toEqual([{ nom: 'index.html', quoi: 'remplace', avant: '<h1>Salut</h1>' }])
  })

  /*
   * Les fichiers non renvoyés ne bougent pas. C'est ce qui permet de dire
   * « ajoute un bouton » sans que la feuille de style soit réécrite de travers
   * en passant.
   */
  it('ne touche pas à ce que le modèle n’a pas renvoyé', () => {
    const { projet } = appliquer(PROJET, lireReponseCompagnon(bonne)!)
    expect(projet.fichiers.find((f) => f.nom === 'style.css')?.contenu).toBe('body { padding: 16px }')
  })

  it('ne compte pas un fichier réécrit à l’identique : il n’y a rien à regarder', () => {
    const r = lireReponseCompagnon({ mot: 'x', fichiers: [{ nom: 'style.css', contenu: 'body { padding: 16px }' }] })!
    expect(appliquer(PROJET, r).changements).toEqual([])
  })
})

describe('revenir en arrière', () => {
  /*
   * Sans ça, un tour raté laisse quelqu'un devant un fichier qu'il ne
   * reconnaît plus, sans aucun moyen de retrouver ce qu'il avait écrit.
   */
  it('rend exactement le projet d’avant', () => {
    const r = lireReponseCompagnon({
      mot: 'x',
      fichiers: [
        { nom: 'index.html', contenu: '<h1>Autre</h1>' },
        { nom: 'script.js', contenu: 'const a = 1' },
      ],
    })!
    const { projet, changements } = appliquer(PROJET, r)
    expect(projet.fichiers).toHaveLength(3)
    expect(revenir(projet, changements).fichiers).toEqual(PROJET.fichiers)
  })
})
