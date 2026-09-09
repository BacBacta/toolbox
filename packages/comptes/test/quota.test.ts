import { describe, expect, it } from 'vitest'
import { apresGeneration, controlerQuota, statutDe } from '../src/quota.js'
import { compteNeuf } from '../src/plan.js'
import type { Compte } from '../src/plan.js'

const LE_9_SEPT = new Date('2026-09-09T07:45:00.000Z')
const DANS_UN_MOIS = LE_9_SEPT.getTime() + 30 * 24 * 60 * 60 * 1000

const ESSAI = compteNeuf('u1')
const ATELIER: Compte = { id: 'u2', plan: 'atelier', planExpire: DANS_UN_MOIS, credits: 40 }

describe('ce que le quota laisse passer', () => {
  it('un essai avec des crédits, aux étages 1 et 2', () => {
    expect(controlerQuota(ESSAI, 2, LE_9_SEPT).sorte).toBe('passe')
  })

  it('et un abonné à tous les étages', () => {
    expect(controlerQuota(ATELIER, 3, LE_9_SEPT).sorte).toBe('passe')
  })
})

describe('ce que le quota refuse', () => {
  it('l’étage 3 sans abonnement', () => {
    const v = controlerQuota(ESSAI, 3, LE_9_SEPT)
    expect(v.sorte).toBe('abonnement-requis')
    expect(statutDe(v)).toBe(402)
  })

  it('l’étage 3 avec un abonnement échu', () => {
    const echu: Compte = { ...ATELIER, planExpire: LE_9_SEPT.getTime() - 1 }
    expect(controlerQuota(echu, 3, LE_9_SEPT).sorte).toBe('abonnement-requis')
  })

  it('n’importe quel étage sans crédit', () => {
    expect(controlerQuota({ ...ESSAI, credits: 0 }, 2, LE_9_SEPT).sorte).toBe('credits-epuises')
    expect(controlerQuota({ ...ATELIER, credits: 0 }, 1, LE_9_SEPT).sorte).toBe('credits-epuises')
  })

  it('dit « prends un abonnement » à qui n’a ni l’un ni l’autre', () => {
    // L'abonnement répond aux deux manques à la fois ; le crédit à un seul.
    const v = controlerQuota({ ...ESSAI, credits: 0 }, 3, LE_9_SEPT)
    expect(v.sorte).toBe('abonnement-requis')
  })

  it('et ne dit pas la même chose à un essai qu’à un abonné épuisé', () => {
    const essai = controlerQuota({ ...ESSAI, credits: 0 }, 1, LE_9_SEPT)
    const atelier = controlerQuota({ ...ATELIER, credits: 0 }, 1, LE_9_SEPT)
    expect(essai.sorte).toBe('credits-epuises')
    expect(atelier.sorte).toBe('credits-epuises')
    if (essai.sorte === 'passe' || atelier.sorte === 'passe') throw new Error('impossible')
    expect(essai.pourquoi).not.toBe(atelier.pourquoi)
    expect(atelier.pourquoi).toContain('s’ajoutent')
  })
})

describe('ce qu’un appel coûte', () => {
  it('un crédit, même quand le modèle refuse', () => {
    // Le refus a coûté des jetons. Ne pas le décompter laisserait une boucle de
    // demandes impossibles dépenser sans fin.
    expect(apresGeneration(ESSAI).credits).toBe(ESSAI.credits - 1)
  })

  it('et ne descend jamais sous zéro', () => {
    expect(apresGeneration({ ...ESSAI, credits: 0 }).credits).toBe(0)
  })
})
