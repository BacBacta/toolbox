import { compteDeLAppareil, combienDeReponses, lireReponses, noterPublication } from '@a237/comptes'
import type { BaseD1 } from '@a237/comptes'
import { ID_COMPOSE_FORMULAIRE, MAX_REPONSES } from '@a237/engine'
import type { FormulaireDemande, Instantane } from '@a237/engine'
import { baseDEssai } from '../../comptes/test/sqlite.js'
import { beforeEach, describe, expect, it } from 'vitest'
import { onRequest } from '../src/worker-lire.js'
import { onRequest as publier } from '../src/worker-publier.js'

/**
 * `POST /d/:lien` — la seule écriture que le produit accepte d'un inconnu.
 *
 * Tout le reste part du téléphone de son propriétaire. Ici, c'est n'importe
 * qui, depuis n'importe où, sans compte et sans script. C'est donc le code le
 * plus exposé du produit, et ce qui suit vérifie les deux moitiés : que la
 * réponse d'une vraie personne arrive bien, et que ce qui n'en est pas une
 * n'arrive pas.
 */

const LIEN = 'K7M2XQ4BN9PZ'
const JETON = 'a'.repeat(64)
const HOTE = 'https://atelier237.pages.dev'

const FORMULAIRE: FormulaireDemande = {
  titre: 'Commandes du week-end',
  kicker: 'TRAITEUR MAMA NGO',
  accroche: 'Commande avant vendredi 18 h.',
  champs: [
    { clef: 'nom', titre: 'Ton nom', sorte: 'texte', obligatoire: true },
    { clef: 'plat', titre: 'Quel plat ?', sorte: 'choix', options: ['Ndolè', 'Eru'] },
    { clef: 'parts', titre: 'Combien de parts ?', sorte: 'nombre' },
  ],
  bouton: 'Envoyer ma commande',
  merci: 'C’est noté, je confirme par WhatsApp.',
}

const INSTANTANE: Instantane = {
  skeleton: ID_COMPOSE_FORMULAIRE,
  nom: FORMULAIRE.titre,
  etat: FORMULAIRE,
  version: 1,
  publieLe: '2026-09-09T07:45:00.000Z',
}

let db: BaseD1

beforeEach(async () => {
  db = baseDEssai()
  const compte = await compteDeLAppareil(db, 'x'.repeat(64), new Date())
  await noterPublication(
    db, { lien: LIEN, compteId: compte.id, skeleton: ID_COMPOSE_FORMULAIRE }, new Date(),
  )
})

function contexte(requete: Request, instantane: unknown = INSTANTANE): never {
  return {
    request: requete,
    params: { lien: LIEN },
    env: {
      INSTANTANES: { get: () => Promise.resolve(instantane) },
      CARTES: { head: () => Promise.resolve(null) },
      COMPTES: db,
    },
  } as never
}

