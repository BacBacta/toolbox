import { describe, expect, it } from 'vitest'
import {
  CREDITS_ATELIER, CREDITS_ESSAI, DUREE_ABONNEMENT, abonne, apresPaiement, compteNeuf, planEffectif,
} from '../src/plan.js'
import type { Compte } from '../src/plan.js'

const LE_9_SEPT = new Date('2026-09-09T07:45:00.000Z')
const dans = (jours: number): number => LE_9_SEPT.getTime() + jours * 24 * 60 * 60 * 1000

describe('un compte neuf', () => {
  it('essaie sans rien demander', () => {
    const c = compteNeuf('u1')
    expect(c.plan).toBe('essai')
    expect(c.credits).toBe(CREDITS_ESSAI)
    expect(abonne(c, LE_9_SEPT)).toBe(false)
  })
})

describe('l’abonnement', () => {
  const atelier = (expire: number | null): Compte => ({
    id: 'u1', plan: 'atelier', planExpire: expire, credits: 10,
  })

  it('court tant qu’il n’est pas échu', () => {
    expect(abonne(atelier(dans(1)), LE_9_SEPT)).toBe(true)
    expect(abonne(atelier(dans(-1)), LE_9_SEPT)).toBe(false)
  })

  it('échu, le compte redevient un essai sans rien perdre', () => {
    // Les outils vivent sur le téléphone et les publications restent en ligne :
    // ce qui s'arrête est la composition, la seule chose qui coûte à l'usage.
    const echu = atelier(dans(-1))
    expect(planEffectif(echu, LE_9_SEPT)).toBe('essai')
    expect(echu.credits).toBe(10)
  })

  it('n’existe pas sans date d’expiration', () => {
    // Un plan « atelier » sans échéance serait un abonnement à vie donné par
    // une écriture ratée. On refuse plutôt que d'offrir.
    expect(abonne(atelier(null), LE_9_SEPT)).toBe(false)
  })
})

describe('ce qu’un paiement change', () => {
  it('donne trente jours et recharge les crédits', () => {
    const c = apresPaiement(compteNeuf('u1'), LE_9_SEPT)
    expect(c.plan).toBe('atelier')
    expect(c.planExpire).toBe(LE_9_SEPT.getTime() + DUREE_ABONNEMENT)
    expect(c.credits).toBe(CREDITS_ATELIER)
  })

  it('prolonge au lieu de remplacer, pour qui paie en avance', () => {
    // Payer le 20 quand on est couvert jusqu'au 30 ajoute trente jours au 30 :
    // personne ne perd dix jours pour avoir payé tôt.
    const couvert: Compte = { id: 'u1', plan: 'atelier', planExpire: dans(10), credits: 2 }
    expect(apresPaiement(couvert, LE_9_SEPT).planExpire).toBe(dans(10) + DUREE_ABONNEMENT)
  })

  it('mais repart d’aujourd’hui quand l’abonnement était échu', () => {
    const echu: Compte = { id: 'u1', plan: 'atelier', planExpire: dans(-40), credits: 0 }
    expect(apresPaiement(echu, LE_9_SEPT).planExpire).toBe(LE_9_SEPT.getTime() + DUREE_ABONNEMENT)
  })

  it('recharge au plein sans additionner', () => {
    // L'abonnement paie un mois d'usage, pas un stock qu'on accumule.
    const restant: Compte = { id: 'u1', plan: 'atelier', planExpire: dans(10), credits: 37 }
    expect(apresPaiement(restant, LE_9_SEPT).credits).toBe(CREDITS_ATELIER)
  })
})
