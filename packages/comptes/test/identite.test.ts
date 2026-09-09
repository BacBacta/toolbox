import { ALPHABET_LIEN } from '@a237/engine'
import { describe, expect, it } from 'vitest'
import { codeLisible, empreinte, jetonValide, normaliserCode, tirerCode, tirerJeton } from '../src/identite.js'

describe('le jeton d’un appareil', () => {
  it('fait cent vingt-huit bits, en hexadécimal', () => {
    const j = tirerJeton()
    expect(j).toMatch(/^[0-9a-f]{32}$/)
    expect(jetonValide(j)).toBe(true)
  })

  it('ne se répète pas', () => {
    const tires = new Set(Array.from({ length: 200 }, () => tirerJeton()))
    expect(tires.size).toBe(200)
  })

  it('et ce qui n’en est pas un se refuse avant toute lecture de base', () => {
    for (const faux of ['', 'abc', 'A'.repeat(32), '0'.repeat(31), '0'.repeat(33), '../../etc']) {
      expect(jetonValide(faux), faux).toBe(false)
    }
  })
})

describe('l’empreinte', () => {
  it('est stable, et ne rend pas le secret', async () => {
    const j = tirerJeton()
    expect(await empreinte(j)).toBe(await empreinte(j))
    expect(await empreinte(j)).not.toContain(j)
    expect(await empreinte(j)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('sépare deux jetons voisins', async () => {
    expect(await empreinte('a'.repeat(32))).not.toBe(await empreinte(`${'a'.repeat(31)}b`))
  })
})

describe('le code de récupération', () => {
  it('se dit au téléphone : seize lettres sans I, 1, O, 0 ni U', () => {
    const code = tirerCode()
    expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
    for (const lettre of code.replace(/-/g, '')) expect(ALPHABET_LIEN).toContain(lettre)
    for (const interdit of ['I', 'O', 'U', '0', '1']) expect(code).not.toContain(interdit)
  })

  it('ne se répète pas', () => {
    const tires = new Set(Array.from({ length: 200 }, () => tirerCode()))
    expect(tires.size).toBe(200)
  })

  it('se lit malgré les tirets, les espaces et les minuscules', () => {
    expect(normaliserCode('a2b3-c4d5-e6f7-g8h9')).toBe('A2B3C4D5E6F7G8H9')
    expect(normaliserCode('  A2B3 C4D5 E6F7 G8H9  ')).toBe('A2B3C4D5E6F7G8H9')
    expect(normaliserCode('A2B3C4D5E6F7G8H9')).toBe('A2B3C4D5E6F7G8H9')
  })

  it('mais ce qui n’en est pas un se refuse au lieu de se comparer', () => {
    // Une lettre exclue de l'alphabet est une faute de recopie, pas un code :
    // la confondre avec une voisine reviendrait à deviner à la place de qui
    // tape. Mieux vaut le dire.
    for (const faux of ['', 'trop-court', 'A2B3-C4D5-E6F7-G8HI', 'A2B3C4D5E6F7G8H90']) {
      expect(normaliserCode(faux), faux).toBeNull()
    }
  })

  it('se remontre par groupes de quatre', () => {
    expect(codeLisible('A2B3C4D5E6F7G8H9')).toBe('A2B3-C4D5-E6F7-G8H9')
  })
})