function envoi(corps: Record<string, string>, entetes: Record<string, string> = {}): Request {
  return new Request(`${HOTE}/d/${LIEN}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...entetes },
    body: new URLSearchParams(corps).toString(),
  })
}

describe('la page d’un formulaire', () => {
  it('porte un vrai formulaire qui poste sur sa propre adresse', async () => {
    const r = await onRequest(contexte(new Request(`${HOTE}/d/${LIEN}`)))
    const html = await r.text()
    expect(r.status).toBe(200)
    expect(html).toContain('<form')
    expect(html).toContain('method="post"')
    expect(html).toContain(`action="${HOTE}/d/${LIEN}"`)
  })

  it('sans un seul script : c’est la seule façon que ça marche', async () => {
    // Sur un téléphone d'entrée de gamme, dans le navigateur intégré de
    // WhatsApp, un formulaire qui dépend de JavaScript perd des réponses sans
    // que personne ne le sache.
    const html = await (await onRequest(contexte(new Request(`${HOTE}/d/${LIEN}`)))).text()
    expect(html).not.toContain('<script')
    expect(html).not.toMatch(/\son[a-z]+=/)
  })

  it('ouvre form-action à sa propre origine, et à rien d’autre', async () => {
    /*
     * La politique interdisait tout envoi de formulaire — juste tant qu'aucune
     * page n'en portait, et exactement le mur qui empêche la réponse de partir
     * dès qu'une page en porte.
     */
    const r = await onRequest(contexte(new Request(`${HOTE}/d/${LIEN}`)))
    expect(r.headers.get('content-security-policy')).toContain("form-action 'self'")
  })

  it('et la referme sur une page qui ne reçoit pas', async () => {
    const page = { ...INSTANTANE, skeleton: 'compose-page', etat: { titre: 'x' } }
    const r = await onRequest(contexte(new Request(`${HOTE}/d/${LIEN}`), page))
    expect(r.headers.get('content-security-policy')).toContain("form-action 'none'")
  })

  it('dit où va la réponse, plutôt que « document en lecture seule »', async () => {
    /*
     * Le pied disait « Arrêté le 10 septembre. Document en lecture seule. »
     * sous un formulaire qu'on invite à remplir : c'est une contradiction, et
     * ce qu'une personne veut savoir avant de taper son numéro n'est pas la
     * date de dépôt.
     */
    const html = await (await onRequest(contexte(new Request(`${HOTE}/d/${LIEN}`)))).text()
    expect(html).toContain('Ta réponse va à la personne qui t’a envoyé ce lien')
    expect(html).not.toContain('lecture seule')
  })

  it('ne se met pas en cache : une version d’il y a une minute invite à remplir ce qui vient de fermer', async () => {
    const r = await onRequest(contexte(new Request(`${HOTE}/d/${LIEN}`)))
    expect(r.headers.get('cache-control')).toBe('no-store')
  })
})

describe('une réponse qui arrive', () => {
  it('se range, et renvoie sur la page de remerciement', async () => {
    const r = await onRequest(contexte(envoi({ nom: 'Awa', plat: 'Ndolè', parts: '3' })))
    expect(r.status).toBe(303)
    expect(r.headers.get('location')).toBe(`${HOTE}/d/${LIEN}?merci=1`)

    const lues = await lireReponses(db, LIEN)
    expect(lues).toHaveLength(1)
    expect(JSON.parse(lues[0]?.contenu ?? '{}')).toEqual({ nom: 'Awa', plat: 'Ndolè', parts: '3' })
  })

  it('une redirection, et non la page rendue tout de suite', async () => {
    // Rafraîchir après un POST renvoie la même réponse une deuxième fois, et
    // personne ne le sait avant de compter les commandes.
    const r = await onRequest(contexte(envoi({ nom: 'Awa' })))
    expect(r.status).toBe(303)
  })

  it('et la page de remerciement dit ce qui va se passer', async () => {
    const r = await onRequest(contexte(new Request(`${HOTE}/d/${LIEN}?merci=1`)))
    const html = await r.text()
    expect(html).toContain('je confirme par WhatsApp')
    expect(html).not.toContain('<form')
  })
})

describe('ce qui n’arrive pas', () => {
  it('un robot qui remplit le champ piège repart content, et sans rien laisser', async () => {
    // Un refus lui apprendrait quoi corriger.
    const r = await onRequest(contexte(envoi({ nom: 'Awa', ne_rien_ecrire_ici: 'x' })))
    expect(r.status).toBe(303)
    expect(await combienDeReponses(db, LIEN)).toBe(0)
  })

  it('une réponse à qui il manque l’obligatoire revient sur la page, en le nommant', async () => {
    const r = await onRequest(contexte(envoi({ plat: 'Eru' })))
    const html = await r.text()
    expect(r.status).toBe(200)
    expect(html).toContain('Il manque Ton nom')
    expect(await combienDeReponses(db, LIEN)).toBe(0)
  })

  it('une réponse entièrement vide n’est pas une réponse', async () => {
    await onRequest(contexte(envoi({})))
    expect(await combienDeReponses(db, LIEN)).toBe(0)
  })

  it('un choix qui n’est pas dans la liste ne se range pas', async () => {
    await onRequest(contexte(envoi({ nom: 'Awa', plat: 'Caviar' })))
    const lues = await lireReponses(db, LIEN)
    expect(JSON.parse(lues[0]?.contenu ?? '{}')).toEqual({ nom: 'Awa' })
  })

  it('un champ que le formulaire ne demandait pas est jeté sans un mot', async () => {
    await onRequest(contexte(envoi({ nom: 'Awa', admin: 'oui' })))
    const lues = await lireReponses(db, LIEN)
    expect(Object.keys(JSON.parse(lues[0]?.contenu ?? '{}'))).toEqual(['nom'])
  })

  it('deux envois coup sur coup du même endroit n’en laissent qu’un', async () => {
    const ip = { 'cf-connecting-ip': '41.202.1.1' }
    await onRequest(contexte(envoi({ nom: 'Awa' }, ip)))
    const r = await onRequest(contexte(envoi({ nom: 'Awa encore' }, ip)))
    // On ne dit pas au second qu'il a été écarté : il l'a déjà envoyé.
    expect(r.status).toBe(303)
    expect(await combienDeReponses(db, LIEN)).toBe(1)
  })

  it('mais deux endroits différents passent tous les deux', async () => {
    await onRequest(contexte(envoi({ nom: 'Awa' }, { 'cf-connecting-ip': '41.202.1.1' })))
    await onRequest(contexte(envoi({ nom: 'Paul' }, { 'cf-connecting-ip': '41.202.1.2' })))
    expect(await combienDeReponses(db, LIEN)).toBe(2)
  })

  it('poster sur un devis ne mène nulle part', async () => {
    // Ce n'est pas une erreur du visiteur : c'est quelqu'un qui essaie.
    const devis = { ...INSTANTANE, skeleton: 'devis', etat: {} }
    const r = await onRequest(contexte(envoi({ nom: 'Awa' }), devis))
    expect(r.status).toBe(404)
  })

  it('un corps démesuré ne se range pas', async () => {
    const enorme = new Request(`${HOTE}/d/${LIEN}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `nom=${'a'.repeat(20_000)}`,
    })
    await onRequest(contexte(enorme))
    expect(await combienDeReponses(db, LIEN)).toBe(0)
  })
})

