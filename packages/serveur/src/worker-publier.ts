import type { BaseD1 } from '@a237/comptes'
import { empreinte, jetonDeLEntete, noterPublication } from '@a237/comptes'
import { compteDeLAppareil } from '@a237/comptes'
import { ID_COMPOSE_FORMULAIRE } from '@a237/engine'
import type { Depot, DejaLa } from './publier.js'
import { TAILLE_MAX, controler } from './publier.js'

/**
 * `POST /api/publier` — l'adaptateur Cloudflare du dépôt.
 *
 * Il ne décide rien : `controler` tranche, et ce fichier lit une requête,
 * écrit dans KV et emballe une réponse.
 *
 * Une exception, et elle est nouvelle : **un formulaire note son
 * propriétaire**. Publier une page, c'est mettre quelque chose à lire derrière
 * une adresse, et lire ne demande pas de savoir qui a déposé. Publier un
 * formulaire, c'est ouvrir une adresse où des inconnus écrivent — et ce qu'ils
 * écrivent doit revenir à quelqu'un, et à personne d'autre. Les autres formes
 * ne notent rien : ce qu'on ne relit pas, on ne le range pas.
 */

interface Liaisons {
  readonly INSTANTANES: KVNamespace
  readonly COMPTES: BaseD1
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

  /*
   * Le propriétaire **avant** l'instantané, et non après.
   *
   * Dans l'autre ordre, une panne entre les deux écritures laisse un
   * formulaire ouvert aux réponses et sans destinataire : les gens répondent,
   * et personne ne peut relire. Un propriétaire noté pour un formulaire qui ne
   * serait pas déposé, lui, ne gêne personne — l'adresse ne mène à rien, et la
   * publication suivante réécrit la ligne.
   */
  if (depot.instantane.skeleton === ID_COMPOSE_FORMULAIRE) {
    const jeton = jetonDeLEntete(contexte.request.headers)
    if (jeton === null) return json(401, { erreur: 'appareil-absent' })
    const maintenant = new Date()
    const compte = await compteDeLAppareil(contexte.env.COMPTES, await empreinte(jeton), maintenant)
    await noterPublication(
      contexte.env.COMPTES,
      { lien: depot.lien, compteId: compte.id, skeleton: depot.instantane.skeleton },
      maintenant,
    )
  }

  await contexte.env.INSTANTANES.put(depot.lien, corps)

  return json(200, { lien: depot.lien, version: depot.instantane.version })
}
