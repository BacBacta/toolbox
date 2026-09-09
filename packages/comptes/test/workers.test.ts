import { describe, expect, it } from 'vitest'
import { compteParId, coutMoyenXaf } from '../src/base.js'
import type { BaseD1 } from '../src/base.js'
import { ENTETE_SIGNATURE, signer } from '../src/faux.js'
import { CREDITS_ATELIER, CREDITS_ESSAI } from '../src/plan.js'
import { onRequest as compte } from '../src/worker-compte.js'
import { onRequest as pay } from '../src/worker-pay.js'
import { baseDEssai } from './sqlite.js'

const JETON = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'
const AUTRE = '0f9e8d7c6b5a40312918273645fedcba'
const SECRET = 'un-secret-qui-ne-part-jamais-au-client'
const BASE = 'https://exemple.cm'

function req(chemin: string, options: RequestInit & { jeton?: string | null } = {}): Request {
  const { jeton = JETON, ...reste } = options
  const entetes = new Headers(reste.headers)
  if (jeton !== null) entetes.set('authorization', `Appareil ${jeton}`)
  return new Request(`${BASE}${chemin}`, { ...reste, headers: entetes })
}

const env = (db: BaseD1): Record<string, string | BaseD1> => ({
  COMPTES: db,
  A237_PAIEMENT_SECRET: SECRET,
})

describe('/api/compte', () => {
  it('ouvre un compte à la première visite, sans rien demander', async () => {
    const db = baseDEssai()
    const r = await compte({ request: req('/api/compte'), env: env(db) })
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ plan: 'essai', credits: CREDITS_ESSAI, expire: null, aUnCode: false })
  })

  it('ne se met jamais en cache', async () => {
    const db = baseDEssai()
    const r = await compte({ request: req('/api/compte'), env: env(db) })
    expect(r.headers.get('cache-control')).toBe('no-store')
  })

  it('refuse un appareil qui ne se présente pas', async () => {
    const db = baseDEssai()
    for (const jeton of [null, 'pas-un-jeton', '']) {
      const r = await compte({ request: req('/api/compte', { jeton }), env: env(db) })
      expect(r.status, String(jeton)).toBe(401)
    }
  })

  it('donne un code de récupération, une seule fois', async () => {
    const db = baseDEssai()
    const r = await compte({ request: req('/api/compte/code', { method: 'POST' }), env: env(db) })
    const { code } = (await r.json()) as { code: string }
    expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)

    // Il n'est rangé nulle part en clair : personne, nous compris, ne peut le
    // retrouver. C'est ce qui fait qu'il vaut quelque chose.
    const etat = await (await compte({ request: req('/api/compte'), env: env(db) })).text()
    expect(JSON.parse(etat)).toMatchObject({ aUnCode: true })
    expect(etat).not.toContain(code.replace(/-/g, ''))
  })

  it('et un autre appareil retrouve le compte avec ce code', async () => {
    const db = baseDEssai()
    const premier = await compte({ request: req('/api/compte'), env: env(db) })
    void premier
    const r = await compte({ request: req('/api/compte/code', { method: 'POST' }), env: env(db) })
    const { code } = (await r.json()) as { code: string }

    const repris = await compte({
      request: req('/api/compte/reprendre', {
        method: 'POST', jeton: AUTRE, body: JSON.stringify({ code }),
      }),
      env: env(db),
    })
    expect(repris.status).toBe(200)

    // Les deux appareils voient désormais le même compte : un crédit dépensé
    // sur l'un se voit sur l'autre.
    const compteId = await db.prepare('SELECT COUNT(DISTINCT compte_id) AS n FROM appareils')
      .first<{ n: number }>()
    expect(compteId?.n).toBe(1)
  })

  it('un code inconnu et un code mal formé ne mènent nulle part', async () => {
    const db = baseDEssai()
    const inconnu = await compte({
      request: req('/api/compte/reprendre', { method: 'POST', body: JSON.stringify({ code: 'A2B3-C4D5-E6F7-G8H9' }) }),
      env: env(db),
    })
    expect(inconnu.status).toBe(404)

    const mauvais = await compte({
      request: req('/api/compte/reprendre', { method: 'POST', body: JSON.stringify({ code: 'trop court' }) }),
      env: env(db),
    })
    expect(mauvais.status).toBe(400)
  })
})

