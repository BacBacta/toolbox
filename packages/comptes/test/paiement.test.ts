import { describe, expect, it } from 'vitest'
import { ENTETE_SIGNATURE, fauxFournisseur, memeSignature, signer } from '../src/faux.js'
import { appliquerRappel, montantDuMois, normaliserTelephone } from '../src/paiement.js'
import type { Paiement, Rappel } from '../src/paiement.js'
import { CREDITS_ATELIER, DUREE_ABONNEMENT, compteNeuf } from '../src/plan.js'

const LE_9_SEPT = new Date('2026-09-09T07:45:00.000Z')
const SECRET = 'un-secret-qui-ne-part-jamais-au-client'

const EN_ATTENTE: Paiement = {
  id: 'p1', compteId: 'u1', fournisseur: 'faux', reference: 'ref-1',
  montantXaf: montantDuMois(), etat: 'attente', telephone: '+237699412708', creeLe: 0,
}
const RAPPEL: Rappel = { reference: 'ref-1', reussi: true, montantXaf: montantDuMois() }

describe('la signature du rappel', () => {
  const f = fauxFournisseur(SECRET)
  const corps = JSON.stringify({ reference: 'ref-1', reussi: true, montantXaf: 1000 })

  it('laisse passer ce qui est signé', async () => {
    const entetes = new Headers({ [ENTETE_SIGNATURE]: await signer(corps, SECRET) })
    expect(await f.lireRappel(corps, entetes)).toEqual({
      reference: 'ref-1', reussi: true, montantXaf: 1000,
    })
  })

  it('refuse ce qui ne l’est pas', async () => {
    // Sans ce contrôle, n'importe qui s'offre un abonnement avec `curl`.
    expect(await f.lireRappel(corps, new Headers())).toBeNull()
    expect(await f.lireRappel(corps, new Headers({ [ENTETE_SIGNATURE]: 'a'.repeat(64) }))).toBeNull()
    expect(await f.lireRappel(corps, new Headers({ [ENTETE_SIGNATURE]: await signer(corps, 'autre') })))
      .toBeNull()
  })

  it('refuse un corps modifié après signature', async () => {
    const entetes = new Headers({ [ENTETE_SIGNATURE]: await signer(corps, SECRET) })
    const trafique = JSON.stringify({ reference: 'ref-1', reussi: true, montantXaf: 100_000 })
    expect(await f.lireRappel(trafique, entetes)).toBeNull()
  })

  it('et ce qui n’est pas un rappel, même bien signé', async () => {
    for (const corpsFaux of ['pas du json', '{}', '{"reference":1}', '{"reference":"r","reussi":"oui"}']) {
      const e = new Headers({ [ENTETE_SIGNATURE]: await signer(corpsFaux, SECRET) })
      expect(await f.lireRappel(corpsFaux, e), corpsFaux).toBeNull()
    }
  })

  it('se compare à durée constante', () => {
    expect(memeSignature('abcd', 'abcd')).toBe(true)
    expect(memeSignature('abcd', 'abce')).toBe(false)
    expect(memeSignature('abcd', 'abc')).toBe(false)
  })
})

describe('ce qu’un rappel change', () => {
  it('un paiement en attente devient un mois d’abonnement', () => {
    const suite = appliquerRappel(EN_ATTENTE, compteNeuf('u1'), RAPPEL, LE_9_SEPT)
    expect(suite.sorte).toBe('reussi')
    if (suite.sorte !== 'reussi') throw new Error('impossible')
    expect(suite.paiement.etat).toBe('reussi')
    expect(suite.compte.plan).toBe('atelier')
    expect(suite.compte.credits).toBe(CREDITS_ATELIER)
    expect(suite.compte.planExpire).toBe(LE_9_SEPT.getTime() + DUREE_ABONNEMENT)
  })

  it('rejoué trois fois, il ne change plus rien', () => {
    /*
     * Le critère d'arrêt de la phase 3, § 7. Un rappel se rejoue tout seul :
     * les fournisseurs réessaient quand ils n'ont pas vu notre 200. Sans ce
     * verrou, trois rappels identiques donneraient quatre-vingt-dix jours.
     */
    const premier = appliquerRappel(EN_ATTENTE, compteNeuf('u1'), RAPPEL, LE_9_SEPT)
    if (premier.sorte !== 'reussi') throw new Error('impossible')

    for (let i = 0; i < 3; i++) {
      const rejeu = appliquerRappel(premier.paiement, premier.compte, RAPPEL, LE_9_SEPT)
      expect(rejeu.sorte).toBe('deja-traite')
    }
    expect(premier.compte.planExpire).toBe(LE_9_SEPT.getTime() + DUREE_ABONNEMENT)
  })

  it('un rappel sans paiement connu ne fait rien', () => {
    expect(appliquerRappel(null, compteNeuf('u1'), RAPPEL, LE_9_SEPT).sorte).toBe('inconnu')
  })

  it('un échec annoncé clôt le paiement sans toucher au compte', () => {
    const suite = appliquerRappel(EN_ATTENTE, compteNeuf('u1'), { ...RAPPEL, reussi: false }, LE_9_SEPT)
    expect(suite.sorte).toBe('echoue')
    if (suite.sorte !== 'echoue') throw new Error('impossible')
    expect(suite.paiement.etat).toBe('echoue')
  })

  it('et un versement partiel n’achète pas un mois, même signé', () => {
    // Un fournisseur peut accepter un versement partiel : le rappel est
    // authentique et insuffisant.
    const suite = appliquerRappel(EN_ATTENTE, compteNeuf('u1'), { ...RAPPEL, montantXaf: 100 }, LE_9_SEPT)
    expect(suite.sorte).toBe('echoue')
    if (suite.sorte !== 'echoue') throw new Error('impossible')
    expect(suite.pourquoi).toContain('100 F sur 1000 F')
  })
})

describe('le numéro de téléphone', () => {
  it('s’accepte comme les gens l’écrivent', () => {
    for (const saisi of [
      '699412708', '0699412708', '+237699412708', '237699412708',
      '+237 6 99 41 27 08', '6 99 41 27 08', '699-41-27-08', '(237) 699.41.27.08',
    ]) {
      expect(normaliserTelephone(saisi), saisi).toBe('+237699412708')
    }
  })

  it('et se refuse quand ce n’en est pas un', () => {
    for (const faux of ['', '12345', '799412708', '69941270', '6994127089', 'allo']) {
      expect(normaliserTelephone(faux), faux).toBeNull()
    }
  })
})
