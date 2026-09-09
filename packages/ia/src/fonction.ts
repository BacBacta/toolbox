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
 * **Ce qui manque encore, et qu'il faut savoir.** Le brief exige un quota par
 * compte (`credits > 0`, sinon 402) et un journal des coûts dans `ai_calls`.
 * Les comptes vivent dans D1, qui n'existe pas encore. En attendant, le
 * garde-fou est grossier mais explicite : la fonction refuse de servir tant
 * qu'on ne l'a pas **ouverte à la main**. Poser la clef ne suffit donc pas à
 * ouvrir un robinet qui coûte de l'argent à chaque appel ; il faut le vouloir.
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

/**
 * Le porteur d'abonnement, quand il y en aura.
 *
 * Il n'y a pas encore de comptes : ils vivent dans D1, qui arrive avec la
 * phase 2. La fonction rend donc faux, et l'étage 3 est fermé à tout le monde
 * — ce qui est la bonne valeur par défaut : on ne facture personne, et on ne
 * dépense pas non plus.
 *
 * C'est une couture d'une ligne. Le jour où les comptes existent, elle lit le
 * plan du compte ; rien d'autre ne bouge, parce que la décision de ce qui
 * relève de l'abonnement est déjà prise ailleurs, gratuitement et sans réseau.
 */
function abonne(): boolean {
  return false
}

/** Ce que l'adaptateur d'un hébergeur doit renvoyer : un code et un corps. */
export interface Reponse {
  readonly statut: number
  readonly corps: Record<string, unknown>
}

export async function repondre(corpsRecu: unknown, r: Reglages): Promise<Reponse> {
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
  if (etageDe(demande, CATALOGUE) === 3 && !abonne()) {
    return {
      statut: 402,
      corps: {
        erreur: 'abonnement-requis',
        pourquoi:
          'Cette demande vaut plusieurs outils d’un coup. Compose-les un par un, ou prends un abonnement.',
      },
    }
  }

  try {
    const resultat = await traiter(demande, fournisseurChoisi(r), r.tauxFcfa)

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

    if (resultat.sorte !== 'reussi') {
      return {
        statut: 422,
        corps: {
          erreur: 'le modèle n’a pas produit un registre utilisable',
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
