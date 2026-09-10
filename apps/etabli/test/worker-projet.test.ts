import { beforeEach, describe, expect, it } from 'vitest'
import { nouvelleClef, nouveauLien } from '@a237/etabli'
import { onRequest } from '../src/worker-projet.js'

/**
 * La seule écriture venue de l'extérieur dans tout l'Établi.
 *
 * Elle referme les deux écarts qui bloquaient face à Replit — un projet survit
 * au téléphone perdu, et « regarde ce que j'ai fait » devient une adresse. Et
 * comme toute écriture publique, elle se juge sur ce qu'elle **refuse**.
 */

class FauxRangement {
  readonly boite = new Map<string, string>()
  get(clef: string): Promise<unknown> {
    const brut = this.boite.get(clef)
    return Promise.resolve(brut === undefined ? null : JSON.parse(brut))
  }
  put(clef: string, valeur: string): Promise<void> {
    this.boite.set(clef, valeur)
    return Promise.resolve()
  }
}

let rangement: FauxRangement
let lien: string
let clef: string

const FICHIERS = [{ nom: 'index.html', contenu: '<h1>Salut</h1>' }]

function appeler(methode: string, corps?: unknown, ou = lien, env?: object): Promise<Response> {
  return onRequest({
    request: new Request(`https://etabli237.pages.dev/api/p/${ou}`, {
      method: methode,
      ...(corps === undefined ? {} : { body: JSON.stringify(corps) }),
    }),
    params: { lien: ou },
    env: env ?? { PROJETS: rangement },
  } as never)
}

beforeEach(() => {
  rangement = new FauxRangement()
  lien = nouveauLien()
  clef = nouvelleClef()
})

describe('déposer un projet', () => {
  it('le range, et rend son lien', async () => {
    const r = await appeler('PUT', { clef, nom: 'Ma page', fichiers: FICHIERS })
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ lien })
  })

  it('et il se relit ensuite, sans rien demander', async () => {
    await appeler('PUT', { clef, nom: 'Ma page', fichiers: FICHIERS })
    const r = await appeler('GET')
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ nom: 'Ma page', fichiers: FICHIERS })
  })

  /*
   * Le lien se partage — c'est son but. S'il donnait aussi le droit de
   * réécrire, le premier destinataire pourrait effacer le travail de celui qui
   * le lui a envoyé.
   */
  it('mais la clef ne ressort jamais avec lui', async () => {
    await appeler('PUT', { clef, nom: 'Ma page', fichiers: FICHIERS })
    expect(JSON.stringify(await (await appeler('GET')).json())).not.toContain(clef)
  })

  it('celui qui a la clef réécrit dessus', async () => {
    await appeler('PUT', { clef, nom: 'Avant', fichiers: FICHIERS })
    const r = await appeler('PUT', { clef, nom: 'Après', fichiers: FICHIERS })
    expect(r.status).toBe(200)
    expect((await (await appeler('GET')).json() as { nom: string }).nom).toBe('Après')
  })

  /*
   * 404 et non 403 : dire « ce lien existe mais tu n'as pas la clef »
   * apprendrait à qui tâtonne quels liens sont pris.
   */
  it('celui qui ne l’a pas n’écrase rien, et n’apprend pas que le lien existe', async () => {
    await appeler('PUT', { clef, nom: 'À moi', fichiers: FICHIERS })
    const r = await appeler('PUT', { clef: nouvelleClef(), nom: 'Volé', fichiers: FICHIERS })
    expect(r.status).toBe(404)
    expect((await (await appeler('GET')).json() as { nom: string }).nom).toBe('À moi')
  })
})

describe('ce que le dépôt refuse', () => {
  it('un lien qui n’a pas la forme d’un lien', async () => {
    expect((await appeler('GET', undefined, '../secret')).status).toBe(404)
    expect((await appeler('PUT', { clef, nom: 'x', fichiers: FICHIERS }, 'court')).status).toBe(404)
  })

  it('un lien inconnu', async () => {
    expect((await appeler('GET')).status).toBe(404)
  })

  it('une clef qui n’en est pas une', async () => {
    expect((await appeler('PUT', { clef: 'x', nom: 'x', fichiers: FICHIERS })).status).toBe(400)
    expect((await appeler('PUT', { nom: 'x', fichiers: FICHIERS })).status).toBe(400)
  })

  it('un projet qui ne tient pas le contrat', async () => {
    expect((await appeler('PUT', { clef, nom: 'x', fichiers: [] })).status).toBe(400)
    expect((await appeler('PUT', { clef, nom: 'x', fichiers: [{ nom: '../a.js', contenu: '' }] })).status).toBe(400)
    expect((await appeler('PUT', { clef, nom: 'x', fichiers: [{ nom: 'a.txt', contenu: '' }] })).status).toBe(400)
  })

  it('un corps illisible', async () => {
    const r = await onRequest({
      request: new Request(`https://x/api/p/${lien}`, { method: 'PUT', body: 'pas du json' }),
      params: { lien },
      env: { PROJETS: rangement },
    } as never)
    expect(r.status).toBe(400)
  })

  it('une méthode qu’il ne sert pas', async () => {
    expect((await appeler('DELETE')).status).toBe(405)
  })

  it('et il le dit quand le rangement n’est pas branché, plutôt que de tomber', async () => {
    const r = await appeler('GET', undefined, lien, {})
    expect(r.status).toBe(503)
  })
})

/**
 * Le poids se refuse avant de lire le corps.
 *
 * Sans ça, n'importe qui pousse un fichier de cent mégaoctets et c'est le
 * Worker qui le porte en mémoire avant de le rejeter.
 */
describe('un dépôt trop lourd', () => {
  it('est refusé sur l’annonce, sans être lu', async () => {
    const r = await onRequest({
      request: new Request(`https://x/api/p/${lien}`, {
        method: 'PUT',
        headers: { 'content-length': String(10 * 1024 * 1024) },
        body: JSON.stringify({ clef, nom: 'x', fichiers: FICHIERS }),
      }),
      params: { lien },
      env: { PROJETS: rangement },
    } as never)
    expect(r.status).toBe(413)
  })

  it('et un segment de route absent se lit comme un lien invalide', async () => {
    const r = await onRequest({
      request: new Request('https://x/api/p/', { method: 'GET' }),
      params: {},
      env: { PROJETS: rangement },
    } as never)
    expect(r.status).toBe(404)
  })

  it('un segment rendu en tableau se lit quand même', async () => {
    await appeler('PUT', { clef, nom: 'Ma page', fichiers: FICHIERS })
    const r = await onRequest({
      request: new Request(`https://x/api/p/${lien}`, { method: 'GET' }),
      params: { lien: [lien] },
      env: { PROJETS: rangement },
    } as never)
    expect(r.status).toBe(200)
  })
})
