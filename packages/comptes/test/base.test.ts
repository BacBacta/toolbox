import { describe, expect, it } from 'vitest'
import {
  compteDeLAppareil, compteParCode, compteParId, coutMoyenXaf, ecrireSuite, journaliser,
  ouvrirPaiement, paiementParReference, poserCode, prendreUnCredit, rattacherAppareil, rendreUnCredit,
} from '../src/base.js'
import { appliquerRappel, montantDuMois } from '../src/paiement.js'
import type { Paiement } from '../src/paiement.js'
import { CREDITS_ATELIER, CREDITS_ESSAI, DUREE_ABONNEMENT } from '../src/plan.js'
import { baseDEssai } from './sqlite.js'

const LE_9_SEPT = new Date('2026-09-09T07:45:00.000Z')
const A = 'a'.repeat(64)
const B = 'b'.repeat(64)

describe('le compte d’un appareil', () => {
  it('s’ouvre tout seul, en essai, à la première visite', async () => {
    const db = baseDEssai()
    const c = await compteDeLAppareil(db, A, LE_9_SEPT)
    expect(c.plan).toBe('essai')
    expect(c.credits).toBe(CREDITS_ESSAI)
  })

  it('et c’est le même à la deuxième', async () => {
    const db = baseDEssai()
    const un = await compteDeLAppareil(db, A, LE_9_SEPT)
    const deux = await compteDeLAppareil(db, A, LE_9_SEPT)
    expect(deux.id).toBe(un.id)
  })

  it('et une deuxième visite ne laisse pas un compte orphelin derrière elle', async () => {
    /*
     * Un compte candidat est ouvert avant de tenter le lien, parce que la clé
     * étrangère l'exige. S'il ne sert pas — appareil déjà connu, ou course
     * perdue entre deux requêtes simultanées — il doit disparaître, sinon
     * chaque visite laisse un compte vide et cinq crédits inutilisés en base.
     */
    const db = baseDEssai()
    await compteDeLAppareil(db, A, LE_9_SEPT)
    await compteDeLAppareil(db, A, LE_9_SEPT)
    await compteDeLAppareil(db, A, LE_9_SEPT)

    const compte = await db.prepare('SELECT COUNT(*) AS n FROM comptes').first<{ n: number }>()
    expect(compte?.n).toBe(1)
  })

  it('deux appareils sont deux comptes', async () => {
    const db = baseDEssai()
    const un = await compteDeLAppareil(db, A, LE_9_SEPT)
    const deux = await compteDeLAppareil(db, B, LE_9_SEPT)
    expect(deux.id).not.toBe(un.id)
  })

  it('et une visite ne remet pas les crédits à cinq', async () => {
    // `INSERT OR IGNORE` sur les comptes : sans lui, revenir rechargerait, et
    // l'essai serait sans fin.
    const db = baseDEssai()
    const c = await compteDeLAppareil(db, A, LE_9_SEPT)
    await prendreUnCredit(db, c.id)
    expect((await compteDeLAppareil(db, A, LE_9_SEPT)).credits).toBe(CREDITS_ESSAI - 1)
  })
})

describe('les crédits', () => {
  it('se retirent un par un, et pas au-delà de zéro', async () => {
    const db = baseDEssai()
    const c = await compteDeLAppareil(db, A, LE_9_SEPT)
    for (let i = 0; i < CREDITS_ESSAI; i++) expect(await prendreUnCredit(db, c.id)).toBe(true)
    expect(await prendreUnCredit(db, c.id)).toBe(false)
    expect((await compteParId(db, c.id))?.credits).toBe(0)
  })

  it('ne se prennent pas deux fois quand il n’en reste qu’un', async () => {
    /*
     * La condition est dans la requête. Deux appels simultanés d'un compte à
     * qui il reste un crédit passeraient tous les deux un contrôle fait en
     * JavaScript, et on paierait deux générations pour un crédit.
     */
    const db = baseDEssai()
    const c = await compteDeLAppareil(db, A, LE_9_SEPT)
    for (let i = 0; i < CREDITS_ESSAI - 1; i++) await prendreUnCredit(db, c.id)

    const deux = await Promise.all([prendreUnCredit(db, c.id), prendreUnCredit(db, c.id)])
    expect(deux.filter(Boolean)).toHaveLength(1)
    expect((await compteParId(db, c.id))?.credits).toBe(0)
  })

  it('se rendent quand l’appel n’est jamais parti', async () => {
    const db = baseDEssai()
    const c = await compteDeLAppareil(db, A, LE_9_SEPT)
    await prendreUnCredit(db, c.id)
    await rendreUnCredit(db, c.id)
    expect((await compteParId(db, c.id))?.credits).toBe(CREDITS_ESSAI)
  })
})

describe('le journal des coûts', () => {
  it('retient ce que chaque génération a coûté', async () => {
    const db = baseDEssai()
    const c = await compteDeLAppareil(db, A, LE_9_SEPT)
    await journaliser(db, { compteId: c.id, etage: 2, jetonsEntree: 800, jetonsSortie: 300, coutXaf: 0.4, ok: true }, LE_9_SEPT)
    await journaliser(db, { compteId: c.id, etage: 2, jetonsEntree: 900, jetonsSortie: 200, coutXaf: 0.2, ok: false }, LE_9_SEPT)

    const { appels, moyenne } = await coutMoyenXaf(db)
    expect(appels).toBe(2)
    // Le § 8 plafonne cette moyenne à 1 F. Sans journal, elle ne se mesure pas.
    expect(moyenne).toBeCloseTo(0.3, 5)
    expect(moyenne).toBeLessThan(1)
  })
})

