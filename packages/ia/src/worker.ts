import { reglagesDe, repondre } from './fonction.js'
import type { Environnement } from './fonction.js'

/**
 * L'adaptateur Cloudflare : tout ce que le proxy sait de son hébergeur.
 *
 * Une fonction Pages reçoit un contexte, pas un couple requête/réponse à la
 * Node. Elle rend un `Response` du web, et ses variables d'environnement
 * arrivent dans `env` — un Worker n'a pas de `process`.
 *
 * Rien ne se décide ici. Ce fichier lit un corps JSON, appelle `repondre`, et
 * emballe le résultat ; changer d'hébergeur une nouvelle fois ne toucherait
 * que ces trente lignes.
 */

interface ContextePages {
  readonly request: Request
  readonly env: Environnement
}

function json(statut: number, corps: unknown): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Une réponse du modèle ne se met jamais en cache : elle est payée, elle
      // est unique, et deux demandes voisines n'ont pas la même réponse.
      'cache-control': 'no-store',
    },
  })
}

export async function onRequest(contexte: ContextePages): Promise<Response> {
  if (contexte.request.method !== 'POST') {
    return json(405, { erreur: 'méthode non permise' })
  }

  let corps: unknown
  try {
    corps = await contexte.request.json()
  } catch {
    // Un corps illisible est une demande absente : même réponse, et on ne
    // laisse pas l'exception remonter en 500.
    corps = undefined
  }

  const { statut, corps: reponse } = await repondre(corps, reglagesDe(contexte.env))
  return json(statut, reponse)
}
