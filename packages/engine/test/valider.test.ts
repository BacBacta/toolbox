import { describe, expect, it } from 'vitest'
import type { JsonSchema } from '../src/types.js'
import { estValide, messageErreurs, valider } from '../src/valider.js'

describe('types simples', () => {
  it('valide et rejette une chaîne', () => {
    const s: JsonSchema = { type: 'string' }
    expect(estValide(s, 'bonjour')).toBe(true)
    expect(estValide(s, 42)).toBe(false)
    expect(valider(s, 42)[0]?.message).toContain('chaîne attendue')
  })

  it('applique enum, minLength et maxLength', () => {
    const s: JsonSchema = { type: 'string', enum: ['encre', 'bordeaux'] }
    expect(estValide(s, 'encre')).toBe(true)
    expect(estValide(s, 'turquoise')).toBe(false)
    expect(estValide({ type: 'string', minLength: 2 }, 'a')).toBe(false)
    expect(estValide({ type: 'string', maxLength: 2 }, 'abc')).toBe(false)
  })

  it('distingue number et integer', () => {
    expect(estValide({ type: 'number' }, 1.5)).toBe(true)
    expect(estValide({ type: 'integer' }, 1.5)).toBe(false)
    expect(estValide({ type: 'integer' }, 2)).toBe(true)
  })

  it('applique minimum et maximum', () => {
    const s: JsonSchema = { type: 'integer', minimum: 0, maximum: 100 }
    expect(estValide(s, 50)).toBe(true)
    expect(estValide(s, -1)).toBe(false)
    expect(estValide(s, 101)).toBe(false)
  })

  it('refuse NaN et l’infini là où un nombre est attendu', () => {
    expect(estValide({ type: 'number' }, Number.NaN)).toBe(false)
    expect(estValide({ type: 'number' }, Number.POSITIVE_INFINITY)).toBe(false)
  })

  it('valide un booléen', () => {
    expect(estValide({ type: 'boolean' }, false)).toBe(true)
    expect(estValide({ type: 'boolean' }, 'false')).toBe(false)
  })
})

describe('tableaux', () => {
  const s: JsonSchema = { type: 'array', items: { type: 'integer' }, minItems: 1, maxItems: 3 }

  it('valide le contenu élément par élément', () => {
    expect(estValide(s, [1, 2])).toBe(true)
    expect(estValide(s, [1, 'deux'])).toBe(false)
  })

  it('désigne l’élément fautif par son index', () => {
    expect(valider(s, [1, 'deux'])[0]?.chemin).toBe('$[1]')
  })

  it('applique minItems et maxItems', () => {
    expect(estValide(s, [])).toBe(false)
    expect(estValide(s, [1, 2, 3, 4])).toBe(false)
  })

  it('refuse un objet là où un tableau est attendu', () => {
    expect(estValide(s, { 0: 1 })).toBe(false)
  })
})

describe('objets', () => {
  const s: JsonSchema = {
    type: 'object',
    properties: { nom: { type: 'string' }, age: { type: 'integer', minimum: 0 } },
    required: ['nom'],
    additionalProperties: false,
  }

  it('valide un objet conforme', () => {
    expect(estValide(s, { nom: 'Adèle', age: 34 })).toBe(true)
    expect(estValide(s, { nom: 'Adèle' })).toBe(true)
  })

  it('signale un champ obligatoire manquant, par son chemin', () => {
    const e = valider(s, { age: 34 })
    expect(e).toHaveLength(1)
    expect(e[0]).toEqual({ chemin: '$.nom', message: 'champ obligatoire manquant' })
  })

  it('refuse un champ inattendu quand additionalProperties est false', () => {
    expect(valider(s, { nom: 'x', couleur: 'bleu' })[0]?.chemin).toBe('$.couleur')
  })

  it('tolère un champ inattendu quand additionalProperties n’est pas posé', () => {
    const ouvert: JsonSchema = { type: 'object', properties: { nom: { type: 'string' } } }
    expect(estValide(ouvert, { nom: 'x', couleur: 'bleu' })).toBe(true)
  })

  it('refuse null et un tableau là où un objet est attendu', () => {
    expect(estValide(s, null)).toBe(false)
    expect(estValide(s, [])).toBe(false)
  })

  it('ne suit pas la chaîne de prototypes sur une clef hostile', () => {
    // Une sortie de modèle passée par JSON.parse peut porter ces clefs.
    const hostile = JSON.parse('{"nom":"x","__proto__":{"pollue":true}}') as unknown
    const e = valider(s, hostile)
    expect(e.map((x) => x.chemin)).toContain('$.__proto__')
    expect((Object.prototype as Record<string, unknown>)['pollue']).toBeUndefined()
  })
})

describe('imbrication', () => {
  const s: JsonSchema = {
    type: 'object',
    properties: {
      membres: {
        type: 'array',
        items: {
          type: 'object',
          properties: { nom: { type: 'string' }, aVerse: { type: 'boolean' } },
          required: ['nom', 'aVerse'],
          additionalProperties: false,
        },
      },
    },
    required: ['membres'],
    additionalProperties: false,
  }

  it('désigne le champ fautif au fond de l’arbre', () => {
    const e = valider(s, { membres: [{ nom: 'Adèle', aVerse: true }, { nom: 'Serge', aVerse: 'oui' }] })
    expect(e).toHaveLength(1)
    expect(e[0]?.chemin).toBe('$.membres[1].aVerse')
  })

  it('accumule plusieurs manquements', () => {
    const e = valider(s, { membres: [{ aVerse: 1 }] })
    expect(e.length).toBeGreaterThan(1)
    expect(messageErreurs(e)).toContain('$.membres[0].nom')
  })
})
