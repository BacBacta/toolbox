import { describe, expect, it } from 'vitest'
import type { Client, Emetteur } from '../src/mentions.js'
import { mentionsManquantes, peutEtreEmis, piedLegal } from '../src/mentions.js'

const EMETTEUR: Emetteur = {
  nom: 'QUINCAILLERIE BÉPANDA',
  forme: 'Ets — Établissement individuel',
  activite: 'Quincaillerie · matériaux · outillage',
  adresse: 'Rue Bépanda-Omnisport, BP 4127 Douala',
  tel: '+237 6 99 41 27 08',
  mail: 'contact@quincaillerie-bepanda.cm',
  rccm: 'RC/DLA/2022/A/1487',
  niu: 'M022114873829Y',
  centre: 'CDI Douala 3ᵉ',
}

const ENTREPRISE: Client = { nom: 'Ets Mbarga & Fils', niu: 'M019887641203K', estEntreprise: true }
const PARTICULIER: Client = { nom: 'M. Fotso', niu: null, estEntreprise: false }

describe('un émetteur complet', () => {
  it('ne manque de rien', () => {
    expect(mentionsManquantes(EMETTEUR)).toEqual([])
    expect(peutEtreEmis(EMETTEUR, ENTREPRISE)).toBe(true)
    expect(peutEtreEmis(EMETTEUR, PARTICULIER)).toBe(true)
  })
})

describe('le NIU est la mention la plus surveillée', () => {
  it('bloque quand il manque', () => {
    const m = mentionsManquantes({ ...EMETTEUR, niu: '' })
    expect(m).toContainEqual({ champ: 'emetteur.niu', libelle: 'NIU de l’entreprise', gravite: 'bloquant' })
    expect(peutEtreEmis({ ...EMETTEUR, niu: '   ' })).toBe(false)
  })

  it('avertit sans bloquer quand il est mal formé — la clef n’est pas vérifiée à la source', () => {
    const m = mentionsManquantes({ ...EMETTEUR, niu: 'PAS-UN-NIU' })
    expect(m).toHaveLength(1)
    expect(m[0]?.gravite).toBe('avertissement')
    expect(peutEtreEmis({ ...EMETTEUR, niu: 'PAS-UN-NIU' })).toBe(true)
  })
})

describe('le RCCM et les mentions de l’entête', () => {
  it('bloque quand le RCCM manque', () => {
    expect(peutEtreEmis({ ...EMETTEUR, rccm: '' })).toBe(false)
  })

  it.each(['nom', 'forme', 'adresse', 'centre'] as const)('bloque quand %s manque', (champ) => {
    const m = mentionsManquantes({ ...EMETTEUR, [champ]: '' })
    expect(m.map((x) => x.champ)).toContain(`emetteur.${champ}`)
  })
})

describe('le B2B exige le NIU du client', () => {
  it('bloque un client entreprise sans NIU', () => {
    const m = mentionsManquantes(EMETTEUR, { ...ENTREPRISE, niu: null })
    expect(m).toContainEqual({
      champ: 'client.niu',
      libelle: 'NIU du client (obligatoire en B2B)',
      gravite: 'bloquant',
    })
  })

  it('ne l’exige pas d’un particulier', () => {
    expect(mentionsManquantes(EMETTEUR, PARTICULIER)).toEqual([])
  })

  it('avertit sur un NIU client mal formé', () => {
    const m = mentionsManquantes(EMETTEUR, { ...ENTREPRISE, niu: 'X' })
    expect(m[0]?.gravite).toBe('avertissement')
  })

  it('exige le nom du client', () => {
    expect(peutEtreEmis(EMETTEUR, { ...PARTICULIER, nom: '' })).toBe(false)
  })
})

describe('piedLegal', () => {
  it('assemble la ligne imprimée sous le document', () => {
    expect(piedLegal(EMETTEUR)).toBe(
      'QUINCAILLERIE BÉPANDA — Ets — Établissement individuel · RCCM RC/DLA/2022/A/1487 · NIU M022114873829Y · Rue Bépanda-Omnisport, BP 4127 Douala',
    )
  })
})
