import { devis, njangi } from '@a237/engine'
import { describe, expect, it } from 'vitest'
import { onRequest } from '../src/worker-lire.js'

/**
 * `GET /d/:lien`, éprouvé pour ce qu'il décide.
 *
 * C'est la route la plus fréquentée du produit : chaque lien envoyé dans une
 * conversation WhatsApp y passe, et souvent chez quelqu'un qui n'a jamais
 * ouvert l'application. Elle n'avait aucun essai.
 */

const DEVIS = {
  skeleton: 'devis',
  nom: 'Devis',
  version: 1,
  publieLe: '2026-09-09T07:45:00.000Z',
  etat: {
    ...devis.defaults,
    numero: 'DV-2026-0118',
    emetteur: { ...devis.defaults.emetteur, nom: 'Quincaillerie Bépanda' },
    client: { ...devis.defaults.client, nom: 'Ets Mbarga & Fils' },
    lignes: [{ designation: 'Tôles bac 30/100', quantite: 24, prixUnitaire: 12_500 }],
  },
}

function contexte(
  instantane: unknown,
  { lien = 'K7M2XQ4BN9PZ', carte = false, hote = 'https://atelier237.pages.dev' } = {},
): never {
  return {
    request: new Request(`${hote}/d/${lien}`),
    params: { lien },
    env: {
      INSTANTANES: { get: () => Promise.resolve(instantane) },
      CARTES: { head: () => Promise.resolve(carte ? {} : null) },
    },
  } as never
}

describe('la page de lecture, servie', () => {
  it('rend le document et son enveloppe', async () => {
    const r = await onRequest(contexte(DEVIS))
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toContain('text/html')
    const html = await r.text()
    expect(html).toContain('Ets Mbarga &amp; Fils')
    expect(html).toContain('DV-2026-0118')
  })

  it('se met en cache une minute, pas une heure', async () => {
    /*
     * Une publication se corrige : on republie une facture parce qu'on s'est
     * trompé d'un chiffre, et le client rouvre le lien qu'il a déjà. Une minute
     * absorbe le partage dans un groupe de cent personnes sans figer une erreur
     * pour l'après-midi.
     */
    const r = await onRequest(contexte(DEVIS))
    expect(r.headers.get('cache-control')).toBe('public, max-age=60')
  })

  it('interdit tout ce que la page ne charge pas elle-même', async () => {
    const r = await onRequest(contexte(DEVIS))
    const politique = r.headers.get('content-security-policy') ?? ''
    expect(politique).toContain("default-src 'none'")
    expect(politique).toContain("frame-ancestors 'none'")
    expect(r.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('un lien mal formé se refuse sur sa forme, sans toucher au stockage', async () => {
    for (const lien of ['trop-court', '../../etc', '', 'K7M2XQ4BN9P0']) {
      const r = await onRequest(contexte(DEVIS, { lien }))
      expect(r.status, lien).toBe(404)
      expect(await r.text(), lien).toContain('ne mène à rien')
    }
  })

  it('un lien inconnu dit la seule chose utile', async () => {
    const r = await onRequest(contexte(null))
    expect(r.status).toBe(404)
    expect(r.headers.get('cache-control')).toBe('no-store')
    expect(await r.text()).toContain('recopié de travers')
  })
})

describe('l’aperçu que WhatsApp lira', () => {
  it('annonce l’image seulement si la carte existe', async () => {
    /*
     * Une `og:image` annoncée qui rend 404 fait un aperçu cassé — pire qu'un
     * aperçu sobre, parce qu'il donne l'air d'un lien douteux.
     */
    const sans = await (await onRequest(contexte(DEVIS, { carte: false }))).text()
    expect(sans).not.toContain('og:image')
    expect(sans).toContain('twitter:card" content="summary"')

    const avec = await (await onRequest(contexte(DEVIS, { carte: true }))).text()
    expect(avec).toContain('og:image" content="https://atelier237.pages.dev/c/K7M2XQ4BN9PZ.png"')
    expect(avec).toContain('summary_large_image')
  })

  it('bâtit ses adresses sur l’origine reçue, pas sur un schéma supposé', async () => {
    // Écrire `https://` en dur rend l'aperçu faux partout où le schéma diffère,
    // à commencer par le serveur local où l'on éprouve la chaîne complète.
    const html = await (await onRequest(contexte(DEVIS, { carte: true, hote: 'http://127.0.0.1:8798' }))).text()
    expect(html).toContain('og:url" content="http://127.0.0.1:8798/d/K7M2XQ4BN9PZ"')
    expect(html).toContain('og:image" content="http://127.0.0.1:8798/c/K7M2XQ4BN9PZ.png"')
  })
})

describe('un registre', () => {
  it('rend sa carte, et offre son lien de PDF à personne', async () => {
    const html = await (await onRequest(contexte({ ...DEVIS, skeleton: 'njangi', etat: njangi.defaults }))).text()
    expect(html).toContain('lecture-carte')
    expect(html).not.toContain('Enregistrer en PDF')
  })
})
