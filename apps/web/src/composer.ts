import type { RegistreDemande } from '@a237/engine'
import { verifierRegistre } from '@a237/engine'

/**
 * L'étage 2 : ce que l'étage 1 n'a pas su faire, on le fait composer.
 *
 * Le modèle n'est jamais appelé d'ici. Cette fonction parle à `/api/ai`, qui
 * détient la clef dans son environnement et ne la rend à personne (§ 2.8). Le
 * client ne voit qu'une configuration de registre — jamais de HTML, jamais de
 * code (§ 3, point 5).
 *
 * Et il la **revérifie** avant de s'en servir. Le serveur l'a déjà fait, mais
 * un serveur peut être d'une version plus ancienne que l'application qui
 * l'interroge, et le contrat vit dans le moteur précisément pour que les deux
 * côtés lisent la même règle. Un contrôle qu'on ne fait qu'une fois est un
 * contrôle qu'on finira par ne plus faire.
 */

export type Composition =
  | { readonly sorte: 'compose'; readonly registre: RegistreDemande; readonly fcfa: number }
  /** Le proxy existe mais n'est pas ouvert. On le dit, on ne fait pas semblant. */
  | { readonly sorte: 'pas-ouvert' }
  | { readonly sorte: 'echoue'; readonly pourquoi: string }

export async function composer(demande: string, signal?: AbortSignal): Promise<Composition> {
  let reponse: Response
  try {
    reponse = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ demande }),
      ...(signal !== undefined ? { signal } : {}),
    })
  } catch {
    // Hors ligne, ou réseau capricieux : c'est le cas courant ici, pas l'exception.
    return { sorte: 'echoue', pourquoi: 'pas de réseau' }
  }

  if (reponse.status === 503) return { sorte: 'pas-ouvert' }

  if (!reponse.ok) {
    return {
      sorte: 'echoue',
      pourquoi: reponse.status === 422 ? 'la description n’a pas suffi' : 'le service a refusé',
    }
  }

  const corps = (await reponse.json().catch(() => null)) as
    | { registre?: unknown; fcfa?: unknown }
    | null

  const erreurs = verifierRegistre(corps?.registre)
  if (erreurs.length > 0) {
    return { sorte: 'echoue', pourquoi: 'la réponse ne décrit pas un registre valide' }
  }

  return {
    sorte: 'compose',
    registre: corps?.registre as RegistreDemande,
    fcfa: typeof corps?.fcfa === 'number' ? corps.fcfa : 0,
  }
}
