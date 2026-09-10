import { describe, expect, it } from 'vitest'
import {
  DUREE_CONVERSATION_MS, TOURS_PAR_CONVERSATION, premierTour, relireLaissez, signerLaissez,
  tourSuivant,
} from '../src/conversation.js'

/**
 * Le laissez-passer d'une conversation.
 *
 * Un outil coûte un crédit ; une conversation en fabrique un, en plusieurs
 * tours. Faire payer chaque tour rendrait la discussion impossible — quelqu'un
 * qui a cinq essais n'ose pas dire « ajoute une colonne » si ça lui coûte le
 * cinquième de ce qu'il a.
 *
 * Ce qui est éprouvé ici est donc la seule chose qui empêche la composition
 * gratuite à volonté : un compteur de tours que le navigateur renvoie est un
 * compteur qu'on remet à zéro dans les outils de développement.
 */

const SECRET = 'un-secret-de-serveur'
const LE_9_SEPT = new Date('2026-09-09T07:45:00.000Z')

describe('un laissez-passer', () => {
  it('se relit quand c’est le serveur qui l’a signé', async () => {
    const jeton = await signerLaissez(premierTour('compte-1', LE_9_SEPT), SECRET)
    const relu = await relireLaissez(jeton, SECRET, LE_9_SEPT)
    expect(relu).toMatchObject({ compteId: 'compte-1', tours: 1 })
  })

  it('ne se fabrique pas sans le secret', async () => {
    const jeton = await signerLaissez(premierTour('compte-1', LE_9_SEPT), 'un-autre-secret')
    expect(await relireLaissez(jeton, SECRET, LE_9_SEPT)).toBeNull()
  })

  it('ne se rafistole pas non plus', async () => {
    /*
     * Le cas qui compte : quelqu'un lit son jeton — il est en clair — remet le
     * compteur de tours à zéro et le renvoie. La signature ne suit pas.
     */
    const jeton = await signerLaissez({ compteId: 'c', tours: 7, expire: 9e15 }, SECRET)
    const rafistole = jeton.replace('.7.', '.0.')
    expect(await relireLaissez(rafistole, SECRET, LE_9_SEPT)).toBeNull()
  })

  it('ne se prête pas à un autre compte', async () => {
    const jeton = await signerLaissez(premierTour('compte-1', LE_9_SEPT), SECRET)
    const vole = jeton.replace('compte-1', 'compte-2')
    expect(await relireLaissez(vole, SECRET, LE_9_SEPT)).toBeNull()
  })

  it('périme, pour qu’une conversation abandonnée ne serve pas un mois plus tard', async () => {
    const jeton = await signerLaissez(premierTour('compte-1', LE_9_SEPT), SECRET)
    const plusTard = new Date(LE_9_SEPT.getTime() + DUREE_CONVERSATION_MS + 1)
    expect(await relireLaissez(jeton, SECRET, plusTard)).toBeNull()
  })

  it('s’épuise au huitième tour : au-delà, la conversation tourne', async () => {
    let laissez = premierTour('compte-1', LE_9_SEPT)
    for (let i = 1; i < TOURS_PAR_CONVERSATION; i++) {
      const jeton = await signerLaissez(laissez, SECRET)
      const relu = await relireLaissez(jeton, SECRET, LE_9_SEPT)
      expect(relu, `le tour ${i} aurait dû passer`).not.toBeNull()
      laissez = tourSuivant(relu as never)
    }
    const epuise = await signerLaissez(laissez, SECRET)
    expect(await relireLaissez(epuise, SECRET, LE_9_SEPT)).toBeNull()
  })

  it('refuse ce qui n’a pas la forme d’un jeton, sans dire lequel des refus c’est', async () => {
    // Distinguer « ta signature est fausse » de « ton jeton est périmé »
    // apprend à qui essaie lequel des deux corriger.
    for (const brut of ['', 'x', 'c.1.2', 'c.1.2.3.4', 'c.abc.2.sig', '..0.']) {
      expect(await relireLaissez(brut, SECRET, LE_9_SEPT)).toBeNull()
    }
  })
})
