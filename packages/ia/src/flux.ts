import type { Seance } from '@a237/comptes'
import type { Ebauche, LectureTour } from '@a237/engine'
import { ebaucher, lireTour, numeroDansLaDemande } from '@a237/engine'
import { batirInviteAgent } from './agent.js'
import type { Accord } from './conversation.js'
import { laissezPourLeClient } from './conversation.js'
import { couter } from './cout.js'
import type { Cout } from './cout.js'
import { ErreurFournisseur } from './fournisseur.js'
import type { Fournisseur } from './fournisseur.js'

/**
 * Un tour d'agent, rendu au fur et à mesure.
 *
 * Ce qui sort d'ici est une suite d'**événements**, et non une réponse : le mot
 * s'écrit lettre par lettre dans la conversation, l'ébauche de l'outil se
 * redessine à chaque morceau, et le dernier événement porte ce qui n'existe
 * qu'à la fin — l'outil validé, le coût, le solde, et le laissez-passer du
 * tour suivant.
 *
 * L'ébauche est calculée **ici**, sur le serveur, et non chez le client. Ce
 * n'est pas une préférence : le client recevrait sinon des morceaux de JSON à
 * recoller, et le premier navigateur qui coupe un caractère accentué en deux
 * afficherait des losanges. Le serveur envoie ce qu'il y a à dessiner, déjà
 * lisible.
 */

export type EvenementAgent =
  /** Ce qu'il y a à montrer maintenant. Remplace entièrement le précédent. */
  | { readonly sorte: 'ebauche'; readonly ebauche: Ebauche }
  /** La fin : ce que le tour a produit, ce qu'il a coûté, et la suite. */
  | {
      readonly sorte: 'fin'
      readonly tour: LectureTour
      readonly fcfa: number
      readonly conversation: string
      readonly plan: string
      readonly credits: number
    }
  /** Une panne, dite plutôt que tue. Le client n'a alors rien à recoller. */
  | { readonly sorte: 'panne'; readonly pourquoi: string; readonly sansCredit?: boolean }

/**
 * Ce que le tour a rendu, une fois le flux fini.
 *
 * `null` quand rien d'utilisable n'en est sorti — un JSON illisible, un tour
 * sans mot. Le crédit n'est pas rendu pour autant : les jetons, eux, ont été
 * consommés, et une conversation garde ses tours restants pour réessayer.
 */
function lireLaFin(texte: string, demande: string): LectureTour | null {
  const lu = lireTour(lireJsonSouple(texte))
  if (lu === null || lu.sorte !== 'outil' || lu.outil.sorte !== 'page') return lu
  return { ...lu, outil: { ...lu.outil, page: sansNumeroInvente(lu.outil.page, demande) } }
}

/** Le même déshabillage que le chemin non diffusé : le modèle enveloppe parfois. */
function lireJsonSouple(texte: string): unknown {
  const brut = texte.trim()
  const candidats = [brut]
  const bloc = /```(?:json)?\s*([\s\S]*?)```/i.exec(brut)
  if (bloc?.[1] !== undefined) candidats.push(bloc[1].trim())
  const debut = brut.indexOf('{')
  const fin = brut.lastIndexOf('}')
  if (debut !== -1 && fin > debut) candidats.push(brut.slice(debut, fin + 1))

  for (const c of candidats) {
    try {
      return JSON.parse(c)
    } catch {
      // Le suivant.
    }
  }
  return undefined
}

/**
 * Retire un numéro que la demande ne contenait pas.
 *
 * La même règle que sur le chemin non diffusé, et pour la même raison mesurée
 * en production : le modèle remplit le champ « téléphone » même quand la
 * demande n'en donne aucun, et un numéro inventé appartient à quelqu'un.
 *
 * Ici la demande est la conversation entière, pas seulement le dernier
 * message : quelqu'un donne son numéro au deuxième tour et parle d'autre chose
 * au troisième, et il ne doit pas le perdre en chemin.
 */
function sansNumeroInvente<P extends { readonly telephone?: string }>(page: P, demande: string): P {
  const tel = page.telephone
  if (tel === undefined || tel === '' || numeroDansLaDemande(tel, demande)) return page
  const { telephone, ...sans } = page
  void telephone
  return sans as P
}

export interface ReglagesFlux {
  readonly tauxFcfa: number
  readonly secret: string
}

/**
 * Le tour, du premier morceau au dernier événement.
 *
 * Il ne jette pas : une panne de fournisseur devient un événement `panne`, et
 * le client a déjà de quoi l'afficher. Un flux qui se coupe en jetant laisse
 * l'écran figé sur une phrase à moitié écrite.
 */
