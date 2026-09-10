import { CREDITS_ESSAI, premierTour, signerLaissez } from '@a237/comptes'
import type { Seance } from '@a237/comptes'
import { describe, expect, it, vi } from 'vitest'
import { MAX_MESSAGE, MAX_MESSAGES, accorder, estUnRefus } from '../src/conversation.js'

/**
 * Ce qui décide, avant qu'un octet parte chez le modèle.
 *
 * Un outil coûte un crédit. Une conversation en fabrique un, en plusieurs
 * tours, et faire payer chaque tour la rendrait impossible : quelqu'un qui a
 * cinq essais n'ose pas dire « ajoute une colonne » si ça lui coûte le
 * cinquième de ce qu'il a.
 *
 * Tout le reste en découle : « c'est la suite d'une conversation » ne se croit
 * pas sur parole, sinon la composition est gratuite à volonté.
 */

const SECRET = 'un-secret-de-serveur'
const LE_9_SEPT = new Date('2026-09-09T07:45:00.000Z')

function seance(credits = CREDITS_ESSAI, id = 'compte-1'): Seance & { pris: number } {
  const s = {
    compte: { id, plan: 'essai' as const, planExpire: null, credits },
    maintenant: LE_9_SEPT,
    pris: 0,
    prendreUnCredit: vi.fn(() => {
      if (s.compte.credits - s.pris <= 0) return Promise.resolve(false)
      s.pris++
      return Promise.resolve(true)
    }),
    rendreUnCredit: vi.fn(() => Promise.resolve()),
    journaliser: vi.fn(() => Promise.resolve()),
  }
  return s as never
}

const DIS = (texte: string) => [{ qui: 'personne', texte }]

describe('le premier tour', () => {
  it('prend un crédit, et rend un laissez-passer', async () => {
    const s = seance()
    const a = await accorder({ messages: DIS('un suivi de livraisons') }, s, SECRET)
    expect(estUnRefus(a)).toBe(false)
    if (estUnRefus(a)) return
    expect(a.paye).toBe(true)
    expect(a.laissez.tours).toBe(1)
    expect(s.pris).toBe(1)
  })

  it('refuse quand il n’y a plus de crédit, sans faire croire à une panne', async () => {
    const a = await accorder({ messages: DIS('un suivi de livraisons') }, seance(0), SECRET)
    expect(estUnRefus(a) && a.statut).toBe(402)
  })

  it('n’envoie qu’un schéma quand la famille est déjà connue', async () => {
    // C'est ce qui rend l'affinage abordable : on ne repaie pas la description
    // d'un formulaire pour retoucher une page.
    const a = await accorder(
      { messages: DIS('ajoute mes horaires'), outil: { sections: [] } },
      seance(),
      SECRET,
    )
    expect(!estUnRefus(a) && a.famille).toBe('page')
  })
})

