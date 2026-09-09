// @vitest-environment happy-dom
import 'fake-indexeddb/auto'
import { attestation, devis, facture, njangi } from '@a237/engine'
import { beforeEach, describe, expect, it } from 'vitest'
import { numerosEmis, numeroter, reserverNumero } from '../src/numeros.js'

const LE_9_SEPT = new Date('2026-09-09T07:45:00.000Z')
const LE_2_JANVIER_2027 = new Date('2027-01-02T07:45:00.000Z')

/**
 * La mention que la DGI regarde en premier : « unique, continue et
 * chronologique » (§ 5 du brief).
 */

async function vider(): Promise<void> {
  const { clear, createStore } = await import('idb-keyval')
  await clear(createStore('atelier237-numeros', 'numeros'))
}

beforeEach(vider)

describe('la numérotation d’une série', () => {
  it('avance d’un document à l’autre', async () => {
    // Le défaut : chaque facture neuve repartait à FA-2026-0001, parce que
    // personne ne tenait la liste des numéros émis.
    expect(await reserverNumero('facture', LE_9_SEPT)).toBe('FA-2026-0001')
    expect(await reserverNumero('facture', LE_9_SEPT)).toBe('FA-2026-0002')
    expect(await reserverNumero('facture', LE_9_SEPT)).toBe('FA-2026-0003')
  })

  it('tient une série par squelette, sans les mélanger', async () => {
    expect(await reserverNumero('facture', LE_9_SEPT)).toBe('FA-2026-0001')
    expect(await reserverNumero('devis', LE_9_SEPT)).toBe('DV-2026-0001')
    expect(await reserverNumero('attestation', LE_9_SEPT)).toBe('AT-2026-0001')
    expect(await reserverNumero('recu', LE_9_SEPT)).toBe('RE-2026-0001')
    expect(await reserverNumero('facture', LE_9_SEPT)).toBe('FA-2026-0002')
  })

  it('repart à un à chaque année civile', async () => {
    await reserverNumero('facture', LE_9_SEPT)
    await reserverNumero('facture', LE_9_SEPT)
    expect(await reserverNumero('facture', LE_2_JANVIER_2027)).toBe('FA-2027-0001')
    // Et l'ancienne année reste au registre : elle a bien été émise.
    expect(await numerosEmis('facture')).toEqual([
      'FA-2026-0001', 'FA-2026-0002', 'FA-2027-0001',
    ])
  })

  it('ne rend jamais un numéro, même si le document disparaît', async () => {
    // C'est le point. Un registre tenu à partir des outils présents
    // réattribuerait le numéro de la facture qu'on vient d'effacer — deux
    // documents différents portant la même référence, dont l'un est
    // peut-être déjà chez un client.
    await reserverNumero('facture', LE_9_SEPT)
    const deuxieme = await reserverNumero('facture', LE_9_SEPT)
    expect(deuxieme).toBe('FA-2026-0002')
    // L'outil est supprimé du téléphone ; le registre, lui, ne bouge pas.
    expect(await numerosEmis('facture')).toContain('FA-2026-0002')
    expect(await reserverNumero('facture', LE_9_SEPT)).toBe('FA-2026-0003')
  })

  it('ne numérote pas ce qui n’a pas de série', async () => {
    // Un carnet de njangi ou une feuille de présence n'ont rien à numéroter.
    expect(await reserverNumero('njangi', LE_9_SEPT)).toBeNull()
    expect(await reserverNumero('presence', LE_9_SEPT)).toBeNull()
    expect(await reserverNumero('cv', LE_9_SEPT)).toBeNull()
  })

  it('ne se laisse pas interroger sur une clef héritée d’Object', async () => {
    expect(await reserverNumero('constructor', LE_9_SEPT)).toBeNull()
    expect(await reserverNumero('__proto__', LE_9_SEPT)).toBeNull()
  })
})

describe('poser le numéro sur un état neuf', () => {
  it('remplace le numéro de gabarit du squelette', async () => {
    const neuf = facture.initialiser!({ lien: '', maintenant: LE_9_SEPT })
    expect(neuf.numero).toBe('FA-2026-0001')
    await reserverNumero('facture', LE_9_SEPT)
    const pose = (await numeroter('facture', neuf, LE_9_SEPT)) as { numero: string }
    expect(pose.numero).toBe('FA-2026-0002')
  })

  it('laisse intact un état qui ne porte pas de numéro', async () => {
    // Le njangi n'a pas d'`initialiser` : rien à dériver à la création.
    expect(await numeroter('njangi', njangi.defaults, LE_9_SEPT)).toBe(njangi.defaults)
  })

  it('ne pose rien sur ce qui n’est pas un objet', async () => {
    expect(await numeroter('facture', null, LE_9_SEPT)).toBeNull()
    expect(await numeroter('facture', 'texte', LE_9_SEPT)).toBe('texte')
  })

  it('numérote les quatre documents à série, et eux seuls', async () => {
    for (const [id, squelette, prefixe] of [
      ['devis', devis, 'DV'],
      ['facture', facture, 'FA'],
      ['attestation', attestation, 'AT'],
    ] as const) {
      const neuf = squelette.initialiser!({ lien: '', maintenant: LE_9_SEPT })
      const pose = (await numeroter(id, neuf, LE_9_SEPT)) as { numero: string }
      expect(pose.numero).toBe(`${prefixe}-2026-0001`)
    }
  })
})
