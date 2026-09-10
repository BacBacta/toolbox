import { describe, expect, it } from 'vitest'
import { onRequest } from '../src/worker-pdf.js'

/**
 * L'adaptateur du PDF, éprouvé sur ce qu'il fait de ce qu'on lui rend.
 *
 * `quickAction` ne rend pas toujours un PDF. Sous limitation de débit — sept
 * demandes d'affilée suffisent — il rend soixante-quatorze octets qui n'en sont
 * pas un, et le Worker les renvoyait tels quels, étiquetés `application/pdf`.
 * Quelqu'un téléchargeait un fichier cassé sans que rien ne le dise.
 */

const DEVIS = {
  skeleton: 'devis',
  nom: 'Devis',
  version: 0,
  publieLe: '2026-09-09T07:45:00.000Z',
  etat: {
    nom: 'Devis', encre: 'encre', numero: 'DV-2026-0118',
    emisLe: '2026-09-09T07:45:00.000Z', validite: '15 jours', acompte: 0,
    emetteur: { nom: 'Q', forme: '', activite: '', adresse: '', tel: '', mail: '', rccm: '', niu: '', centre: '' },
    client: { nom: 'C', niu: '', estEntreprise: false },
    lignes: [{ designation: 'Tôles', quantite: 2, prixUnitaire: 1000 }],
  },
}

function contexte(rendu: unknown, instantane: unknown = DEVIS, lien = 'K7M2XQ4BN9PZ'): never {
  return {
    request: new Request(`https://exemple.cm/p/${lien}`),
    params: { lien },
    env: {
      INSTANTANES: { get: () => Promise.resolve(instantane) },
      NAVIGATEUR:
        rendu === undefined
          ? undefined
          : { quickAction: () => (rendu instanceof Error ? Promise.reject(rendu) : Promise.resolve(rendu)) },
    },
  } as never
}

const pdf = (): ArrayBuffer => new TextEncoder().encode('%PDF-1.4\nfeint').buffer as ArrayBuffer

describe('ce que l’adaptateur rend', () => {
  it('le PDF, quand c’en est un', async () => {
    const r = await onRequest(contexte(pdf()))
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toBe('application/pdf')
    expect(r.headers.get('content-disposition')).toContain('devis-DV-2026-0118.pdf')
  })

  it('mais jamais ce qui n’en est pas un', async () => {
    // Sous limitation de débit, `quickAction` rend une poignée d'octets qui
    // ne sont pas un PDF. Les renvoyer étiquetés `application/pdf` fait
    // télécharger un fichier cassé, en silence.
    const r = await onRequest(contexte(new TextEncoder().encode('{"errors":[]}').buffer as ArrayBuffer))
    // 503 et non 502 : la cause la plus fréquente est le débit — une
    // impression toutes les dix secondes sur le plan gratuit — et réessayer
    // marche. Le message le dit dans ces termes.
    expect(r.status).toBe(503)
    expect(r.headers.get('content-type')).toContain('text/plain')
    expect(await r.text()).toContain('quelques secondes')
  })

  it('ni un corps vide', async () => {
    expect((await onRequest(contexte(new ArrayBuffer(0)))).status).toBe(503)
  })

  it('et une panne du navigateur se dit, sans remonter en 500', async () => {
    const r = await onRequest(contexte(new Error('browser closed')))
    expect(r.status).toBe(502)
  })

  it('sans liaison, ce n’est pas cassé : ce n’est pas branché', async () => {
    expect((await onRequest(contexte(undefined))).status).toBe(503)
  })

  it('un lien mal formé se refuse avant de toucher au stockage', async () => {
    expect((await onRequest(contexte(pdf(), DEVIS, 'trop-court'))).status).toBe(404)
  })

  it('accepte un lien rendu en tableau, comme Pages le fait parfois', async () => {
    // Une route attrape-tout rend un tableau de segments ; une route simple
    // rend une chaîne. Les deux arrivent, selon la forme du chemin.
    const c = {
      request: new Request('https://exemple.cm/p/K7M2XQ4BN9PZ'),
      params: { lien: ['K7M2XQ4BN9PZ'] },
      env: {
        INSTANTANES: { get: () => Promise.resolve(DEVIS) },
        NAVIGATEUR: { quickAction: () => Promise.resolve(pdf()) },
      },
    } as never
    expect((await onRequest(c)).status).toBe(200)
  })

  it('et un navigateur qui rend une réponse plutôt que des octets', async () => {
    // `quickAction` rend l'un ou l'autre selon la version du client.
    const r = await onRequest(contexte(new Response(pdf())))
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toBe('application/pdf')
  })

  it('un lien inconnu rend 404', async () => {
    expect((await onRequest(contexte(pdf(), null))).status).toBe(404)
  })

  it('et un registre dit qu’il n’a pas de feuille', async () => {
    const njangi = { ...DEVIS, skeleton: 'njangi', etat: { nom: 'N', cotisation: 0, periode: 'semaine', tour: 1, historique: [], membres: [] } }
    const r = await onRequest(contexte(pdf(), njangi))
    expect(r.status).toBe(415)
    expect(await r.text()).toContain('ouvre son lien')
  })
})
