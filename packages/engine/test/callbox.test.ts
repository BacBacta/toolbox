import { describe, expect, it } from 'vitest'
import {
  MAX_OPERATIONS, callbox, callboxCard, callboxShare, commissionDe,
  enregistrerOperation, fixerCommission, journees, jourWAT, operationsDuJour,
  montantF, resteAuClient, retirerOperation, totauxCallbox, valider,
} from '../src/index.js'
import type { EtatCallbox, RenderContext } from '../src/index.js'

const LE_9_SEPT = new Date('2026-09-09T07:45:00.000Z')
const CTX: RenderContext = { lien: 'atl.cm/c/ZBV3', maintenant: LE_9_SEPT }

const CABINE: EtatCallbox = {
  ...callbox.defaults,
  operations: [
    { montant: 3_000, commission: 100, heure: '08h10', jour: '2026-09-08' },
    { montant: 40_000, commission: 500, heure: '09h30', jour: '2026-09-09' },
    { montant: 12_000, commission: 200, heure: '11h05', jour: '2026-09-09' },
    { montant: 250_000, commission: 1_000, heure: '15h40', jour: '2026-09-09' },
  ],
}

describe('le call-box', () => {
  it('part avec une grille utilisable, et aucune opération', () => {
    expect(valider(callbox.schema, callbox.defaults)).toEqual([])
    expect(callbox.defaults.operations).toEqual([])
    // Une grille vide obligerait à saisir quatre tranches avant de calculer
    // quoi que ce soit. Celle-ci est un tarif d'usage, pas celui de quelqu'un.
    expect(callbox.defaults.tranches).toHaveLength(4)
  })

  it('lit les tranches dans l’ordre, la première qui couvre l’emporte', () => {
    const g = callbox.defaults.tranches
    expect(commissionDe(g, 1)).toBe(100)
    expect(commissionDe(g, 5_000)).toBe(100)
    expect(commissionDe(g, 5_001)).toBe(200)
    expect(commissionDe(g, 25_000)).toBe(200)
    expect(commissionDe(g, 100_000)).toBe(500)
    expect(commissionDe(g, 100_001)).toBe(1_000)
    expect(commissionDe(g, 9_000_000)).toBe(1_000)
  })

  it('attrape tout le reste avec la tranche de plafond zéro', () => {
    // Sans elle, un montant au-dessus de la plus haute tranche ne serait pas
    // tarifé du tout.
    const sansOuverte = [{ plafond: 5_000, commission: 100 }]
    expect(commissionDe(sansOuverte, 1_000_000)).toBe(100)
    expect(commissionDe([], 1_000)).toBe(0)
  })

  it('dit ce que le client reçoit, jamais moins que rien', () => {
    expect(resteAuClient(callbox.defaults.tranches, 10_000)).toBe(9_800)
    // Une commission plus grosse que le montant ne rend pas d'argent négatif.
    expect(resteAuClient([{ plafond: 0, commission: 500 }], 100)).toBe(0)
  })

  it('compte le gain, le volume et le nombre du jour', () => {
    const duJour = operationsDuJour(CABINE.operations, '2026-09-09')
    expect(totauxCallbox(duJour)).toEqual({ gagne: 1_700, volume: 302_000, nombre: 3 })
  })

  it('regroupe les journées sur le calendrier de Douala', () => {
    // Deux opérations du même après-midi doivent tomber dans le même seau ;
    // un `toISOString()` les séparerait dès 1 h du matin, heure de Douala.
    expect(jourWAT(new Date('2026-09-09T23:30:00.000Z'))).toBe('2026-09-10')
    expect(jourWAT(new Date('2026-09-09T22:30:00.000Z'))).toBe('2026-09-09')
    expect(journees(CABINE.operations)).toEqual([
      { jour: '2026-09-08', gagne: 100, nombre: 1 },
      { jour: '2026-09-09', gagne: 1_700, nombre: 3 },
    ])
  })

  it('enregistre une opération avec la commission du moment', () => {
    const apres = enregistrerOperation(callbox.defaults, 30_000, '16h20', '2026-09-09')
    expect(apres.operations).toEqual([
      { montant: 30_000, commission: 500, heure: '16h20', jour: '2026-09-09' },
    ])
    expect(valider(callbox.schema, apres)).toEqual([])
    // Un montant nul n'est pas une opération.
    expect(enregistrerOperation(callbox.defaults, 0, '16h20', '2026-09-09').operations).toEqual([])
  })

  it('refuse d’enregistrer au-delà du plafond du registre', () => {
    const pleine: EtatCallbox = {
      ...callbox.defaults,
      operations: Array.from({ length: MAX_OPERATIONS }, () => ({
        montant: 1_000, commission: 100, heure: '08h00', jour: '2026-09-09',
      })),
    }
    expect(enregistrerOperation(pleine, 5_000, '09h00', '2026-09-09')).toBe(pleine)
  })

  it('ne recalcule pas le passé quand la grille change', () => {
    // Un tarif qu'on relève aujourd'hui ne se rattrape pas sur les transferts
    // d'hier, et recalculer tout le registre ferait bouger la recette de la
    // semaine dernière.
    const releve = fixerCommission(CABINE, 1, 250)
    expect(releve.tranches[1]?.commission).toBe(250)
    expect(releve.operations).toEqual(CABINE.operations)
    // Les suivantes, elles, suivent le nouveau tarif.
    const suite = enregistrerOperation(releve, 12_000, '17h00', '2026-09-09')
    expect(suite.operations.at(-1)?.commission).toBe(250)
    expect(fixerCommission(CABINE, 9, 300)).toBe(CABINE)
  })

  it('retire une opération sans toucher aux autres', () => {
    const apres = retirerOperation(CABINE, 1)
    expect(apres.operations).toHaveLength(3)
    expect(apres.operations.map((o) => o.heure)).toEqual(['08h10', '11h05', '15h40'])
    expect(retirerOperation(CABINE, 9)).toBe(CABINE)
  })

  it('ne met que la journée sur la carte, la plus récente en tête', () => {
    const carte = callboxCard(CABINE, CTX)
    expect(carte.kicker).toBe('CALL-BOX')
    expect(carte.big).toBe(montantF(1_700))
    expect(carte.items.map((i) => i.n.slice(0, 5))).toEqual(['15h40', '11h05', '09h30'])
    // La veille n'y est pas : c'est la caisse du jour qu'on arrête.
    expect(JSON.stringify(carte.items)).not.toContain('08h10')
  })

  it('prévient que la recette du jour n’est pas une information de groupe', () => {
    const partage = callboxShare(CABINE, CTX)
    expect(partage.warn).toContain('pas pour un groupe')
    expect(partage.name).toBe('callbox-2026-09-09')
    // Un call-box encaisse comptant : personne à relancer.
    expect(partage.relances).toEqual([])
    expect(partage.relancesVides).toContain('comptant')
  })
})
