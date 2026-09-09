import type { BaseD1 } from '@a237/comptes'
import { jetonDeLEntete, jetonValide, ouvrirSeance } from '@a237/comptes'
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

/*
 * `env` mêle des chaînes et des liaisons. Une variable d'environnement est une
 * chaîne ; une liaison D1 est un objet que la plateforme injecte. Le type le
 * dit plutôt que de faire semblant, sinon `reglagesDe` reçoit un objet dont il
 * croit que tout est chaîne.
 */
interface ContextePages {
  readonly request: Request
  readonly env: Readonly<Record<string, string | undefined | BaseD1>> & {
    readonly COMPTES?: BaseD1
  }
}

/** Ce que `reglagesDe` sait lire : les chaînes, et elles seules. */
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

  /*
   * Sans base de comptes, on ne sert pas — et surtout pas gratuitement.
   *
   * La liaison peut manquer : un déploiement de prévisualisation qui n'a pas
   * les mêmes ressources, une configuration incomplète. Servir quand même
   * ouvrirait un robinet qui coûte de l'argent à chaque appel et que personne
   * ne compte. 503 : ce n'est pas cassé, ce n'est pas branché.
   */
  const base = contexte.env.COMPTES
  if (base === undefined) {
    return json(503, { erreur: 'la composition par le modèle n’est pas encore ouverte' })
  }

  /*
   * L'appareil se présente, et c'est tout ce qu'on lui demande.
   *
   * Pas d'inscription : le jeton est tiré sur le téléphone au premier
   * lancement (§ 2). Un jeton mal formé se refuse sur sa forme, avant de
   * toucher à la base — c'est la même règle que pour un lien de publication.
   */
  const jeton = jetonDeLEntete(contexte.request.headers)
  if (jeton === null || !jetonValide(jeton)) {
    return json(401, { erreur: 'appareil-inconnu', pourquoi: 'Cet appareil ne s’est pas présenté.' })
  }

  let corps: unknown
  try {
    corps = await contexte.request.json()
  } catch {
    // Un corps illisible est une demande absente : même réponse, et on ne
    // laisse pas l'exception remonter en 500.
    corps = undefined
  }

  const seance = await ouvrirSeance(base, jeton, new Date())
  const { statut, corps: reponse } = await repondre(corps, reglagesDe(chainesDe(contexte.env)), seance)
  /*
   * Ce qu'il reste part avec la réponse.
   *
   * L'écran doit pouvoir dire « il te reste trois compositions » sans un
   * aller-retour de plus : la seule requête qui coûte est aussi celle qui
   * renseigne. Le compte de la séance est celui d'avant l'appel — on retire
   * ce que l'appel a consommé.
   */
  const restants = statut === 200 ? Math.max(0, seance.compte.credits - 1) : seance.compte.credits
  return json(statut, { ...reponse, credits: restants, plan: seance.compte.plan })
}
