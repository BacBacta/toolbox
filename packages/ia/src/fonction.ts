import type { Seance } from '@a237/comptes'
import { controlerQuota } from '@a237/comptes'
import type { RegistreDemande } from '@a237/engine'
import { CATALOGUE, etageDe } from '@a237/engine'
import type { Fournisseur } from './fournisseur.js'
import { ErreurFournisseur, gemini, openrouter } from './fournisseur.js'
import { traiter } from './traiter.js'

/**
 * Le proxy IA (§ 3, « Appeler l'IA »).
 *
 * Il existe pour une seule raison : **aucune clef d'API dans le client, jamais**
 * (invariant § 2.8). La clef est lue ici, dans l'environnement de la fonction,
 * et ne traverse pas la frontière. Le client ne reçoit qu'une configuration
 * déjà validée — jamais de HTML, jamais de code (§ 3, point 5).
 *
 * Il ne connaît pas son hébergeur. `repondre` prend une demande et des
 * réglages, et rend un code et un corps ; l'adaptateur qui la relie à un
 * `Request` tient en dix lignes et vit ailleurs. C'est ce qui a permis de
 * passer de Vercel à Cloudflare sans toucher à une seule décision — et ce qui
 * permet d'éprouver tout ce fichier sans réseau, sans clef et sans serveur.
 *
 * Les réglages arrivent en argument et ne se lisent pas dans
 * `process.env` : un Worker n'a pas de `process`, ses variables arrivent dans
 * un objet passé à chaque requête. Les lire au chargement du module aurait
 * marché sur Vercel et rendu partout `undefined` sur Cloudflare.
 *
 * Le quota et le journal des coûts sont **obligatoires**, et c'est voulu : il
 * n'existe pas de chemin par lequel une génération se paie sans être comptée.
 * `repondre` ne connaît pourtant ni D1 ni les comptes — elle reçoit une séance,
 * qui porte le compte déjà lu et sait retirer, rendre et journaliser. Ce qui
 * décide du droit de composer reste dans `@a237/comptes` ; ce fichier
 * l'applique.
 */

/** Une demande plus longue qu'un paragraphe n'est pas une demande d'outil. */
const MAX_DEMANDE = 400

/** Ce que l'environnement dit, une fois lu et interprété. */
export interface Reglages {
  readonly clef: string
  /** Poser la clef ne suffit pas : il faut avoir voulu ouvrir. */
  readonly ouverte: boolean
  readonly fournisseur: string
  readonly modele: string
  readonly prixEntree: number
  readonly prixSortie: number
  /** Le taux sert au journal des coûts. Une décision de gestion, pas une constante. */
  readonly tauxFcfa: number
}

/** Ce qu'un hébergeur nous tend : des chaînes, ou rien. */
export type Environnement = Readonly<Record<string, string | undefined>>

const MODELE_PAR_DEFAUT = 'google/gemini-2.5-flash-lite'

function nombre(brut: string | undefined, defaut: number): number {
  const n = Number(brut)
  return Number.isFinite(n) ? n : defaut
}

