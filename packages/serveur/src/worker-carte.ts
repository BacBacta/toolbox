import { lienValide } from '@a237/engine'

/**
 * La carte d'une publication : `PUT` au dépôt, `GET` pour l'aperçu.
 *
 * Elle est **dessinée sur le téléphone** et téléversée telle quelle. Le brief
 * l'exige (§ 1, point 6) et c'est le bon découpage : le serveur n'a ni police,
 * ni canvas, ni la moindre raison d'apprendre à dessiner. Il range un octet et
 * le rend.
 *
 * Elle est servie par une route de ce domaine plutôt que par l'adresse
 * publique du seau : l'aperçu WhatsApp et la page de lecture restent alors sur
 * la même origine, et le seau n'a pas besoin d'être ouvert au monde.
 */

interface Liaisons {
  readonly CARTES: R2Bucket
}

interface R2Bucket {
  get(clef: string): Promise<{ body: ReadableStream } | null>
  put(clef: string, valeur: ArrayBuffer, options?: unknown): Promise<unknown>
}

interface Contexte {
  readonly request: Request
  readonly params: Readonly<Record<string, string | string[]>>
  readonly env: Liaisons
}

/** Une carte fait cent kilo-octets ; au-delà de deux cents, ce n'en est pas une. */
export const TAILLE_MAX_CARTE = 200 * 1024

/** Les huit premiers octets d'un PNG. Rien d'autre n'entre dans le seau. */
const SIGNATURE_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

export function estPng(octets: Uint8Array): boolean {
  if (octets.length < SIGNATURE_PNG.length) return false
  return SIGNATURE_PNG.every((o, i) => octets[i] === o)
}

function refus(statut: number, erreur: string): Response {
  return new Response(JSON.stringify({ erreur }), {
    status: statut,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

export async function onRequest(contexte: Contexte): Promise<Response> {
  const brut = contexte.params.lien
  const nom = Array.isArray(brut) ? (brut[0] ?? '') : (brut ?? '')
  const lien = nom.endsWith('.png') ? nom.slice(0, -4) : nom
  if (!lienValide(lien)) return refus(404, 'lien-invalide')

  if (contexte.request.method === 'GET') {
    const objet = await contexte.env.CARTES.get(lien)
    if (objet === null) return refus(404, 'carte-absente')
    return new Response(objet.body, {
      headers: {
        'content-type': 'image/png',
        /*
         * Un an, immuable : la carte d'une publication ne change pas. Une
         * republication en dépose une nouvelle sous le même nom — l'aperçu
         * d'une discussion garde alors l'ancienne, ce qui est le bon
         * comportement : c'est celle qu'on a envoyée ce jour-là.
         */
        'cache-control': 'public, max-age=31536000, immutable',
        'x-content-type-options': 'nosniff',
      },
    })
  }

  if (contexte.request.method !== 'PUT') return refus(405, 'méthode non permise')

  const annonce = Number(contexte.request.headers.get('content-length') ?? '0')
  if (Number.isFinite(annonce) && annonce > TAILLE_MAX_CARTE) return refus(413, 'carte-trop-grosse')

  const octets = await contexte.request.arrayBuffer()
  if (octets.byteLength > TAILLE_MAX_CARTE) return refus(413, 'carte-trop-grosse')
  /*
   * On vérifie la signature et non l'en-tête annoncé : `content-type` est
   * déclaratif, et ce seau est servi tel quel sous une adresse de ce domaine.
   * Y laisser entrer autre chose qu'une image serait offrir un hébergement.
   */
  if (!estPng(new Uint8Array(octets))) return refus(415, 'pas-une-image')

  await contexte.env.CARTES.put(lien, octets, {
    httpMetadata: { contentType: 'image/png' },
  })
  return new Response(JSON.stringify({ lien }), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}
