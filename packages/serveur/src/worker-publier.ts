import type { Depot, DejaLa } from './publier.js'
import { TAILLE_MAX, controler } from './publier.js'

/**
 * `POST /api/publier` — l'adaptateur Cloudflare du dépôt.
 *
 * Il ne décide rien : `controler` tranche, et ce fichier lit une requête,
 * écrit dans KV et emballe une réponse.
 */

interface Liaisons {
  readonly INSTANTANES: KVNamespace
}

interface Contexte {
  readonly request: Request
  readonly env: Liaisons
}

interface KVNamespace {
  get(clef: string, type: 'json'): Promise<unknown>
  put(clef: string, valeur: string): Promise<void>
}

function json(statut: number, corps: unknown): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

export async function onRequest(contexte: Contexte): Promise<Response> {
  if (contexte.request.method !== 'POST') return json(405, { erreur: 'méthode non permise' })

  // La taille se refuse avant de lire : un corps de dix mégaoctets ne doit pas
  // être analysé pour qu'on découvre ensuite qu'il est trop gros.
  const annonce = Number(contexte.request.headers.get('content-length') ?? '0')
  if (Number.isFinite(annonce) && annonce > TAILLE_MAX) {
    return json(413, { erreur: 'instantane-trop-gros' })
  }

  let recu: unknown
  try {
    recu = await contexte.request.json()
  } catch {
    return json(400, { erreur: 'instantane-absent' })
  }

  const depot = recu as Depot
  const detenu = (await contexte.env.INSTANTANES.get(depot?.lien ?? '', 'json')) as
    | (DejaLa & Record<string, unknown>)
    | null

  const verdict = controler(recu, detenu)
  if (verdict !== null) return json(verdict.statut, verdict.corps)

  const corps = JSON.stringify(depot.instantane)
  if (corps.length > TAILLE_MAX) return json(413, { erreur: 'instantane-trop-gros' })
  await contexte.env.INSTANTANES.put(depot.lien, corps)

  return json(200, { lien: depot.lien, version: depot.instantane.version })
}
