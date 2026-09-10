import type { CalculDemande, RegistreDemande } from '@a237/engine'
import { lireReponseModele } from '@a237/engine'
import { entetesDAppareil } from './appareil.js'
import { noterApresComposition } from './compte.js'

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
  | { readonly sorte: 'calcule'; readonly calcul: CalculDemande; readonly fcfa: number }
  /**
   * Le modèle a répondu que la demande n'est pas un registre. C'est une
   * réponse, pas une panne : on la montre telle quelle et on ne réessaie pas.
   */
  | { readonly sorte: 'hors-sujet'; readonly pourquoi: string }
  /** Le proxy existe mais n'est pas ouvert. On le dit, on ne fait pas semblant. */
  | { readonly sorte: 'pas-ouvert' }
  /**
   * Le compte n'a plus de crédit. Ce n'est pas une panne, et proposer de
   * réessayer ferait tourner quelqu'un en rond sur un mur.
   *
   * Le pourquoi vient du serveur : il ne dit pas la même chose à un essai
   * épuisé — « l'abonnement en donne quarante par mois » — qu'à un abonné qui a
   * tout consommé, à qui il dit que les jours restants ne sont pas perdus.
   */
  | { readonly sorte: 'sans-credit'; readonly pourquoi: string }
  /**
   * La demande vaut plusieurs outils. Elle relève de l'abonnement, et on le
   * dit **avant** d'avoir dépensé quoi que ce soit.
   */
  | { readonly sorte: 'abonnement-requis'; readonly pourquoi: string }
  | { readonly sorte: 'echoue'; readonly pourquoi: string }

export async function composer(demande: string, signal?: AbortSignal): Promise<Composition> {
  let reponse: Response
  try {
    reponse = await fetch('/api/ai', {
      method: 'POST',
      // L'appareil se présente : c'est ce qui lui vaut ses crédits, et ce qui
      // fait qu'un abonnement suit son propriétaire d'un téléphone à l'autre.
      headers: { 'content-type': 'application/json', ...(await entetesDAppareil()) },
      body: JSON.stringify({ demande }),
      ...(signal !== undefined ? { signal } : {}),
    })
  } catch {
    // Hors ligne, ou réseau capricieux : c'est le cas courant ici, pas l'exception.
    return { sorte: 'echoue', pourquoi: 'pas de réseau' }
  }

  if (reponse.status === 503) return { sorte: 'pas-ouvert' }
  if (reponse.status === 402) {
    const corps = (await reponse.json().catch(() => null)) as
      | { erreur?: unknown; pourquoi?: unknown }
      | null
    const pourquoi = typeof corps?.pourquoi === 'string' ? corps.pourquoi : ''
    return corps?.erreur === 'abonnement-requis'
      ? { sorte: 'abonnement-requis', pourquoi }
      : { sorte: 'sans-credit', pourquoi }
  }

  if (!reponse.ok) {
    return {
      sorte: 'echoue',
      pourquoi: reponse.status === 422 ? 'la description n’a pas suffi' : 'le service a refusé',
    }
  }

  const corps = (await reponse.json().catch(() => null)) as
    | {
        registre?: unknown; calcul?: unknown; impossible?: unknown; fcfa?: unknown
        plan?: unknown; credits?: unknown
      }
    | null

  // Le solde revient avec la composition : le compte se tient à jour sans
  // qu'on l'interroge, et sans coûter un aller-retour de plus.
  await noterApresComposition(corps?.plan, corps?.credits)

  const fcfa = typeof corps?.fcfa === 'number' ? corps.fcfa : 0

  /*
   * Le refus se lit sur l'enveloppe, pas au validateur.
   *
   * L'enveloppe porte `fcfa` à côté de la charge utile, et le schéma de refus
   * interdit tout champ supplémentaire : lui passer l'enveloppe entière faisait
   * rejeter un refus parfaitement valide, et l'écran disait « je n'ai pas pu
   * composer » à la place de la phrase du modèle.
   */
  if (typeof corps?.impossible === 'string' && corps.impossible !== '') {
    return { sorte: 'hors-sujet', pourquoi: corps.impossible }
  }

  // Le même lecteur que le serveur, sur la charge utile seule.
  const lu = lireReponseModele(corps?.registre ?? corps?.calcul)
  if (lu.sorte === 'registre') return { sorte: 'compose', registre: lu.registre, fcfa }
  if (lu.sorte === 'calcul') return { sorte: 'calcule', calcul: lu.calcul, fcfa }
  return { sorte: 'echoue', pourquoi: 'la réponse ne décrit pas un outil valide' }
}
