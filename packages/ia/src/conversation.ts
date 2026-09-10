import type { Laissez, Seance } from '@a237/comptes'
import { controlerQuota, premierTour, relireLaissez, signerLaissez, tourSuivant } from '@a237/comptes'
import type { FamilleOutil } from '@a237/engine'
import { CATALOGUE, etageDe, familleDe } from '@a237/engine'
import type { TourConversation } from './fournisseur.js'

/**
 * Ce qui décide, avant qu'un octet parte chez le modèle.
 *
 * Séparé du flux pour la même raison que `controler` l'est du dépôt : ce qui
 * décide est du calcul, et le flux n'est qu'une tuyauterie. Un essai qui doit
 * ouvrir une connexion pour vérifier qu'un jeton rafistolé est refusé ne
 * vérifie pas grand-chose.
 */

/** Une demande plus longue qu'un paragraphe n'est pas une demande d'outil. */
export const MAX_MESSAGE = 400
/** Au-delà, la conversation ne tient plus dans une invite abordable. */
export const MAX_MESSAGES = 16

export interface DemandeChat {
  readonly messages?: unknown
  /** L'outil déjà sur la table, tel que le dernier tour l'a rendu. */
  readonly outil?: unknown
  /** Le laissez-passer du tour précédent. Absent au premier tour. */
  readonly conversation?: unknown
}

export interface Refus {
  readonly statut: number
  readonly corps: Record<string, unknown>
}

export interface Accord {
  readonly conversation: readonly TourConversation[]
  readonly famille: FamilleOutil | null
  readonly etage: 1 | 2 | 3
  /** Le laissez-passer à rendre au client pour le tour d'après. */
  readonly laissez: Laissez
  /** Vrai quand ce tour a coûté un crédit — le premier d'une conversation. */
  readonly paye: boolean
}

/**
 * Les messages, ramenés à ce qu'on accepte d'envoyer.
 *
 * On ne fait confiance à rien de ce qui arrive : ni au nombre de messages, ni à
 * leur longueur, ni à qui les a dits. Un client qui enverrait cinquante tours
 * ferait une invite que personne n'a budgétée.
 */
function messagesPropres(brut: unknown): readonly TourConversation[] | null {
  if (!Array.isArray(brut) || brut.length === 0 || brut.length > MAX_MESSAGES) return null

  const propres: TourConversation[] = []
  for (const m of brut) {
    if (typeof m !== 'object' || m === null) return null
    const { qui, texte } = m as { qui?: unknown; texte?: unknown }
    if (typeof texte !== 'string') return null
    const coupe = texte.trim().slice(0, MAX_MESSAGE)
    if (coupe === '') continue
    propres.push({ qui: qui === 'agent' ? 'agent' : 'personne', texte: coupe })
  }

  // Le dernier mot est à la personne : sinon il n'y a rien à répondre.
  const dernier = propres.at(-1)
  if (dernier === undefined || dernier.qui !== 'personne') return null
  return propres
}

/**
 * L'outil sur la table, remis dans la conversation.
 *
 * C'est ainsi que l'affinage marche, et sans protocole de différences : le
 * modèle voit ce qu'il a rendu au tour d'avant, et la personne lui dit quoi y
 * changer. Il n'y a qu'un seul état de l'outil dans l'invite, le dernier —
 * garder les précédents doublerait le coût de chaque tour pour montrer des
 * versions que personne ne veut plus.
 */
function avecLOutil(
  messages: readonly TourConversation[],
  outil: unknown,
): readonly TourConversation[] {
  if (outil === undefined || outil === null) return messages
  /*
   * Le rappel vient de **la personne**, et non de l'agent.
   *
   * Mesuré sur un vrai deuxième tour : posé comme un message d'agent, il porte
   * du JSON nu — et le modèle imite ce qu'il croit être sa propre dernière
   * réponse. Il répondait donc par l'outil seul, sans l'enveloppe, et le tour
   * était perdu alors qu'il avait bien travaillé. Mis dans la bouche de la
   * personne, c'est ce que c'est : quelqu'un qui montre l'outil qu'il a sous
   * les yeux avant de dire quoi y changer.
   */
  const rappel: TourConversation = {
    qui: 'personne',
    /*
     * La forme de la réponse est redite ici, et pas seulement dans l'invite.
     *
     * Une conversation qui ressemble à une conversation fait glisser le modèle
     * dans le registre de la conversation : mesuré sur de vrais deuxièmes
     * tours, il répondait en prose — « Voilà, j'ai retiré la date » — sans une
     * accolade, et en affirmant une modification qui n'était nulle part. Ce
     * qui est dit une fois au début d'un long échange ne pèse plus assez à la
     * fin ; ce qui est dit juste avant pèse.
     */
    texte:
      `Voici l’outil tel qu’il est en ce moment :\n${JSON.stringify(outil)}\n\n` +
      'Réponds comme d’habitude : un objet JSON avec « mot » et « outil », et l’outil entier.',
  }
  // Avant le dernier mot de la personne : elle parle de cet outil-là.
  return [...messages.slice(0, -1), rappel, ...messages.slice(-1)]
}

/**
 * Décide si ce tour a lieu, et à quel prix.
 *
 * Le crédit se prend au premier tour d'une conversation, jamais aux suivants —
 * mais « c'est la suite d'une conversation » ne se croit pas sur parole : il
 * faut le laissez-passer que le serveur a signé au tour d'avant.
 */
export async function accorder(
  recu: DemandeChat,
  seance: Seance,
  secret: string,
): Promise<Accord | Refus> {
  const messages = messagesPropres(recu.messages)
  if (messages === null) return { statut: 400, corps: { erreur: 'messages-illisibles' } }

  const demande = messages.at(-1)?.texte ?? ''
  const etage = etageDe(demande, CATALOGUE)

  const jeton = typeof recu.conversation === 'string' ? recu.conversation : null
  const suite = jeton === null ? null : await relireLaissez(jeton, secret, seance.maintenant)

  /*
   * Un laissez-passer valable mais qui n'est pas le sien ne sert à rien : on le
   * traite comme absent, ce qui fait payer un crédit — au bon compte.
   */
  const enCours = suite !== null && suite.compteId === seance.compte.id ? suite : null

  if (enCours === null) {
    const verdict = controlerQuota(seance.compte, etage, seance.maintenant)
    if (verdict.sorte !== 'passe') {
      return { statut: 402, corps: { erreur: verdict.sorte, pourquoi: verdict.pourquoi } }
    }
    if (!(await seance.prendreUnCredit())) {
      return {
        statut: 402,
        corps: {
          erreur: 'credits-epuises',
          pourquoi: 'Tes compositions sont utilisées. L’abonnement en donne quarante par mois.',
        },
      }
    }
  }

  return {
    conversation: avecLOutil(messages, recu.outil),
    famille: familleDe(recu.outil),
    etage,
    laissez: enCours === null ? premierTour(seance.compte.id, seance.maintenant) : tourSuivant(enCours),
    paye: enCours === null,
  }
}

/** Ce que le client renvoie au tour suivant pour ne pas repayer. */
export function laissezPourLeClient(accord: Accord, secret: string): Promise<string> {
  return signerLaissez(accord.laissez, secret)
}

export function estUnRefus(x: Accord | Refus): x is Refus {
  return 'statut' in x
}
