import type { Depot } from '@a237/etabli'
import { MAX_OCTETS_DEPOT, clefValide, lienValide, lireDepot } from '@a237/etabli'

/**
 * `GET /api/p/:lien` et `PUT /api/p/:lien` — le dépôt d'un projet.
 *
 * C'est la seule écriture venue de l'extérieur dans tout l'Établi, et la seule
 * raison pour laquelle il touche à un réseau. Elle referme les deux écarts qui
 * bloquaient : un projet survit au téléphone perdu, et « regarde ce que j'ai
 * fait » devient une adresse.
 *
 * **Ce qui est déposé n'est jamais servi comme une page.** Le lien ouvre
 * l'éditeur, qui charge le projet et l'exécute dans son cadre isolé, comme
 * n'importe quel autre. Servir directement du HTML écrit par un inconnu ferait
 * de cette adresse un hébergement de pages piégées — et l'Établi vit déjà sur
 * son propre domaine précisément pour que ce genre de question reste loin des
 * comptes de l'atelier.
 *
 * Pas de compte, donc pas d'identité : un lien qu'on garde, une clef qui
 * autorise à réécrire. La clef ne voyage jamais avec le lien.
 */

interface Rangement {
  get(clef: string, sorte: 'json'): Promise<unknown>
  put(clef: string, valeur: string): Promise<void>
}

interface ContextePages {
  readonly request: Request
  readonly params: Record<string, string | string[]>
  readonly env: { readonly PROJETS?: Rangement }
}

/** Ce qui est rangé : le dépôt, plus la clef qui autorise à le réécrire. */
interface Range extends Depot {
  readonly clef: string
  readonly depuis: number
}

function json(statut: number, corps: unknown): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function segment(params: ContextePages['params']): string {
  const brut = params['lien']
  return Array.isArray(brut) ? (brut[0] ?? '') : (brut ?? '')
}

export async function onRequest(contexte: ContextePages): Promise<Response> {
  const rangement = contexte.env.PROJETS
  if (rangement === undefined) return json(503, { erreur: 'le partage n’est pas ouvert' })

  const lien = segment(contexte.params)
  if (!lienValide(lien)) return json(404, { erreur: 'lien-inconnu' })

  if (contexte.request.method === 'GET') {
    const range = (await rangement.get(lien, 'json')) as Range | null
    if (range === null) return json(404, { erreur: 'lien-inconnu' })
    // La clef ne ressort jamais : elle autorise à réécrire, et le lien se
    // partage. Les rendre ensemble donnerait ce droit à tout destinataire.
    return json(200, { nom: range.nom, fichiers: range.fichiers })
  }

  if (contexte.request.method !== 'PUT') return json(405, { erreur: 'méthode non permise' })

  /*
   * On refuse au poids avant de lire le corps.
   *
   * Sans ça, n'importe qui pousse un fichier de cent mégaoctets et c'est le
   * Worker qui le porte en mémoire avant de le rejeter. L'en-tête ment
   * parfois — d'où le second contrôle, sur ce qui a réellement été lu.
   */
  const annonce = Number(contexte.request.headers.get('content-length') ?? '0')
  if (annonce > MAX_OCTETS_DEPOT * 2) return json(413, { erreur: 'projet-trop-gros' })

  let recu: { clef?: unknown; nom?: unknown; fichiers?: unknown }
  try {
    recu = (await contexte.request.json()) as typeof recu
  } catch {
    return json(400, { erreur: 'corps-illisible' })
  }

  if (!clefValide(recu.clef)) return json(400, { erreur: 'clef-invalide' })

  const depot = lireDepot({ nom: recu.nom, fichiers: recu.fichiers })
  if (depot === null) return json(400, { erreur: 'projet-invalide' })

  /*
   * Le premier qui écrit sur un lien en devient le propriétaire.
   *
   * Il n'y a pas de compte : c'est la clef, tirée sur l'appareil et jamais
   * partagée, qui tient lieu d'identité. Un lien tiré sur cinquante bits ne se
   * devine pas, et sans la bonne clef on ne réécrit pas dessus.
   */
  const existant = (await rangement.get(lien, 'json')) as Range | null
  if (existant !== null && existant.clef !== recu.clef) {
    // 404 et non 403 : dire « ce lien existe mais tu n'as pas la clef »
    // apprendrait à qui tâtonne quels liens sont pris.
    return json(404, { erreur: 'lien-inconnu' })
  }

  const range: Range = {
    nom: depot.nom,
    fichiers: depot.fichiers,
    clef: recu.clef as string,
    depuis: existant?.depuis ?? Date.now(),
  }
  await rangement.put(lien, JSON.stringify(range))
  return json(200, { lien })
}
