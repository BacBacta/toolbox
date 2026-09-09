import { describe, expect, it } from 'vitest'
import { controler } from '../src/publier.js'
import type { Depot } from '../src/publier.js'

/**
 * Le contrôle d'un dépôt, éprouvé sans KV.
 *
 * Le serveur ne fait pas confiance à ce qu'il reçoit — pas parce que le client
 * serait malveillant, mais parce qu'un client peut être une version plus
 * ancienne, une file d'attente qui rejoue, ou n'importe qui avec `curl`.
 */

const LIEN = 'K7M2XQ4BN9PZ'

function depot(modif: Partial<Depot['instantane']> = {}, lien = LIEN): Depot {
  return {
    lien,
    instantane: {
      skeleton: 'facture',
      nom: 'Facture',
      etat: { numero: 'FA-2026-0001' },
      version: 1,
      publieLe: '2026-09-09T07:45:00.000Z',
      ...modif,
    },
  }
}

describe('ce que le serveur refuse', () => {
  it('un lien mal formé, avant de toucher au stockage', () => {
    expect(controler(depot({}, 'trop-court'), null)?.statut).toBe(400)
    expect(controler(depot({}, '../../../etc'), null)?.corps.erreur).toBe('lien-invalide')
    expect(controler(depot({}, ''), null)?.statut).toBe(400)
  })

  it('un corps qui n’est pas un dépôt', () => {
    expect(controler(undefined, null)?.statut).toBe(400)
    expect(controler({ lien: LIEN }, null)?.corps.erreur).toBe('instantane-absent')
    expect(controler({ lien: LIEN, instantane: 'texte' }, null)?.statut).toBe(400)
  })

  it('un squelette que ce serveur ne connaît pas', () => {
    // Un lien publié par une version plus récente de l'application ne doit pas
    // être accepté à l'aveugle : la page de lecture ne saurait pas le dessiner.
    expect(controler(depot({ skeleton: 'bail' }), null)?.corps.erreur).toBe('squelette-inconnu')
  })

  it('l’ardoise et le call-box, et il dit pourquoi', () => {
    // Le refus n'est pas technique. Un bouton grisé se contourne ; une adresse
    // publique ne se reprend pas.
    const ardoise = controler(depot({ skeleton: 'ardoise' }), null)
    expect(ardoise?.statut).toBe(403)
    expect(ardoise?.corps.erreur).toBe('non-publiable')
    expect(String(ardoise?.corps.pourquoi)).toContain('noms et des dettes')
    expect(controler(depot({ skeleton: 'callbox' }), null)?.statut).toBe(403)
  })

  it('une version périmée, en disant celle qu’il détient', () => {
    // Sans `versionServeur`, un téléphone dont la file rejoue une vieille
    // publication perd son travail en silence.
    const v = controler(depot({ version: 3 }), { version: 7 })
    expect(v?.statut).toBe(409)
    expect(v?.corps.erreur).toBe('version-perimee')
    expect(v?.corps.versionServeur).toBe(7)
  })

  it('un rejeu de la même version', () => {
    expect(controler(depot({ version: 4 }), { version: 4 })?.statut).toBe(409)
  })

  it('une version qui n’en est pas une', () => {
    for (const version of [0, -1, 1.5, Number.NaN]) {
      expect(controler(depot({ version }), null)?.statut).toBe(409)
    }
  })
})

describe('ce que le serveur accepte', () => {
  it('un premier dépôt', () => {
    expect(controler(depot(), null)).toBeNull()
  })

  it('une version strictement supérieure', () => {
    expect(controler(depot({ version: 8 }), { version: 7 })).toBeNull()
  })

  it('les registres composés par le modèle, qui n’ont pas de squelette', () => {
    // `compose` n'est le nom d'aucun squelette, et c'est voulu : le registre
    // composé vit sur le téléphone comme les autres et se publie pareil.
    expect(controler(depot({ skeleton: 'compose' }), null)).toBeNull()
    expect(controler(depot({ skeleton: 'compose-calcul' }), null)).toBeNull()
  })

  it('tous les documents et registres du catalogue, sauf les deux exclus', async () => {
    const { SQUELETTES, NON_PUBLIABLES } = await import('@a237/engine')
    for (const s of SQUELETTES) {
      const verdict = controler(depot({ skeleton: s.id }), null)
      if (NON_PUBLIABLES.includes(s.id)) expect(verdict?.statut).toBe(403)
      else expect(verdict).toBeNull()
    }
  })
})
