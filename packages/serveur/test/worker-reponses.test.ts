import { compteDeLAppareil, empreinte, noterPublication, rangerReponse } from '@a237/comptes'
import type { BaseD1 } from '@a237/comptes'
import { beforeEach, describe, expect, it } from 'vitest'
import { baseDEssai } from '../../comptes/test/sqlite.js'
import { onRequest } from '../src/worker-reponses.js'

/**
 * `GET /api/reponses/:lien` — la contrepartie de l'écriture publique.
 *
 * N'importe qui répond, une seule personne relit. C'est la seule garantie que
 * le formulaire donne à ceux qui le remplissent : ce qu'ils écrivent va à la
 * personne qui a envoyé le lien, et pas à qui aurait deviné l'adresse.
 */

const LIEN = 'K7M2XQ4BN9PZ'
const JETON = 'a'.repeat(64)
const AUTRE_JETON = 'b'.repeat(64)
const HOTE = 'https://atelier237.pages.dev'
const LE_9_SEPT = new Date('2026-09-09T07:45:00.000Z')

let db: BaseD1

beforeEach(async () => {
  db = baseDEssai()
  const compte = await compteDeLAppareil(db, await empreinte(JETON), LE_9_SEPT)
  await noterPublication(
    db, { lien: LIEN, compteId: compte.id, skeleton: 'compose-formulaire' }, LE_9_SEPT,
  )
  await rangerReponse(db, { lien: LIEN, contenu: { nom: 'Awa' }, source: null }, LE_9_SEPT)
})

function contexte(entetes: Record<string, string> = {}, lien = LIEN, requete = ''): never {
  return {
    request: new Request(`${HOTE}/api/reponses/${lien}${requete}`, { headers: entetes }),
    params: { lien },
    env: { COMPTES: db },
  } as never
}

const avecJeton = (j = JETON): Record<string, string> => ({ authorization: `Appareil ${j}` })

describe('celui qui a publié', () => {
  it('relit ses réponses', async () => {
    const r = await onRequest(contexte(avecJeton()))
    expect(r.status).toBe(200)
    const corps = (await r.json()) as { reponses: { contenu: Record<string, string> }[] }
    expect(corps.reponses).toHaveLength(1)
    expect(corps.reponses[0]?.contenu).toEqual({ nom: 'Awa' })
  })

  it('et rien ne s’en met en cache', async () => {
    // Une commande arrivée il y a dix secondes ne doit pas attendre l'heure.
    expect((await onRequest(contexte(avecJeton()))).headers.get('cache-control')).toBe('no-store')
  })
})

describe('celui qui n’a pas publié', () => {
  it('ne lit rien, et n’apprend pas que le lien existe', async () => {
    /*
     * 404 et non 403 : « ce n'est pas à toi » confirmerait à un inconnu que le
     * lien existe et qu'il reçoit. Un formulaire de tontine n'a pas à se
     * laisser énumérer.
     */
    const r = await onRequest(contexte(avecJeton(AUTRE_JETON)))
    expect(r.status).toBe(404)
    expect(await r.text()).not.toContain('reponses')
  })

  it('un lien que personne n’a publié rend la même chose', async () => {
    expect((await onRequest(contexte(avecJeton(), 'M9PP658V8VJC'))).status).toBe(404)
  })

  it('sans appareil, on ne demande même pas', async () => {
    expect((await onRequest(contexte())).status).toBe(401)
  })

  it('un lien mal formé ne touche pas la base', async () => {
    expect((await onRequest(contexte(avecJeton(), 'pas-un-lien'))).status).toBe(404)
  })
})

describe('la page suivante', () => {
  it('reprend là où la précédente s’est arrêtée', async () => {
    await rangerReponse(
      db, { lien: LIEN, contenu: { nom: 'Paul' }, source: null },
      new Date(LE_9_SEPT.getTime() + 1_000),
    )
    const r = await onRequest(contexte(avecJeton(), LIEN, `?avant=${LE_9_SEPT.getTime() + 1}`))
    const corps = (await r.json()) as { reponses: { contenu: Record<string, string> }[] }
    expect(corps.reponses.map((x) => x.contenu.nom)).toEqual(['Awa'])
  })

  it('ignore un curseur qui n’en est pas un', async () => {
    const r = await onRequest(contexte(avecJeton(), LIEN, '?avant=hier'))
    expect(r.status).toBe(200)
  })
})
