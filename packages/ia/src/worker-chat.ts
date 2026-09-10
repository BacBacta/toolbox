import type { BaseD1 } from '@a237/comptes'
import { jetonDeLEntete, jetonValide, ouvrirSeance } from '@a237/comptes'
import { accorder, estUnRefus } from './conversation.js'
import type { DemandeChat } from './conversation.js'
import { jouerLeTour } from './flux.js'
import type { EvenementAgent } from './flux.js'
import { MODELE_PAR_DEFAUT, reglagesDe } from './fonction.js'
import type { Environnement, Reglages } from './fonction.js'
import { gemini, openrouter } from './fournisseur.js'
import type { Fournisseur } from './fournisseur.js'

/**
 * `POST /api/chat` — l'agent, en flux.
 *
 * Le même proxy que `/api/ai`, et pour la même raison : **aucune clef d'API
 * dans le client, jamais** (invariant § 2.8). Ce qui change est la forme de la
 * réponse — une suite d'événements plutôt qu'un objet — parce que l'attente
 * est le vrai sujet. Huit secondes devant un écran vide, sur une connexion qui
 * hoquette, deviennent trente, et personne ne sait si ça marche.
 *
 * Rien de ce qui traverse ce fichier ne décide : `accorder` tranche le droit et
 * le prix, `jouerLeTour` fabrique les événements, et ces lignes-ci les mettent
 * en `text/event-stream`.
 */

interface ContextePages {
  readonly request: Request
  readonly env: Readonly<Record<string, string | undefined | BaseD1>> & {
    readonly COMPTES?: BaseD1
  }
}

function chainesDe(env: ContextePages['env']): Environnement {
  const propre: Record<string, string | undefined> = {}
  for (const [clef, valeur] of Object.entries(env)) {
    if (typeof valeur === 'string') propre[clef] = valeur
  }
  return propre
}

function json(statut: number, corps: unknown): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/**
 * Le fournisseur et le modèle se choisissent dans l'environnement.
 *
 * Le brief pose un **budget** — moins d'un franc la génération (§ 8) — et non
 * une marque. Pouvoir changer de modèle sans redéployer, c'est pouvoir tenir
 * ce budget quand les prix bougent, et essayer mieux quand un modèle plus
 * fidèle au schéma apparaît. Une reprise double le coût : un modèle qui se
 * trompe moins peut revenir moins cher qu'un modèle moins cher.
 *
 * Le prix sert au journal quand le fournisseur ne dit pas ce qu'il a facturé.
 * OpenRouter, lui, le dit, et son chiffre l'emporte — il applique sa marge.
 */
function fournisseurChoisi(r: Reglages): Fournisseur {
  return r.fournisseur === 'gemini'
    ? gemini(r.clef, r.modele === MODELE_PAR_DEFAUT ? 'gemini-2.5-flash-lite' : r.modele)
    : openrouter(r.clef, r.modele, { entree: r.prixEntree, sortie: r.prixSortie })
}

/**
 * Les événements, mis sur le fil.
 *
 * Une ligne `data:` par événement, et une ligne vide pour la clore : c'est tout
 * le protocole, et il tient dans un navigateur sans bibliothèque. Le saut de
 * ligne est interdit à l'intérieur — d'où le JSON, qui échappe les siens.
 */
function evenement(e: EvenementAgent): string {
  return `data: ${JSON.stringify(e)}\n\n`
}

export async function onRequest(contexte: ContextePages): Promise<Response> {
  if (contexte.request.method !== 'POST') return json(405, { erreur: 'méthode non permise' })

  const base = contexte.env.COMPTES
  if (base === undefined) {
    return json(503, { erreur: 'la composition par le modèle n’est pas encore ouverte' })
  }

  const reglages = reglagesDe(chainesDe(contexte.env))
  if (reglages.clef === '' || !reglages.ouverte) {
    return json(503, { erreur: 'la composition par le modèle n’est pas encore ouverte' })
  }

  /*
   * Le secret qui signe les laissez-passer.
   *
   * Le même que celui des rappels de paiement : il ne quitte pas le serveur, et
   * en poser un deuxième serait un deuxième à ne pas perdre. Sans lui, on ne
   * sert pas — un laissez-passer non signé est une composition gratuite à
   * volonté.
   */
  const secret = typeof contexte.env.A237_PAIEMENT_SECRET === 'string'
    ? contexte.env.A237_PAIEMENT_SECRET
    : ''
  if (secret === '') {
    return json(503, { erreur: 'la composition par le modèle n’est pas encore ouverte' })
  }

  const jeton = jetonDeLEntete(contexte.request.headers)
  if (jeton === null || !jetonValide(jeton)) {
    return json(401, { erreur: 'appareil-inconnu', pourquoi: 'Cet appareil ne s’est pas présenté.' })
  }

  let recu: DemandeChat
  try {
    recu = (await contexte.request.json()) as DemandeChat
  } catch {
    return json(400, { erreur: 'messages-illisibles' })
  }

  const seance = await ouvrirSeance(base, jeton, new Date())
  const accord = await accorder(recu, seance, secret)
  if (estUnRefus(accord)) return json(accord.statut, accord.corps)

  const fournisseur = fournisseurChoisi(reglages)
  const encodeur = new TextEncoder()

  const flux = new ReadableStream<Uint8Array>({
    async start(file) {
      try {
        for await (const e of jouerLeTour(accord, fournisseur, seance, {
          tauxFcfa: reglages.tauxFcfa,
          secret,
        })) {
          file.enqueue(encodeur.encode(evenement(e)))
        }
      } catch (cause) {
        // `jouerLeTour` ne jette pas, mais un flux qui casse plus bas — le
        // client qui ferme l'onglet — ne doit pas laisser la connexion ouverte.
        console.error('flux_agent_interrompu', cause)
      } finally {
        file.close()
      }
    },
  })

  return new Response(flux, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store',
      connection: 'keep-alive',
      // Un mandataire qui met en tampon annule tout l'intérêt du flux : la
      // réponse arriverait d'un coup, à la fin.
      'x-accel-buffering': 'no',
    },
  })
}
