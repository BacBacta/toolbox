import { compteParCode, compteParId, poserCode, rattacherAppareil } from './base.js'
import type { BaseD1 } from './base.js'
import { codeLisible, empreinte, jetonValide, tirerCode } from './identite.js'
import { abonne, planEffectif } from './plan.js'
import type { Compte } from './plan.js'
import { jetonDeLEntete } from './seance.js'

/**
 * `/api/compte` — ce que l'appareil sait de lui-même.
 *
 * Trois chemins, et aucun ne demande de créer quoi que ce soit : le compte
 * s'ouvre tout seul à la première visite (§ 2, rien à remplir avant de se
 * servir). Ce qui se demande ici, c'est de le **lire**, d'en obtenir un code de
 * récupération, et de le retrouver depuis un autre appareil.
 *
 * Le code est montré une seule fois. Il n'est rangé nulle part en clair, et
 * personne — nous compris — ne peut le retrouver ensuite : c'est ce qui fait
 * qu'il vaut quelque chose. En redemander un annule le précédent, ce qui est la
 * seule chose à faire quand on croit l'avoir laissé traîner.
 */

interface Contexte {
  readonly request: Request
  readonly env: { readonly COMPTES?: BaseD1 }
}

function json(statut: number, corps: unknown): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // L'état d'un compte change à chaque composition : le mettre en cache
      // servirait le solde d'hier, ou celui de quelqu'un d'autre.
      'cache-control': 'no-store',
    },
  })
}

/** Ce que l'écran a besoin de savoir, et rien de plus. */
function vue(compte: Compte, aUnCode: boolean, maintenant: Date): Record<string, unknown> {
  return {
    plan: planEffectif(compte, maintenant),
    credits: compte.credits,
    expire: abonne(compte, maintenant) ? compte.planExpire : null,
    aUnCode,
  }
}

async function aUnCode(db: BaseD1, id: string): Promise<boolean> {
  const l = await db
    .prepare('SELECT code_empreinte FROM comptes WHERE id = ?')
    .bind(id)
    .first<{ code_empreinte: string | null }>()
  return (l?.code_empreinte ?? null) !== null
}

/**
 * Rien de ce qui casse ici ne part en clair au client.
 *
 * Une base non migrée, une liaison qui répond mal, et l'exception remonte : la
 * plateforme rend alors sa propre page d'erreur, avec la pile d'appels et les
 * chemins de fichiers. Le destinataire n'y peut rien et n'a rien à y lire.
 * 503 : ce n'est pas sa faute, et ça se réessaie.
 */
export async function onRequest(contexte: Contexte): Promise<Response> {
  try {
    return await servir(contexte)
  } catch (cause) {
    console.error('compte_echoue', cause)
    return json(503, { erreur: 'les comptes sont indisponibles' })
  }
}

async function servir(contexte: Contexte): Promise<Response> {
  const db = contexte.env.COMPTES
  if (db === undefined) return json(503, { erreur: 'les comptes ne sont pas branchés' })

  const jeton = jetonDeLEntete(contexte.request.headers)
  if (jeton === null || !jetonValide(jeton)) {
    return json(401, { erreur: 'appareil-inconnu', pourquoi: 'Cet appareil ne s’est pas présenté.' })
  }

  const maintenant = new Date()
  const { ouvrirSeance } = await import('./seance.js')
  const seance = await ouvrirSeance(db, jeton, maintenant)
  const chemin = new URL(contexte.request.url).pathname
  const methode = contexte.request.method

  if (chemin.endsWith('/compte') && methode === 'GET') {
    return json(200, vue(seance.compte, await aUnCode(db, seance.compte.id), maintenant))
  }

  if (chemin.endsWith('/compte/code') && methode === 'POST') {
    /*
     * Le code se tire ici et non sur le téléphone.
     *
     * Un code tiré côté client serait bon quand même — c'est son empreinte qui
     * voyagerait. Mais il faudrait alors croire le client sur la longueur et
     * sur l'alphabet, et un téléphone dont le générateur est faible perdrait
     * son compte sans le savoir.
     */
    const code = tirerCode()
    await poserCode(db, seance.compte.id, await empreinte(code.replace(/-/g, '')))
    return json(200, {
      code: codeLisible(code.replace(/-/g, '')),
      pourquoi:
        'Écris-le quelque part. Il ne sera plus jamais affiché, et c’est lui qui te rendra ' +
        'ton atelier si tu changes de téléphone.',
    })
  }

  if (chemin.endsWith('/compte/reprendre') && methode === 'POST') {
    const { normaliserCode } = await import('./identite.js')
    let recu: unknown
    try {
      recu = await contexte.request.json()
    } catch {
      recu = undefined
    }
    const brut = (recu as { code?: unknown } | undefined)?.code
    const code = typeof brut === 'string' ? normaliserCode(brut) : null
    if (code === null) return json(400, { erreur: 'code-invalide' })

    const vise = await compteParCode(db, await empreinte(code))
    /*
     * Le même refus qu'un code inconnu, dans les deux cas.
     *
     * Distinguer « ce code n'existe pas » de « ce code est le tien » dirait à
     * qui essaie des codes lesquels tombent juste. À quatre-vingts bits ça ne
     * changerait rien en pratique, mais la règle ne coûte rien à tenir.
     */
    if (vise === null) return json(404, { erreur: 'code-inconnu' })

    await rattacherAppareil(db, await empreinte(jeton), vise.id, maintenant)
    const repris = (await compteParId(db, vise.id)) ?? vise
    return json(200, vue(repris, true, maintenant))
  }

  return json(404, { erreur: 'chemin-inconnu' })
}
