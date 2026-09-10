import type { BaseD1 } from '@a237/comptes'
import {
  compteDeLAppareil, empreinte, jetonDeLEntete, lireReponses, proprietaireDe,
} from '@a237/comptes'
import { lienValide } from '@a237/engine'

/**
 * `GET /api/reponses/:lien` — ce que le formulaire a reçu, pour qui l'a publié.
 *
 * C'est la contrepartie de l'écriture publique : n'importe qui répond, une
 * seule personne relit. Le propriétaire est celui qui a déposé le formulaire,
 * et il se présente avec le jeton de son appareil — le même que pour composer.
 *
 * Un lien qui n'appartient à personne rend 404 et non 403 : dire « ce n'est pas
 * à toi » confirmerait à un inconnu que le lien existe et qu'il reçoit. Un
 * formulaire de tontine n'a pas à se laisser énumérer.
 */

interface Liaisons {
  readonly COMPTES: BaseD1
}

interface Contexte {
  readonly request: Request
  readonly params: Readonly<Record<string, string | string[]>>
  readonly env: Liaisons
}

function json(statut: number, corps: unknown): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

export async function onRequest(contexte: Contexte): Promise<Response> {
  if (contexte.request.method !== 'GET') return json(405, { erreur: 'méthode non permise' })

  const brut = contexte.params.lien
  const lien = Array.isArray(brut) ? (brut[0] ?? '') : (brut ?? '')
  if (!lienValide(lien)) return json(404, { erreur: 'introuvable' })

  const jeton = jetonDeLEntete(contexte.request.headers)
  if (jeton === null) return json(401, { erreur: 'appareil-absent' })

  const db = contexte.env.COMPTES
  const proprietaire = await proprietaireDe(db, lien)
  if (proprietaire === null) return json(404, { erreur: 'introuvable' })

  /*
   * On ouvre la séance **après** avoir vu que le lien existe, mais on compare
   * quand même : `compteDeLAppareil` ouvre un compte au premier appel, et un
   * inconnu qui essaie des liens au hasard n'a pas à en semer un à chaque coup.
   */
  const compte = await compteDeLAppareil(db, await empreinte(jeton), new Date())
  if (compte.id !== proprietaire) return json(404, { erreur: 'introuvable' })

  const avant = Number(new URL(contexte.request.url).searchParams.get('avant') ?? '')
  const lignes = await lireReponses(db, lien, Number.isFinite(avant) && avant > 0 ? avant : undefined)

  return json(200, {
    reponses: lignes.map((l) => ({ contenu: lire(l.contenu), recuLe: l.recu_le })),
  })
}

/**
 * Le contenu est du JSON écrit par nous, mais il a fait un aller-retour en
 * base : une ligne abîmée ne doit pas faire tomber la lecture des cent autres.
 */
function lire(brut: string): Record<string, string> {
  try {
    const valeur: unknown = JSON.parse(brut)
    return typeof valeur === 'object' && valeur !== null ? (valeur as Record<string, string>) : {}
  } catch {
    return {}
  }
}