describe('les tours suivants', () => {
  async function laissez(tours = 1, compteId = 'compte-1'): Promise<string> {
    return signerLaissez({ ...premierTour(compteId, LE_9_SEPT), tours }, SECRET)
  }

  it('ne prennent rien : le crédit est déjà payé', async () => {
    const s = seance()
    const a = await accorder(
      { messages: DIS('ajoute une colonne'), conversation: await laissez() },
      s,
      SECRET,
    )
    expect(!estUnRefus(a) && a.paye).toBe(false)
    expect(s.pris).toBe(0)
  })

  it('avancent le compteur, pour que la conversation ait un fond', async () => {
    const a = await accorder(
      { messages: DIS('encore'), conversation: await laissez(3) },
      seance(),
      SECRET,
    )
    expect(!estUnRefus(a) && a.laissez.tours).toBe(4)
  })

  it('font payer quand le laissez-passer a été rafistolé', async () => {
    /*
     * Le cas qui compte : quelqu'un lit son jeton — il est en clair — remet le
     * compteur à zéro et le renvoie. Il n'y a pas de refus : on traite comme
     * un premier tour, ce qui prend un crédit. Au bon compte.
     */
    const s = seance()
    const vrai = await laissez(5)
    const a = await accorder(
      { messages: DIS('encore'), conversation: vrai.replace('.5.', '.0.') },
      s,
      SECRET,
    )
    expect(!estUnRefus(a) && a.paye).toBe(true)
    expect(s.pris).toBe(1)
  })

  it('font payer quand le laissez-passer est celui d’un autre compte', async () => {
    const s = seance(CREDITS_ESSAI, 'compte-1')
    const a = await accorder(
      { messages: DIS('encore'), conversation: await laissez(2, 'compte-2') },
      s,
      SECRET,
    )
    expect(!estUnRefus(a) && a.paye).toBe(true)
  })

  it('font payer une fois le fond de la conversation atteint', async () => {
    // Au-delà, la conversation n'affine plus, elle tourne. Repartir reprend un
    // crédit et remet les idées à plat.
    const s = seance()
    const a = await accorder(
      { messages: DIS('encore'), conversation: await laissez(8) },
      s,
      SECRET,
    )
    expect(!estUnRefus(a) && a.paye).toBe(true)
  })
})

describe('ce qui arrive du client, et qui n’est pas cru', () => {
  it('refuse une conversation vide, ou qui ne finit pas sur une question', async () => {
    for (const messages of [
      [],
      [{ qui: 'agent', texte: 'Voilà.' }],
      [{ qui: 'personne', texte: '   ' }],
      'pas un tableau',
    ]) {
      const a = await accorder({ messages }, seance(), SECRET)
      expect(estUnRefus(a) && a.statut, JSON.stringify(messages)).toBe(400)
    }
  })

  it('refuse une conversation qui ne tiendrait pas dans une invite budgétée', async () => {
    const trop = Array.from({ length: MAX_MESSAGES + 1 }, () => ({ qui: 'personne', texte: 'x' }))
    expect(estUnRefus(await accorder({ messages: trop }, seance(), SECRET))).toBe(true)
  })

  it('coupe un message trop long plutôt que de le refuser', async () => {
    // Quelqu'un qui colle un paragraphe entier a quand même une demande
    // dedans, et la refuser ne lui apprend rien.
    const a = await accorder({ messages: DIS('a'.repeat(2_000)) }, seance(), SECRET)
    expect(!estUnRefus(a) && a.conversation.at(-1)?.texte.length).toBe(MAX_MESSAGE)
  })

  it('remet l’outil dans la conversation, juste avant le dernier mot', async () => {
    /*
     * C'est ainsi que l'affinage marche, sans protocole de différences : le
     * modèle voit ce qu'il a rendu, et la personne lui dit quoi y changer.
     */
    const a = await accorder(
      {
        messages: [
          { qui: 'personne', texte: 'un suivi' },
          { qui: 'agent', texte: 'Voilà ton suivi.' },
          { qui: 'personne', texte: 'ajoute une colonne date' },
        ],
        outil: { colonnes: [{ clef: 'client' }] },
      },
      seance(),
      SECRET,
    )
    if (estUnRefus(a)) throw new Error('refusé')
    expect(a.conversation.at(-1)?.texte).toBe('ajoute une colonne date')
    expect(a.conversation.at(-2)?.texte).toContain('"clef":"client"')
    expect(a.conversation.at(-2)?.qui).toBe('agent')
  })

  it('n’emporte qu’un seul état de l’outil, le dernier', async () => {
    // Garder les précédents doublerait le coût de chaque tour pour montrer des
    // versions que personne ne veut plus.
    const a = await accorder(
      { messages: DIS('encore'), outil: { colonnes: [] } },
      seance(),
      SECRET,
    )
    if (estUnRefus(a)) throw new Error('refusé')
    expect(a.conversation.filter((t) => t.texte.includes('tel qu’il est'))).toHaveLength(1)
  })
})
