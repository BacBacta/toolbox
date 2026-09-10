import { compteNeuf } from './plan.js'
import type { Compte, Plan } from './plan.js'
import type { Paiement, Suite } from './paiement.js'

/**
 * Les écritures. C'est le seul module d'ici qui touche à quelque chose.
 *
 * Tout ce qui décide est ailleurs, en fonctions pures : ce fichier ne fait que
 * lire et écrire ce qu'elles ont décidé. C'est ce qui permet d'éprouver la
 * règle économique — dont l'idempotence du rejeu, critère d'arrêt de la phase 3
 * — sans base du tout.
 *
 * L'interface de D1 est redécrite ici, en petit. Le Worker reçoit le vrai
 * objet ; les essais en passent un faux. Rien n'oblige à charger l'exécution
 * de Cloudflare pour vérifier une requête.
 */

export interface Requete {
  bind(...valeurs: unknown[]): Requete
  first<T>(): Promise<T | null>
  all<T>(): Promise<{ readonly results: readonly T[] }>
  run(): Promise<{ readonly meta?: { readonly changes?: number } }>
}

export interface BaseD1 {
  prepare(sql: string): Requete
  batch(requetes: readonly Requete[]): Promise<unknown>
}

interface LigneCompte {
  readonly id: string
  readonly plan: string
  readonly plan_expire: number | null
  readonly credits: number
}

function versCompte(ligne: LigneCompte): Compte {
  return {
    id: ligne.id,
    plan: ligne.plan === 'atelier' ? 'atelier' : ('essai' as Plan),
    planExpire: ligne.plan_expire,
    credits: ligne.credits,
  }
}

/**
 * Le compte que porte cet appareil, ouvert s'il n'existait pas.
 *
 * L'ouverture est paresseuse et sans un mot : personne ne s'inscrit pour se
 * servir de l'atelier (§ 2), et le serveur ne voit un appareil qu'au premier
 * appel qui coûte quelque chose.
 *
 * L'ordre des écritures n'est pas indifférent, et la clé étrangère le décide :
 * un appareil ne peut pas désigner un compte qui n'existe pas. On ouvre donc un
 * compte candidat, puis on tente le lien. Deux requêtes simultanées d'un même
 * appareil neuf se disputent la clé primaire de `appareils`, `INSERT OR IGNORE`
 * en laisse passer une, et la relecture dit laquelle a gagné — la perdante
 * remballe son candidat, qui n'a jamais porté personne.
 *
 * `INSERT OR IGNORE` sur les comptes compte autant : sans lui, revenir
 * remettrait les crédits à cinq et l'essai n'aurait pas de fin.
 */