export async function* jouerLeTour(
  accord: Accord,
  fournisseur: Fournisseur,
  seance: Seance,
  reglages: ReglagesFlux,
): AsyncGenerator<EvenementAgent> {
  const invite = batirInviteAgent(accord.famille)
  const demande = accord.conversation
    .filter((t) => t.qui === 'personne')
    .map((t) => t.texte)
    .join(' ')

  let texte = ''
  let cout: Cout = { dollars: 0, fcfa: 0, entree: 0, sortie: 0 }

  try {
    const flux = fournisseur.diffuser?.({ invite, conversation: accord.conversation })
    if (flux === undefined) {
      // Un fournisseur qui ne diffuse pas reste utilisable : on rend tout d'un
      // coup plutôt que de refuser. Mieux vaut un aperçu qui apparaît d'un
      // seul tenant qu'un modèle qu'on ne peut pas essayer.
      const reponse = await fournisseur.appeler({ invite, conversation: accord.conversation })
      texte = reponse.texte
      cout = chiffrer(reponse, fournisseur, reglages.tauxFcfa)
    } else {
      let suivant = await flux.next()
      /*
       * On ne redessine pas à chaque morceau : le modèle en envoie plusieurs
       * par mot, et recalculer une ébauche vingt fois par seconde pour la
       * même image occupe un téléphone d'entrée de gamme sans rien montrer de
       * plus. On redessine quand ce qu'on montrerait a changé.
       */
      let derniere = ''
      while (suivant.done !== true) {
        texte += suivant.value.texte
        const ebauche = ebaucher(texte)
        if (ebauche !== null) {
          const empreinte = `${ebauche.mot}|${ebauche.famille}|${ebauche.titre}|${ebauche.pieces.join('|')}`
          if (empreinte !== derniere) {
            derniere = empreinte
            yield { sorte: 'ebauche', ebauche }
          }
        }
        suivant = await flux.next()
      }
      cout = chiffrer(suivant.value, fournisseur, reglages.tauxFcfa)
    }
  } catch (cause) {
    // Le message d'un fournisseur peut contenir la clef en écho : il reste ici.
    console.error('tour_agent_echoue', cause)
    if (cause instanceof ErreurFournisseur && cause.sorte === 'credit-epuise') {
      yield { sorte: 'panne', pourquoi: 'plus de crédit pour composer', sansCredit: true }
      return
    }
    yield { sorte: 'panne', pourquoi: 'le modèle n’a pas répondu' }
    return
  }

  const tour = lireLaFin(texte, demande)

  if (tour === null) {
    /*
     * Ce que le modèle a réellement dit part dans le journal du serveur.
     *
     * Sans ça, un échec de lecture ne se diagnostique pas : on sait qu'il a eu
     * lieu, on ne sait pas contre quoi. C'est exactement ce qui est arrivé au
     * premier vrai deuxième tour — il fallait deviner. Côté serveur seulement,
     * et tronqué : la clef n'est jamais dans l'invite, donc jamais dans
     * l'écho, mais ce qui revient est du texte de modèle.
     */
    console.error(JSON.stringify({ evenement: 'tour_illisible', debut: texte.slice(0, 300) }))
  }

  /*
   * Le journal, et il n'a pas de chemin de contournement.
   *
   * Le § 8 plafonne le coût moyen d'une génération, et le § 7 en fait un
   * critère d'arrêt. Un tour qui n'aboutit pas a coûté des jetons quand même ;
   * l'omettre ferait sous-estimer la dépense de tout le monde.
   */
  await seance.journaliser({
    etage: accord.etage,
    jetonsEntree: cout.entree,
    jetonsSortie: cout.sortie,
    coutXaf: cout.fcfa,
    ok: tour !== null,
  })
  console.log(
    JSON.stringify({
      evenement: 'tour_agent',
      modele: fournisseur.nom,
      tours: accord.laissez.tours,
      paye: accord.paye,
      fcfa: cout.fcfa,
      issue: tour === null ? 'illisible' : tour.sorte,
    }),
  )

  if (tour === null) {
    yield { sorte: 'panne', pourquoi: 'je n’ai pas su répondre — redis-le autrement ?' }
    return
  }

  yield {
    sorte: 'fin',
    tour,
    fcfa: cout.fcfa,
    conversation: await laissezPourLeClient(accord, reglages.secret),
    plan: seance.compte.plan,
    credits: seance.compte.credits - (accord.paye ? 1 : 0),
  }
}

function chiffrer(
  reponse: { jetonsEntree: number; jetonsSortie: number; dollars?: number },
  fournisseur: Fournisseur,
  tauxFcfa: number,
): Cout {
  const jetons = { entree: reponse.jetonsEntree, sortie: reponse.jetonsSortie }
  if (reponse.dollars === undefined) return couter(jetons, fournisseur.prix, tauxFcfa)
  return {
    dollars: reponse.dollars,
    fcfa: Math.round(reponse.dollars * tauxFcfa * 100) / 100,
    entree: jetons.entree,
    sortie: jetons.sortie,
  }
}
