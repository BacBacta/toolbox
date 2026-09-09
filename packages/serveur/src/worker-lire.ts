import type { Instantane, RenderContext } from '@a237/engine'
import { lienValide } from '@a237/engine'
import { pageDeLecture, pageIntrouvable } from './html.js'

/**
 * `GET /d/:lien` — la page de lecture.
 *
 * Un seul aller-retour, mis en cache au bord (§ 1, point 7 de la lecture du
 * brief). Ce que le client reçoit est fini quand il le reçoit : pas de script,
 * rien à charger ensuite.
 */

interface Liaisons {
  readonly INSTANTANES: KVNamespace
  readonly CARTES: R2Bucket
}

interface KVNamespace {
  get(clef: string, type: 'json'): Promise<unknown>
}

interface R2Bucket {
  head(clef: string): Promise<unknown>
}

interface Contexte {
  readonly request: Request
  readonly params: Readonly<Record<string, string | string[]>>
  readonly env: Liaisons
}

function html(statut: number, corps: string, cache: string): Response {
  return new Response(corps, {
    status: statut,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': cache,
      // La page ne charge rien d'elle-même, la politique peut donc être aussi
      // stricte que celle de l'application. `img-src` reste ouvert au domaine
      // des cartes, qui arrivera avec R2.
      'content-security-policy':
        "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
    },
  })
}

export async function onRequest(contexte: Contexte): Promise<Response> {
  const brut = contexte.params.lien
  const lien = Array.isArray(brut) ? (brut[0] ?? '') : (brut ?? '')
  // Un lien mal formé ne touche pas KV : on refuse sur la forme.
  if (!lienValide(lien)) return html(404, pageIntrouvable(), 'no-store')

  const instantane = (await contexte.env.INSTANTANES.get(lien, 'json')) as Instantane | null
  if (instantane === null) return html(404, pageIntrouvable(), 'no-store')

  /*
   * L'origine vient de la requête et non d'un `https://` écrit en dur.
   * L'adresse absolue sert à `og:image` et `og:url`, que WhatsApp suit tels
   * quels : bâtie sur un schéma supposé, elle est fausse partout où le schéma
   * diffère — à commencer par un serveur local, où l'on éprouve justement la
   * chaîne complète.
   */
  const origine = new URL(contexte.request.url).origin
  const ctx: RenderContext = {
    lien: `${new URL(contexte.request.url).host}/d/${lien}`,
    maintenant: new Date(),
  }

  /*
   * On demande si la carte existe plutôt que de supposer qu'elle est là.
   *
   * Une `og:image` annoncée qui rend 404 fait un aperçu cassé — pire qu'un
   * aperçu sobre, parce qu'il donne l'air d'un lien douteux. Un `head` ne
   * transfère pas l'image : il coûte une consultation de métadonnées.
   */
  const carte = (await contexte.env.CARTES.head(lien)) === null
    ? undefined
    : `${origine}/c/${lien}.png`

  /*
   * Soixante secondes au bord, et non une heure.
   *
   * Une publication se corrige : on republie une facture parce qu'on s'est
   * trompé d'un chiffre, et le client rouvre le lien qu'il a déjà. Une minute
   * absorbe le partage d'un lien dans un groupe de cent personnes sans figer
   * une erreur pour l'après-midi.
   */
  return html(200, pageDeLecture(instantane, ctx, `${origine}/d/${lien}`, carte), 'public, max-age=60')
}