describe('le fond du formulaire', () => {
  it('se referme une fois plein, et le dit sur la page', async () => {
    for (let i = 0; i < MAX_REPONSES; i++) {
      await onRequest(contexte(envoi({ nom: `Client ${i}` })))
    }
    const html = await (await onRequest(contexte(new Request(`${HOTE}/d/${LIEN}`)))).text()
    expect(html).toContain('ne prend plus de réponses')
    expect(html).not.toContain('<form')

    await onRequest(contexte(envoi({ nom: 'Un de trop' })))
    expect(await combienDeReponses(db, LIEN)).toBe(MAX_REPONSES)
  }, 30_000)
})

describe('publier un formulaire note son propriétaire', () => {
  function contextePublication(entetes: Record<string, string> = {}): never {
    return {
      request: new Request(`${HOTE}/api/publier`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...entetes },
        body: JSON.stringify({ lien: 'M9PP658V8VJC', instantane: INSTANTANE }),
      }),
      env: { INSTANTANES: { get: () => Promise.resolve(null), put: () => Promise.resolve() }, COMPTES: db },
    } as never
  }

  it('refuse un dépôt sans appareil : les réponses ne reviendraient à personne', async () => {
    const r = await publier(contextePublication())
    expect(r.status).toBe(401)
  })

  it('note l’appareil qui l’a déposé', async () => {
    const r = await publier(contextePublication({ authorization: `Appareil ${JETON}` }))
    expect(r.status).toBe(200)
    const { proprietaireDe } = await import('@a237/comptes')
    expect(await proprietaireDe(db, 'M9PP658V8VJC')).not.toBeNull()
  })

  it('ne demande rien pour une page, qui ne reçoit pas', async () => {
    const page: Instantane = {
      skeleton: 'compose-page', nom: 'Vitrine', version: 1,
      publieLe: '2026-09-09T07:45:00.000Z',
      etat: {
        titre: 'Quincaillerie', kicker: 'QUINCAILLERIE', accroche: 'Tôles et ciment.',
        sections: [{ titre: 'Prix', sorte: 'prix', lignes: [{ nom: 'Ciment', valeur: '5 800 F' }] }],
      },
    }
    const contexte = {
      request: new Request(`${HOTE}/api/publier`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lien: '9SY6G4S33DJH', instantane: page }),
      }),
      env: { INSTANTANES: { get: () => Promise.resolve(null), put: () => Promise.resolve() }, COMPTES: db },
    } as never
    expect((await publier(contexte)).status).toBe(200)
  })
})