export async function compteDeLAppareil(
  db: BaseD1,
  empreinte: string,
  maintenant: Date,
): Promise<Compte> {
  const t = maintenant.getTime()
  const candidat = compteNeuf(crypto.randomUUID())

  await db
    .prepare(
      'INSERT OR IGNORE INTO comptes (id, plan, plan_expire, credits, cree_le) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(candidat.id, candidat.plan, candidat.planExpire, candidat.credits, t)
    .run()

  await db
    .prepare('INSERT OR IGNORE INTO appareils (empreinte, compte_id, vu_le) VALUES (?, ?, ?)')
    .bind(empreinte, candidat.id, t)
    .run()

  const lien = await db
    .prepare('SELECT compte_id FROM appareils WHERE empreinte = ?')
    .bind(empreinte)
    .first<{ compte_id: string }>()
  const compteId = lien?.compte_id ?? candidat.id

  if (compteId !== candidat.id) {
    // Course perdue, ou appareil déjà connu : le candidat n'a jamais servi. La
    // condition sur `appareils` est une ceinture — elle rend impossible de
    // retirer un compte qui porte quelqu'un.
    await db
      .prepare(
        'DELETE FROM comptes WHERE id = ? AND NOT EXISTS (SELECT 1 FROM appareils WHERE compte_id = ?)',
      )
      .bind(candidat.id, candidat.id)
      .run()
  }

  const ligne = await db
    .prepare('SELECT id, plan, plan_expire, credits FROM comptes WHERE id = ?')
    .bind(compteId)
    .first<LigneCompte>()

  // La base a répondu sans la ligne qu'elle vient d'écrire : plutôt que de
  // rendre un compte inventé, on le dit.
  if (ligne === null) throw new Error(`compte introuvable après ouverture : ${compteId}`)

  await db.prepare('UPDATE appareils SET vu_le = ? WHERE empreinte = ?').bind(t, empreinte).run()
  return versCompte(ligne)
}

export async function compteParId(db: BaseD1, id: string): Promise<Compte | null> {
  const ligne = await db
    .prepare('SELECT id, plan, plan_expire, credits FROM comptes WHERE id = ?')
    .bind(id)
    .first<LigneCompte>()
  return ligne === null ? null : versCompte(ligne)
}

/**
 * Retire un crédit, ou rend faux.
 *
 * La condition est **dans la requête** et non autour d'elle. Deux appels
 * simultanés d'un compte à qui il reste un crédit passeraient tous les deux un
 * contrôle fait en JavaScript, et on paierait deux générations pour un crédit ;
 * ici, le second ne change aucune ligne et l'apprend.
 */
export async function prendreUnCredit(db: BaseD1, compteId: string): Promise<boolean> {
  const r = await db
    .prepare('UPDATE comptes SET credits = credits - 1 WHERE id = ? AND credits > 0')
    .bind(compteId)
    .run()
  return (r.meta?.changes ?? 0) > 0
}

/**
 * Rend le crédit d'un appel qui n'est jamais parti.
 *
 * On réserve avant d'appeler, parce que c'est le seul ordre qui empêche de
 * dépenser deux fois. Reste le cas où le modèle n'a jamais été joint : aucun
 * jeton n'a été consommé, et retenir le crédit ferait payer une panne de
 * réseau à quelqu'un qui n'en a que cinq.
 */
export async function rendreUnCredit(db: BaseD1, compteId: string): Promise<void> {
  await db.prepare('UPDATE comptes SET credits = credits + 1 WHERE id = ?').bind(compteId).run()
}

export interface AppelIa {
  readonly compteId: string
  readonly etage: number
  readonly jetonsEntree: number | null
  readonly jetonsSortie: number | null
  readonly coutXaf: number | null
  readonly ok: boolean
}

/** Le journal des coûts. Sans lui, le plafond du § 8 ne se mesure pas. */
export async function journaliser(db: BaseD1, appel: AppelIa, maintenant: Date): Promise<void> {
  await db
    .prepare(
      'INSERT INTO appels_ia (id, compte_id, etage, jetons_entree, jetons_sortie, cout_xaf, ok, cree_le)' +
        ' VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      crypto.randomUUID(),
      appel.compteId,
      appel.etage,
      appel.jetonsEntree,
      appel.jetonsSortie,
      appel.coutXaf,
      appel.ok ? 1 : 0,
      maintenant.getTime(),
    )
    .run()
}

/** Le coût moyen d'une génération, en francs. Le § 8 le plafonne à 1 F. */
export async function coutMoyenXaf(db: BaseD1): Promise<{ appels: number; moyenne: number }> {
  const ligne = await db
    .prepare('SELECT COUNT(*) AS appels, AVG(cout_xaf) AS moyenne FROM appels_ia WHERE cout_xaf IS NOT NULL')
    .first<{ appels: number; moyenne: number | null }>()
  return { appels: ligne?.appels ?? 0, moyenne: ligne?.moyenne ?? 0 }
}

// ── le code de récupération ────────────────────────────────────────────────

export async function poserCode(db: BaseD1, compteId: string, empreinte: string): Promise<void> {
  // Un compte n'a qu'un code : en tirer un neuf annule le précédent, ce qui est
  // la seule chose à faire quand on croit l'avoir montré à quelqu'un.
  await db.prepare('UPDATE comptes SET code_empreinte = ? WHERE id = ?').bind(empreinte, compteId).run()
}

export async function compteParCode(db: BaseD1, empreinte: string): Promise<Compte | null> {
  const ligne = await db
    .prepare('SELECT id, plan, plan_expire, credits FROM comptes WHERE code_empreinte = ?')
    .bind(empreinte)
    .first<LigneCompte>()
  return ligne === null ? null : versCompte(ligne)
}

/**
 * Rattache cet appareil à ce compte.
 *
 * L'appareil quitte son compte précédent — celui qu'on lui avait ouvert en
 * arrivant — sans que ce compte disparaisse : il peut porter d'autres
 * appareils, et il porte peut-être un abonnement.
 */
export async function rattacherAppareil(
  db: BaseD1,
  empreinte: string,
  compteId: string,
  maintenant: Date,
): Promise<void> {
  await db
    .prepare(
      'INSERT INTO appareils (empreinte, compte_id, vu_le) VALUES (?, ?, ?)' +
        ' ON CONFLICT(empreinte) DO UPDATE SET compte_id = excluded.compte_id, vu_le = excluded.vu_le',
    )
    .bind(empreinte, compteId, maintenant.getTime())
    .run()
}

// ── les paiements ──────────────────────────────────────────────────────────

export async function ouvrirPaiement(db: BaseD1, p: Paiement): Promise<void> {
  await db
    .prepare(
      'INSERT INTO paiements (id, compte_id, fournisseur, reference, montant_xaf, etat, telephone, cree_le)' +
        ' VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(p.id, p.compteId, p.fournisseur, p.reference, p.montantXaf, p.etat, p.telephone, p.creeLe)
    .run()
}

interface LignePaiement {
  readonly id: string
  readonly compte_id: string
  readonly fournisseur: string
  readonly reference: string
  readonly montant_xaf: number
  readonly etat: string
  readonly telephone: string
  readonly cree_le: number
}

function versPaiement(l: LignePaiement): Paiement {
  const etat = l.etat === 'reussi' ? 'reussi' : l.etat === 'echoue' ? 'echoue' : 'attente'
  return {
    id: l.id,
    compteId: l.compte_id,
    fournisseur: l.fournisseur,
    reference: l.reference,
    montantXaf: l.montant_xaf,
    etat,
    telephone: l.telephone,
    creeLe: l.cree_le,
  }
}

const COLONNES_PAIEMENT =
  'id, compte_id, fournisseur, reference, montant_xaf, etat, telephone, cree_le'

export async function paiementParReference(
  db: BaseD1,
  fournisseur: string,
  reference: string,
): Promise<Paiement | null> {
  const l = await db
    .prepare(`SELECT ${COLONNES_PAIEMENT} FROM paiements WHERE fournisseur = ? AND reference = ?`)
    .bind(fournisseur, reference)
    .first<LignePaiement>()
  return l === null ? null : versPaiement(l)
}

export async function paiementParId(db: BaseD1, id: string): Promise<Paiement | null> {
  const l = await db
    .prepare(`SELECT ${COLONNES_PAIEMENT} FROM paiements WHERE id = ?`)
    .bind(id)
    .first<LignePaiement>()
  return l === null ? null : versPaiement(l)
}

/**
 * Écrit ce que le rappel a décidé — le paiement et le compte, ensemble.
 *
 * `batch` est une transaction chez D1 : le paiement ne peut pas passer à
 * « réussi » sans que l'abonnement suive, ni l'inverse. Le contraire laisserait
 * quelqu'un ayant payé sans abonnement, et un rejeu ne le rattraperait pas
 * puisque le paiement ne serait plus en attente.
 *
 * Le numéro suit le compte qui vient de payer. Il est unique en base, et il
 * peut déjà appartenir à un compte abandonné — un téléphone perdu, un
 * appareil neuf. Un numéro désigne une personne : il va au compte dont elle se
 * sert aujourd'hui. L'ancien compte garde tout le reste.
 */
export async function ecrireSuite(db: BaseD1, suite: Suite, brut: string): Promise<void> {
  if (suite.sorte === 'inconnu' || suite.sorte === 'deja-traite') return

  if (suite.sorte === 'echoue') {
    await db
      .prepare('UPDATE paiements SET etat = ?, brut = ? WHERE id = ?')
      .bind('echoue', brut, suite.paiement.id)
      .run()
    return
  }

  await db.batch([
    db
      .prepare('UPDATE paiements SET etat = ?, brut = ? WHERE id = ? AND etat = ?')
      .bind('reussi', brut, suite.paiement.id, 'attente'),
    db
      .prepare('UPDATE comptes SET telephone = NULL WHERE telephone = ? AND id != ?')
      .bind(suite.paiement.telephone, suite.compte.id),
    db
      .prepare('UPDATE comptes SET plan = ?, plan_expire = ?, credits = ?, telephone = ? WHERE id = ?')
      .bind(
        suite.compte.plan,
        suite.compte.planExpire,
        suite.compte.credits,
        suite.paiement.telephone,
        suite.compte.id,
      ),
  ])
}
