import { describe, expect, it } from 'vitest'
import { assembler } from '../src/assembler.js'
import { BAC_A_SABLE, lireMessageDApercu, pourApercu } from '../src/apercu.js'
import type { Projet } from '../src/projet.js'

const PROJET: Projet = {
  id: 'p1', nom: 'Ma page', maj: 0,
  fichiers: [
    { nom: 'index.html', contenu: '<h1>Salut</h1>' },
    { nom: 'script.js', contenu: 'console.log("un")' },
  ],
}

/**
 * L'aperçu tourne dans un cadre isolé, et l'isolement est la seule chose qui
 * rend tout le reste acceptable.
 *
 * On exécute du code écrit par quelqu'un — le sien, ou celui d'un projet reçu
 * sur WhatsApp. Sans « allow-same-origin », ce code n'a **aucun** accès à la
 * page qui le contient : ni à son stockage, ni à ses cookies, ni à son DOM. Il
 * s'exécute dans une origine opaque, seul avec lui-même.
 *
 * Les deux ensemble — « allow-scripts » et « allow-same-origin » — se
 * neutralisent : le cadre peut alors retirer son propre bac à sable. C'est
 * précisément la faute qu'un essai doit rendre impossible à commettre
 * distraitement.
 */
describe('le bac à sable', () => {
  it('laisse le code s’exécuter', () => {
    expect(BAC_A_SABLE).toContain('allow-scripts')
  })

  it('ne lui rend jamais son origine : les deux ensemble annulent l’isolement', () => {
    expect(BAC_A_SABLE).not.toContain('allow-same-origin')
  })

  it('ni la navigation du dessus : une page reçue ne détourne pas l’Établi', () => {
    expect(BAC_A_SABLE).not.toContain('allow-top-navigation')
  })
})

describe('le document d’aperçu', () => {
  it('porte le projet', () => {
    const doc = pourApercu(PROJET)
    expect(doc).toContain('<h1>Salut</h1>')
    expect(doc).toContain('console.log("un")')
  })

  /*
   * Le pont doit être posé avant le code de la personne : une erreur à la
   * première ligne est justement celle qu'il faut voir passer.
   */
  it('pose le pont de la console avant le code, jamais après', () => {
    const doc = pourApercu(PROJET)
    expect(doc.indexOf('a237-etabli')).toBeLessThan(doc.indexOf('console.log("un")'))
  })

  it('mais le document exporté n’en porte pas : il n’a personne à qui parler', () => {
    // Un fichier qu'on envoie sur WhatsApp s'ouvre seul. Un pont vers une
    // fenêtre parente qui n'existe pas ne sert à rien, et se lirait dans la
    // source d'un travail qu'on montre à quelqu'un.
    expect(assembler(PROJET)).not.toContain('a237-etabli')
    expect(assembler(PROJET)).toContain('<h1>Salut</h1>')
  })
})

/**
 * Ce qui revient du cadre est du texte écrit par du code quelconque.
 *
 * Le cadre n'a pas d'origine — c'est le prix de l'isolement — donc vérifier
 * l'origine du message ne dit rien. Ce qui se vérifie est la **forme**, et
 * l'appelant vérifie de son côté que le message vient bien de son cadre à lui.
 */
describe('un message qui revient de l’aperçu', () => {
  it('se lit quand il a la bonne forme', () => {
    expect(lireMessageDApercu({ a237: 'etabli', sorte: 'journal', texte: 'un' }))
      .toEqual({ sorte: 'journal', texte: 'un' })
    expect(lireMessageDApercu({ a237: 'etabli', sorte: 'erreur', texte: 'boum' }))
      .toEqual({ sorte: 'erreur', texte: 'boum' })
  })

  it('et se jette sinon, plutôt que d’afficher n’importe quoi', () => {
    for (const donnees of [
      null, 'texte', 42, {},
      { sorte: 'journal', texte: 'un' },
      { a237: 'autre-chose', sorte: 'journal', texte: 'un' },
      { a237: 'etabli', sorte: 'exécuter', texte: 'rm -rf' },
      { a237: 'etabli', sorte: 'journal', texte: 42 },
    ]) {
      expect(lireMessageDApercu(donnees), JSON.stringify(donnees)).toBe(null)
    }
  })

  it('coupe un message trop long : une boucle peut en écrire un million', () => {
    const lu = lireMessageDApercu({ a237: 'etabli', sorte: 'journal', texte: 'a'.repeat(50_000) })
    expect(lu?.texte.length).toBeLessThan(3000)
  })
})