describe('/api/pay', () => {
  async function demarrer(db: BaseD1, telephone = '699412708'): Promise<{ id: string }> {
    const r = await pay({
      request: req('/api/pay/demarrer', { method: 'POST', body: JSON.stringify({ telephone }) }),
      env: env(db),
    })
    return (await r.json()) as { id: string }
  }

  async function rappeler(db: BaseD1, reference: string, reussi = true, montantXaf = 1000): Promise<Response> {
    const corps = JSON.stringify({ reference, reussi, montantXaf })
    return pay({
      request: new Request(`${BASE}/api/pay/rappel`, {
        method: 'POST', body: corps,
        headers: { [ENTETE_SIGNATURE]: await signer(corps, SECRET) },
      }),
      env: env(db),
    })
  }

  async function referenceDe(db: BaseD1, id: string): Promise<string> {
    const l = await db.prepare('SELECT reference FROM paiements WHERE id = ?').bind(id)
      .first<{ reference: string }>()
    return l?.reference ?? ''
  }

  it('refuse un numéro qui n’en est pas un, avant d’ouvrir quoi que ce soit', async () => {
    const db = baseDEssai()
    const r = await pay({
      request: req('/api/pay/demarrer', { method: 'POST', body: JSON.stringify({ telephone: 'allo' }) }),
      env: env(db),
    })
    expect(r.status).toBe(400)
    const n = await db.prepare('SELECT COUNT(*) AS n FROM paiements').first<{ n: number }>()
    expect(n?.n).toBe(0)
  })

  it('mène d’un paiement à un abonnement', async () => {
    const db = baseDEssai()
    const { id } = await demarrer(db)
    const r = await rappeler(db, await referenceDe(db, id))
    expect(await r.json()).toMatchObject({ applique: true })

    const suivi = await pay({ request: req(`/api/pay/${id}`), env: env(db) })
    expect(await suivi.json()).toMatchObject({ etat: 'reussi', plan: 'atelier', credits: CREDITS_ATELIER })
  })

  it('rejoué trois fois, il ne donne pas trois mois', async () => {
    // Le critère d'arrêt de la phase 3, joué par le chemin HTTP entier.
    const db = baseDEssai()
    const { id } = await demarrer(db)
    const reference = await referenceDe(db, id)

    const premier = await rappeler(db, reference)
    expect(await premier.json()).toMatchObject({ applique: true })
    const expire = await db.prepare('SELECT plan_expire FROM comptes').first<{ plan_expire: number }>()

    for (let i = 0; i < 3; i++) {
      const rejeu = await rappeler(db, reference)
      expect(rejeu.status).toBe(200)
      expect(await rejeu.json()).toMatchObject({ applique: false })
    }
    const apres = await db.prepare('SELECT plan_expire FROM comptes').first<{ plan_expire: number }>()
    expect(apres?.plan_expire).toBe(expire?.plan_expire)
  })

  it('un rappel non signé n’achète rien', async () => {
    // Sans ce contrôle, n'importe qui s'offre un abonnement avec `curl`.
    const db = baseDEssai()
    const { id } = await demarrer(db)
    const corps = JSON.stringify({ reference: await referenceDe(db, id), reussi: true, montantXaf: 1000 })

    const r = await pay({
      request: new Request(`${BASE}/api/pay/rappel`, { method: 'POST', body: corps }),
      env: env(db),
    })
    expect(r.status).toBe(401)

    const compteApres = await db.prepare('SELECT plan FROM comptes').first<{ plan: string }>()
    expect(compteApres?.plan).toBe('essai')
  })

  it('un rappel inconnu répond 200 : un fournisseur qui reçoit une erreur réessaie en boucle', async () => {
    const db = baseDEssai()
    const r = await rappeler(db, 'une-reference-qui-n-existe-pas')
    expect(r.status).toBe(200)
    expect(await r.json()).toMatchObject({ applique: false })
  })

  it('un versement partiel n’achète pas un mois, même signé', async () => {
    const db = baseDEssai()
    const { id } = await demarrer(db)
    await rappeler(db, await referenceDe(db, id), true, 100)

    const suivi = await pay({ request: req(`/api/pay/${id}`), env: env(db) })
    expect(await suivi.json()).toMatchObject({ etat: 'echoue', plan: 'essai' })
  })

  it('et on ne lit pas le paiement de quelqu’un d’autre', async () => {
    const db = baseDEssai()
    const { id } = await demarrer(db)
    const r = await pay({ request: req(`/api/pay/${id}`, { jeton: AUTRE }), env: env(db) })
    // Le même « introuvable » que pour un paiement absent : répondre « ce n'est
    // pas le tien » dirait à qui essaie des identifiants lesquels existent.
    expect(r.status).toBe(404)
  })

  it('sans secret, le paiement ne s’ouvre pas du tout', async () => {
    const db = baseDEssai()
    const r = await pay({
      request: req('/api/pay/demarrer', { method: 'POST', body: JSON.stringify({ telephone: '699412708' }) }),
      env: { COMPTES: db },
    })
    expect(r.status).toBe(503)
  })
})

describe('le journal des coûts reste mesurable', () => {
  it('rend zéro appel sur une base neuve, sans tomber', async () => {
    // `AVG` sur une table vide rend NULL : le § 8 se mesure dès le premier jour.
    expect(await coutMoyenXaf(baseDEssai())).toEqual({ appels: 0, moyenne: 0 })
  })

  it('et le compte existe bien après un paiement', async () => {
    const db = baseDEssai()
    await compte({ request: req('/api/compte'), env: env(db) })
    const l = await db.prepare('SELECT id FROM comptes').first<{ id: string }>()
    expect(await compteParId(db, l?.id ?? '')).not.toBeNull()
  })
})

describe('rien ne part en clair quand la base casse', () => {
  /*
   * Une base non migrée, une liaison qui répond mal : l'exception remontait, et
   * la plateforme rendait sa propre page d'erreur — pile d'appels et chemins de
   * fichiers compris. Le destinataire n'y peut rien et n'a rien à y lire.
   */
  const cassee = {
    prepare: () => {
      throw new Error('D1_ERROR: no such table: comptes')
    },
    batch: () => Promise.reject(new Error('D1_ERROR')),
  } as unknown as BaseD1

  it('sur /api/compte', async () => {
    const r = await compte({ request: req('/api/compte'), env: { COMPTES: cassee } })
    expect(r.status).toBe(503)
    expect(await r.text()).not.toContain('no such table')
  })

  it('et sur /api/pay', async () => {
    const r = await pay({
      request: req('/api/pay/demarrer', { method: 'POST', body: JSON.stringify({ telephone: '699412708' }) }),
      env: { COMPTES: cassee, A237_PAIEMENT_SECRET: SECRET },
    })
    expect(r.status).toBe(503)
    expect(await r.text()).not.toContain('no such table')
  })
})
