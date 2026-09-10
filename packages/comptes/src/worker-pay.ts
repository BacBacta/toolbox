import { compteParId, ecrireSuite, ouvrirPaiement, paiementParId, paiementParReference } from './base.js'
import type { BaseD1 } from './base.js'
import { fauxFournisseur } from './faux.js'
import { jetonValide } from './identite.js'
import { appliquerRappel, montantDuMois, normaliserTelephone } from './paiement.js'
import type { Fournisseur, Paiement } from './paiement.js'
import { jetonDeLEntete, ouvrirSeance } from './seance.js'

/**
 * `/api/pay` — encaisser un mois.
 *
 * Trois chemins : on démarre, on demande où ça en est, et le fournisseur nous
 * rappelle. Le troisième est le seul qui compte vraiment, et c'est le seul qui
 * n'est pas appelé par notre client : **sa signature se vérifie**, sinon
 * n'importe qui s'offre un abonnement avec `curl`.
 *
 * Le fournisseur se choisit dans l'environnement. Aujourd'hui il n'y en a
 * qu'un, et il n'encaisse rien : ouvrir un compte marchand demande des pièces
 * et du délai (§ 7, phase 0), et rien de ce qui est écrit ici n'avait besoin
 * d'attendre ça. Le jour où CamPay ou Fapshi arrive, c'est ce même chemin qui
 * s'exécute — le faux signe déjà comme eux.
 */

interface Contexte {
  readonly request: Request
  readonly env: Readonly<Record<string, string | undefined | BaseD1>> & {
    readonly COMPTES?: BaseD1
  }
}

function json(statut: number, corps: unknown): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function texte(env: Contexte['env'], clef: string): string {
  const v = env[clef]
  return typeof v === 'string' ? v : ''
}

/**
 * Sans secret, pas de paiement.
 *
 * Le secret sert à vérifier la signature des rappels. Sans lui on ne saurait
 * pas distinguer le fournisseur de n'importe qui, et le refuser franchement
 * vaut mieux que d'encaisser à l'aveugle.
 */
function fournisseurChoisi(env: Contexte['env']): Fournisseur | null {
  const secret = texte(env, 'A237_PAIEMENT_SECRET')
  if (secret === '') return null
  return fauxFournisseur(secret)
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
    console.error('pay_echoue', cause)
    return json(503, { erreur: 'les comptes sont indisponibles' })
  }
}

async function servir(contexte: Contexte): Promise<Response> {
  const db = contexte.env.COMPTES
  if (db === undefined) return json(503, { erreur: 'les comptes ne sont pas branchés' })

  const fournisseur = fournisseurChoisi(contexte.env)
  if (fournisseur === null) return json(503, { erreur: 'le paiement n’est pas encore ouvert' })

  const chemin = new URL(contexte.request.url).pathname
  const methode = contexte.request.method
  const maintenant = new Date()

  // ── le rappel : le seul chemin que notre client n'appelle pas ────────────
  if (chemin.endsWith('/pay/rappel') && methode === 'POST') {
    /*
     * Le corps se lit **en texte** et non en JSON, parce que c'est le texte
     * exact qui est signé. Le relire depuis un objet reconstruit changerait un
     * espace ou l'ordre des clés, et la signature ne tiendrait plus.
     */
    const brut = await contexte.request.text()
    const rappel = await fournisseur.lireRappel(brut, contexte.request.headers)
    if (rappel === null) return json(401, { erreur: 'signature-invalide' })

    const paiement = await paiementParReference(db, fournisseur.nom, rappel.reference)
    const compte = paiement === null ? null : await compteParId(db, paiement.compteId)
    if (paiement === null || compte === null) {
      // 200 et non 404 : un rappel qu'on ne reconnaît pas n'est pas à
      // rejouer, et un fournisseur qui reçoit une erreur réessaie en boucle.
      return json(200, { recu: true, applique: false })
    }

    const suite = appliquerRappel(paiement, compte, rappel, maintenant)
    await ecrireSuite(db, suite, brut)
    return json(200, { recu: true, applique: suite.sorte === 'reussi', etat: suite.sorte })
  }

  // ── les deux autres : notre client, qui se présente ──────────────────────
  const jeton = jetonDeLEntete(contexte.request.headers)
  if (jeton === null || !jetonValide(jeton)) {
    return json(401, { erreur: 'appareil-inconnu', pourquoi: 'Cet appareil ne s’est pas présenté.' })
  }
  const seance = await ouvrirSeance(db, jeton, maintenant)

  if (chemin.endsWith('/pay/demarrer') && methode === 'POST') {
    let recu: unknown
    try {
      recu = await contexte.request.json()
    } catch {
      recu = undefined
    }
    const saisi = (recu as { telephone?: unknown } | undefined)?.telephone
    const telephone = typeof saisi === 'string' ? normaliserTelephone(saisi) : null
    if (telephone === null) {
      return json(400, {
        erreur: 'telephone-invalide',
        pourquoi: 'Un numéro camerounais : neuf chiffres commençant par 6.',
      })
    }

    const paiement: Paiement = {
      id: crypto.randomUUID(),
      compteId: seance.compte.id,
      fournisseur: fournisseur.nom,
      // Notre identifiant sert de référence : c'est lui que le fournisseur
      // nous rendra, et c'est sur lui que porte l'unicité qui empêche le rejeu.
      reference: crypto.randomUUID(),
      montantXaf: montantDuMois(),
      etat: 'attente',
      telephone,
      creeLe: maintenant.getTime(),
    }
    await ouvrirPaiement(db, paiement)
    const amorce = await fournisseur.demarrer({
      telephone,
      montantXaf: paiement.montantXaf,
      reference: paiement.reference,
    })
    return json(200, {
      id: paiement.id,
      montantXaf: paiement.montantXaf,
      consigne: amorce.consigne,
    })
  }

  const suivi = /\/pay\/([0-9a-f-]{36})$/.exec(chemin)
  if (suivi !== null && methode === 'GET') {
    const paiement = await paiementParId(db, suivi[1] ?? '')
    /*
     * Le même « introuvable » pour un paiement absent et pour celui d'un
     * autre : répondre « ce n'est pas le tien » dirait à qui essaie des
     * identifiants lesquels existent.
     */
    if (paiement === null || paiement.compteId !== seance.compte.id) {
      return json(404, { erreur: 'paiement-inconnu' })
    }
    const compte = await compteParId(db, seance.compte.id)
    return json(200, {
      etat: paiement.etat,
      plan: compte?.plan ?? 'essai',
      credits: compte?.credits ?? 0,
    })
  }

  return json(404, { erreur: 'chemin-inconnu' })
}
