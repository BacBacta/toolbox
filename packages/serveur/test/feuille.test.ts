import { describe, expect, it } from 'vitest'
import { sansCommentaires } from '../src/feuille.js'

describe('alléger la feuille inlinée', () => {
  it('retire les commentaires', () => {
    expect(sansCommentaires('a { color: red } /* pourquoi */ b { color: blue }'))
      .toBe('a { color: red }  b { color: blue }')
  })

  it('retire ceux qui tiennent plusieurs lignes, et la ligne qu’ils occupaient', () => {
    const css = 'a { color: red }\n/*\n * une explication\n */\nb { color: blue }\n'
    expect(sansCommentaires(css)).toBe('a { color: red }\nb { color: blue }\n')
  })

  it('mais pas ce qui ressemble à un commentaire dans une chaîne', () => {
    // `content: "/*"` est du texte. Une expression régulière qui ne compte pas
    // les guillemets couperait la règle en deux et casserait la page publiée.
    const css = 'a::before { content: "/* pas un commentaire */" } b { color: red }'
    expect(sansCommentaires(css)).toBe(css)
  })

  it('ni ce qu’une barre oblique inverse échappe', () => {
    const css = `a::before { content: '\\'/*' } b { color: red }`
    expect(sansCommentaires(css)).toBe(css)
  })

  it('et un commentaire jamais fermé emporte la fin, comme le ferait le navigateur', () => {
    expect(sansCommentaires('a { color: red } /* oublié')).toBe('a { color: red } ')
  })

  it('laisse intacte une feuille sans commentaire', () => {
    const css = '.a { color: red }\n.b { color: blue }\n'
    expect(sansCommentaires(css)).toBe(css)
  })
})