export function reglagesDe(env: Environnement): Reglages {
  return {
    clef: env.A237_CLEF_IA ?? '',
    ouverte: env.A237_IA_OUVERTE === '1',
    fournisseur: env.A237_FOURNISSEUR ?? 'openrouter',
    modele: env.A237_MODELE ?? MODELE_PAR_DEFAUT,
    prixEntree: nombre(env.A237_PRIX_ENTREE, 0.1),
    prixSortie: nombre(env.A237_PRIX_SORTIE, 0.4),
    tauxFcfa: nombre(env.A237_TAUX_FCFA, 600),
  }
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

/** Ce que l'adaptateur d'un hébergeur doit renvoyer : un code et un corps. */
export interface Reponse {
  readonly statut: number
  readonly corps: Record<string, unknown>
}

export async function repondre(
  corpsRecu: unknown,
  r: Reglages,
  seance: Seance,
): Promise<Reponse> {
  if (r.clef === '' || !r.ouverte) {
    // 503 et non 500 : ce n'est pas cassé, ce n'est pas encore branché. Le
    // client le dit tel quel à l'utilisateur au lieu de tourner dans le vide.
    return {
      statut: 503,
      corps: { erreur: 'la composition par le modèle n’est pas encore ouverte' },
    }
  }

  const recu = corpsRecu as { demande?: unknown } | undefined
  const demande = typeof recu?.demande === 'string' ? recu.demande.trim() : ''
  if (demande === '' || demande.length > MAX_DEMANDE) {
    return { statut: 400, corps: { erreur: 'demande absente ou trop longue' } }
  }

  /*
   * Le modèle économique, appliqué **avant** de dépenser.
   *
   * Une petite tâche se paie à l'appel ; une demande qui en vaut plusieurs
   * demande un abonnement. Pour que ça tienne, il faut reconnaître la grosse
   * demande sans la faire — sinon on annonce une facture, pas un prix. C'est
   * l'étage 1 qui tranche, et il ne coûte rien.
   *
   * Le contrôle est ici et non dans le navigateur : un prix qu'on peut
   * contourner avec les outils de développement n'est pas un prix.
   */
  const etage = etageDe(demande, CATALOGUE)
  const verdict = controlerQuota(seance.compte, etage, seance.maintenant)
  if (verdict.sorte !== 'passe') {
    return { statut: 402, corps: { erreur: verdict.sorte, pourquoi: verdict.pourquoi } }
  }

  /*
   * La réservation, et la course qu'elle tranche.
   *
   * Le verdict ci-dessus a lu un compte ; entre cette lecture et ici, une
   * autre requête du même compte a pu prendre le dernier crédit. C'est la base
   * qui arbitre, et elle le dit en ne changeant aucune ligne.
   */
  if (!(await seance.prendreUnCredit())) {
    return {
      statut: 402,
      corps: {
        erreur: 'credits-epuises',
        pourquoi: 'Tes compositions sont utilisées. L’abonnement en donne quarante par mois.',
      },
    }
  }

  try {
    const resultat = await traiter(demande, fournisseurChoisi(r), r.tauxFcfa)

    /*
     * Le journal, et ce qu'il permet de tenir.
     *
     * Le § 8 plafonne le coût moyen d'une génération à un franc, et le § 7 fait
     * de dix générations mesurées le critère d'arrêt de la phase 4. Une
     * promesse qu'on ne mesure pas est une croyance.
     *
     * Un refus du modèle et une sortie invalide sont journalisés aussi, avec
     * `ok` à faux : ils ont coûté des jetons, et les omettre ferait
     * sous-estimer la dépense réelle de tout le monde.
     */
    await seance.journaliser({
      etage,
      jetonsEntree: resultat.cout.entree,
      jetonsSortie: resultat.cout.sortie,
      coutXaf: resultat.cout.fcfa,
      ok:
        resultat.sorte === 'reussi' ||
        resultat.sorte === 'calcule' ||
        resultat.sorte === 'page' ||
        resultat.sorte === 'formulaire',
    })

    // Le coût part dans le journal du serveur en attendant `ai_calls` : la
    // promesse du brief est « moins d'un franc par génération », et une
    // promesse qu'on ne mesure pas est une croyance.
    console.log(
      JSON.stringify({
        evenement: 'appel_ia',
        modele: r.modele,
        essais: resultat.essais,
        fcfa: resultat.cout.fcfa,
        issue: resultat.sorte,
      }),
    )

    if (resultat.sorte === 'hors-sujet') {
      /*
       * Le modèle a dit non, et c'est une réponse, pas une panne. Un 200 : la
       * requête a abouti, la réponse est négative. Renvoyer une erreur ferait
       * réessayer le client, et repayer.
       */
      return { statut: 200, corps: { impossible: resultat.pourquoi, fcfa: resultat.cout.fcfa } }
    }

    if (resultat.sorte === 'calcule') {
      return { statut: 200, corps: { calcul: resultat.calcul, fcfa: resultat.cout.fcfa } }
    }

    if (resultat.sorte === 'page') {
      return { statut: 200, corps: { page: resultat.page, fcfa: resultat.cout.fcfa } }
    }

    if (resultat.sorte === 'formulaire') {
      return { statut: 200, corps: { formulaire: resultat.formulaire, fcfa: resultat.cout.fcfa } }
    }

    if (resultat.sorte !== 'reussi') {
      return {
        statut: 422,
        corps: {
          erreur: 'le modèle n’a pas produit un outil utilisable',
          details: resultat.erreurs.map((e) => `${e.chemin} : ${e.message}`),
          // Un échec a coûté deux tours. L'omettre ferait sous-estimer la
          // dépense réelle, et le brief demande le coût de chaque appel (§ 8).
          fcfa: resultat.cout.fcfa,
        },
      }
    }

    const registre: RegistreDemande = resultat.registre
    return { statut: 200, corps: { registre, fcfa: resultat.cout.fcfa } }
  } catch (cause) {
    // Le message d'un fournisseur peut contenir la clef en écho : on ne le
    // propage pas au client, on le garde côté serveur.
    console.error('appel_ia_echoue', cause)

    /*
     * Rien n'est revenu : le crédit retourne au compte.
     *
     * Aucun de ces chemins n'a produit de sortie utilisable, et aucun n'est de
     * la faute de qui a demandé — notre compte fournisseur est à sec, notre
     * clef est refusée, ou le réseau a lâché. Retenir le crédit ferait payer
     * notre panne à quelqu'un qui en a cinq.
     */
    await seance.rendreUnCredit()

    if (cause instanceof ErreurFournisseur && cause.sorte === 'credit-epuise') {
      /*
       * 402, comme le brief le prévoit (§ 3). Ce n'est pas une panne : le
       * compte est à recharger, et le dire autrement enverrait quelqu'un
       * chercher un problème qui n'existe pas.
       */
      return { statut: 402, corps: { erreur: 'plus de crédit pour composer' } }
    }

    return { statut: 502, corps: { erreur: 'le modèle n’a pas répondu' } }
  }
}
