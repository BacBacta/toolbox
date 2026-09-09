import { describe, expect, it } from 'vitest'
import { limiterItems, MAX_ITEMS_CARTE, texteReste } from '../src/cardspec.js'
import type { CardItem } from '../src/types.js'

function items(n: number): CardItem[] {
  return Array.from({ length: n }, (_, i) => ({
    n: `membre ${i + 1}`, ok: true, warn: false, val: null,
  }))
}

describe('limiterItems — le plafond qui tient le budget de 200 Ko', () => {
  it('laisse passer une liste courte', () => {
    const r = limiterItems(items(4))
    expect(r.visibles).toHaveLength(4)
    expect(r.reste).toBe(0)
  })

  it('coupe au plafond et compte ce qui déborde', () => {
    const r = limiterItems(items(23))
    expect(r.visibles).toHaveLength(MAX_ITEMS_CARTE)
    expect(r.reste).toBe(23 - MAX_ITEMS_CARTE)
    expect(r.visibles[0]?.n).toBe('membre 1')
  })

  it('tombe juste au plafond exact', () => {
    expect(limiterItems(items(MAX_ITEMS_CARTE)).reste).toBe(0)
  })

  it('accepte une liste vide', () => {
    expect(limiterItems([])).toEqual({ visibles: [], reste: 0 })
  })

  it('accepte un plafond imposé', () => {
    expect(limiterItems(items(5), 2)).toMatchObject({ reste: 3 })
  })
})

describe('texteReste', () => {
  it.each([
    [0, null],
    [-3, null],
    [1, '+ 1 autre'],
    [2, '+ 2 autres'],
    [13, '+ 13 autres'],
  ])('texteReste(%i) = %s', (reste, attendu) => {
    expect(texteReste(reste)).toBe(attendu)
  })
})