describe('la récupération', () => {
  it('rattache un appareil neuf au compte du code', async () => {
    const db = baseDEssai()
    const ancien = await compteDeLAppareil(db, A, LE_9_SEPT)
    await poserCode(db, ancien.id, 'empreinte-du-code')

    const trouve = await compteParCode(db, 'empreinte-du-code')
    expect(trouve?.id).toBe(ancien.id)

    await rattacherAppareil(db, B, ancien.id, LE_9_SEPT)
    expect((await compteDeLAppareil(db, B, LE_9_SEPT)).id).toBe(ancien.id)
  })

  it('et un appareil déjà connu change de compte sans en créer un', async () => {
    const db = baseDEssai()
    const premier = await compteDeLAppareil(db, A, LE_9_SEPT)
    const second = await compteDeLAppareil(db, B, LE_9_SEPT)
    await rattacherAppareil(db, B, premier.id, LE_9_SEPT)

    expect((await compteDeLAppareil(db, B, LE_9_SEPT)).id).toBe(premier.id)
    // L'ancien compte demeure : il porte peut-être d'autres appareils.
    expect(await compteParId(db, second.id)).not.toBeNull()
  })

  it('un code inconnu ne mène à personne', async () => {
    const db = baseDEssai()
    await compteDeLAppareil(db, A, LE_9_SEPT)
    expect(await compteParCode(db, 'pas-un-code')).toBeNull()
  })
})

describe('un paiement, de bout en bout', () => {
  async function prepare(): Promise<{ db: ReturnType<typeof baseDEssai>; p: Paiement }> {
    const db = baseDEssai()
    const c = await compteDeLAppareil(db, A, LE_9_SEPT)
    const p: Paiement = {
      id: 'p1', compteId: c.id, fournisseur: 'faux', reference: 'ref-1',
      montantXaf: montantDuMois(), etat: 'attente', telephone: '+237699412708',
      creeLe: LE_9_SEPT.getTime(),
    }
    await ouvrirPaiement(db, p)
    return { db, p }
  }

  it('mène du réussi à l’abonnement, en une seule transaction', async () => {
    const { db, p } = await prepare()
    const compte = await compteParId(db, p.compteId)
    if (compte === null) throw new Error('impossible')

    const suite = appliquerRappel(p, compte, { reference: 'ref-1', reussi: true, montantXaf: montantDuMois() }, LE_9_SEPT)
    await ecrireSuite(db, suite, '{"brut":true}')

    const apres = await compteParId(db, p.compteId)
    expect(apres?.plan).toBe('atelier')
    expect(apres?.credits).toBe(CREDITS_ATELIER)
    expect(apres?.planExpire).toBe(LE_9_SEPT.getTime() + DUREE_ABONNEMENT)
    expect((await paiementParReference(db, 'faux', 'ref-1'))?.etat).toBe('reussi')
  })

  it('rejoué trois fois, il ne donne pas trois mois', async () => {
    // Le critère d'arrêt de la phase 3, joué contre la base.
    const { db, p } = await prepare()
    const rappel = { reference: 'ref-1', reussi: true, montantXaf: montantDuMois() }

    for (let i = 0; i < 4; i++) {
      const paiement = await paiementParReference(db, 'faux', 'ref-1')
      const compte = await compteParId(db, p.compteId)
      if (compte === null) throw new Error('impossible')
      await ecrireSuite(db, appliquerRappel(paiement, compte, rappel, LE_9_SEPT), '{}')
    }

    const apres = await compteParId(db, p.compteId)
    expect(apres?.planExpire).toBe(LE_9_SEPT.getTime() + DUREE_ABONNEMENT)
    expect(apres?.credits).toBe(CREDITS_ATELIER)
  })

  it('et la base refuse elle-même une deuxième ligne pour la même référence', async () => {
    // Le premier des deux verrous : `UNIQUE(fournisseur, reference)`.
    const { db, p } = await prepare()
    await expect(ouvrirPaiement(db, { ...p, id: 'p2' })).rejects.toThrow()
  })

  it('le numéro suit le compte qui vient de payer', async () => {
    /*
     * Un numéro désigne une personne. Il peut appartenir à un compte
     * abandonné — téléphone perdu, appareil neuf — et il va alors au compte
     * dont cette personne se sert aujourd'hui, sans que l'ancien perde autre
     * chose que le numéro.
     */
    const { db, p } = await prepare()
    const premier = await compteParId(db, p.compteId)
    if (premier === null) throw new Error('impossible')
    await ecrireSuite(db, appliquerRappel(p, premier, { reference: 'ref-1', reussi: true, montantXaf: montantDuMois() }, LE_9_SEPT), '{}')

    const neuf = await compteDeLAppareil(db, B, LE_9_SEPT)
    const p2: Paiement = { ...p, id: 'p2', compteId: neuf.id, reference: 'ref-2' }
    await ouvrirPaiement(db, p2)
    await ecrireSuite(db, appliquerRappel(p2, neuf, { reference: 'ref-2', reussi: true, montantXaf: montantDuMois() }, LE_9_SEPT), '{}')

    const apres = await compteParId(db, neuf.id)
    expect(apres?.plan).toBe('atelier')
    // L'ancien garde son abonnement, il ne perd que le numéro.
    expect((await compteParId(db, premier.id))?.plan).toBe('atelier')
  })

  it('un versement partiel laisse le compte en essai', async () => {
    const { db, p } = await prepare()
    const compte = await compteParId(db, p.compteId)
    if (compte === null) throw new Error('impossible')
    await ecrireSuite(db, appliquerRappel(p, compte, { reference: 'ref-1', reussi: true, montantXaf: 100 }, LE_9_SEPT), '{}')

    expect((await compteParId(db, p.compteId))?.plan).toBe('essai')
    expect((await paiementParReference(db, 'faux', 'ref-1'))?.etat).toBe('echoue')
  })
})
