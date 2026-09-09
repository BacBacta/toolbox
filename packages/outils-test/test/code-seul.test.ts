import { describe, expect, it } from 'vitest'
import { codeSeul } from '../src/code-seul.js'

/**
 * Le scanner qui garde les autres garde mal s'il devient aveugle. Ces tests
 * sont sa contrepartie : ils vérifient qu'il retire bien ce qu'il doit retirer,
 * et surtout qu'il ne retire pas ce qui est du code.
 */
describe('codeSeul', () => {
  it('retire les commentaires de ligne et de bloc', () => {
    expect(codeSeul('const a = 1 // document.title')).not.toContain('document')
    expect(codeSeul('/* window.alert */ const a = 1')).not.toContain('window')
  })

  it('retire le mot d’un commentaire même quand c’est un mot français', () => {
    expect(codeSeul('// interdit : dangerouslySetInnerHTML')).not.toContain('dangerously')
  })

  it('retire le texte des chaînes, y compris en français', () => {
    expect(codeSeul("const d = 'Les lignes du document.'")).not.toContain('document')
    expect(codeSeul('const d = "fenêtre : window"')).not.toContain('window')
  })

  it('survit à une apostrophe échappée', () => {
    expect(codeSeul("const a = 'l\\'appelant'\nconst b = 2")).toContain('const b')
  })

  it('garde les expressions interpolées : c’est du code', () => {
    expect(codeSeul('const t = `bonjour ${document.title} !`')).toContain('document')
    expect(codeSeul('const t = `${a} et ${b}`')).toContain('a')
  })

  it('retire le texte autour des interpolations', () => {
    expect(codeSeul('const t = `le document dit ${x}`')).not.toContain('document dit')
  })

  it('laisse passer le code ordinaire', () => {
    expect(codeSeul('const somme = a / b + 1')).toContain('a / b')
  })

  it('ne se perd pas sur une chaîne qui contient un début de commentaire', () => {
    expect(codeSeul("const u = 'https://exemple.cm' \nconst v = 3")).toContain('const v')
  })
})
