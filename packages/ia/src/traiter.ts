import type {
  CalculDemande, ErreurValidation, FormulaireDemande, PageDemande, RegistreDemande,
} from '@a237/engine'
import { lireReponseModele } from '@a237/engine'
import { couter } from './cout.js'
import type { Cout } from './cout.js'
import type { Fournisseur } from './fournisseur.js'
import { batirInvite, batirReproches } from './invite.js'

/**
 * Une génération, du texte de l'utilisateur à la configuration validée.
 *
 * C'est la mise en œuvre du § 3 : bâtir l'invite, appeler, valider, **un seul
 * essai de reprise**, puis abandonner avec un message clair. Le plafond d'un
 * essai n'est pas de la timidité — c'est ce qui empêche une boucle de brûler
 * le budget d'un compte sur une demande que le modèle ne sait pas satisfaire.
 *
 * Rien de ce qui sort d'ici n'est du HTML (§ 3, point 5) : uniquement une
 * configuration déjà passée par `verifierRegistre`.
 */

export type Resultat =
  | {
      readonly sorte: 'reussi'
      readonly registre: RegistreDemande
      readonly cout: Cout
      readonly essais: number
    }
  /**
   * Le modèle a dit non, et c'est une bonne réponse.
   *
   * Sans cette branche il n'avait pas d'issue : on lui donnait un schéma de
   * registre, il rendait un registre. « Je veux un site internet » produisait
   * un registre « Ventes » inventé de bout en bout — et facturé.
   */
  /** Une calculatrice : quelques entrées, une formule déclarée, un résultat. */
  | {
      readonly sorte: 'calcule'
      readonly calcul: CalculDemande
      readonly cout: Cout
      readonly essais: number
    }
  /**
   * Une page à envoyer sur WhatsApp — ce que « je veux un site internet »
   * demande vraiment neuf fois sur dix. C'était jusqu'ici la demande la plus
   * refusée de toutes, et le refus était juste tant qu'il n'y avait rien
   * derrière : il ne l'est plus.
   */
  | {
      readonly sorte: 'page'
      readonly page: PageDemande
      readonly cout: Cout
      readonly essais: number
    }
  /**
   * Un formulaire : la seule des quatre formes qui **reçoit**. Ce qui se fait
   * aujourd'hui par vingt messages WhatsApp qu'il faut recopier à la main
   * dans un cahier.
   */
  | {
      readonly sorte: 'formulaire'
      readonly formulaire: FormulaireDemande
      readonly cout: Cout
      readonly essais: number
    }
  | {
      readonly sorte: 'hors-sujet'
      readonly pourquoi: string
      readonly cout: Cout
      readonly essais: number
    }
  | {
      readonly sorte: 'invalide'
      readonly erreurs: readonly ErreurValidation[]
      readonly cout: Cout
      readonly essais: number
    }

export async function traiter(
  demande: string,
  fournisseur: Fournisseur,
  tauxFcfaParDollar: number,
): Promise<Resultat> {
  const jetons = { entree: 0, sortie: 0 }
  /*
   * Le coût annoncé par le fournisseur, quand il l'annonce. Un routeur
   * applique sa marge : son chiffre est le vrai, notre table de prix ne fait
   * qu'estimer. `null` tant qu'aucun tour ne l'a donné.
   */
  let dollarsAnnonces: number | null = null
  let sortie = ''
  let erreurs: readonly ErreurValidation[] = []

  // Deux tours au plus : le premier, puis la reprise. Jamais trois.
  for (let essai = 1; essai <= 2; essai++) {
    const reponse = await fournisseur.appeler(
      essai === 1
        ? { invite: batirInvite(demande) }
        : { invite: batirInvite(demande), reprise: { sortie, reproches: batirReproches(erreurs) } },
    )
    jetons.entree += reponse.jetonsEntree
    jetons.sortie += reponse.jetonsSortie
    if (reponse.dollars !== undefined) dollarsAnnonces = (dollarsAnnonces ?? 0) + reponse.dollars
    sortie = reponse.texte

    const valeur = lireJson(reponse.texte)
    if (valeur === undefined) {
      /*
       * Ce que le modèle a réellement dit part dans le journal du serveur.
       *
       * Sans ça, un échec de lecture ne se diagnostique pas : on sait qu'il a
       * eu lieu, on ne sait pas contre quoi. C'est exactement ce qui est
       * arrivé sur les dix générations de production — deux échecs, aucun
       * moyen de savoir quelle forme les avait causés sans les reproduire.
       *
       * Côté serveur seulement, et tronqué. La clef n'est jamais dans l'invite,
       * donc jamais dans l'écho ; ce qui revient est du texte de modèle.
       */
      console.error(
        JSON.stringify({
          evenement: 'json_illisible',
          essai,
          debut: reponse.texte.slice(0, 300),
        }),
      )
      erreurs = [{ chemin: '$', message: 'la réponse n’est pas du JSON' }]
      continue
    }

    const lu = lireReponseModele(valeur)
    if (lu.sorte === 'registre') {
      return { sorte: 'reussi', registre: lu.registre, cout: cout(), essais: essai }
    }
    if (lu.sorte === 'calcul') {
      return { sorte: 'calcule', calcul: lu.calcul, cout: cout(), essais: essai }
    }
    if (lu.sorte === 'page') {
      return { sorte: 'page', page: lu.page, cout: cout(), essais: essai }
    }
    if (lu.sorte === 'formulaire') {
      return { sorte: 'formulaire', formulaire: lu.formulaire, cout: cout(), essais: essai }
    }
    if (lu.sorte === 'refus') {
      // On ne reprend pas un refus : ce serait payer un tour pour lui faire
      // inventer ce qu'il vient justement de refuser d'inventer.
      return { sorte: 'hors-sujet', pourquoi: lu.pourquoi, cout: cout(), essais: essai }
    }
    erreurs = lu.erreurs
  }

  return {
    sorte: 'invalide',
    erreurs,
    cout: cout(),
    essais: 2,
  }

  function cout(): Cout {
    return dollarsAnnonces === null
      ? couter(jetons, fournisseur.prix, tauxFcfaParDollar)
      : {
          dollars: dollarsAnnonces,
          fcfa: Math.round(dollarsAnnonces * tauxFcfaParDollar * 100) / 100,
          entree: jetons.entree,
          sortie: jetons.sortie,
        }
  }
}

/**
 * Le JSON du modèle, ou rien.
 *
 * `responseMimeType` le demande déjà, et le modèle déborde quand même : mesuré
 * en production sur dix générations réelles, une demande sur dix a échoué sur
 * « la réponse n'est pas du JSON », deux fois de suite, pour soixante centimes.
 * Un bloc de code entouré d'une phrase de politesse suffit à faire tomber une
 * configuration parfaitement valable.
 *
 * C'est une faute de forme et non de fond : on déshabille plutôt que de faire
 * payer un tour de plus. Trois tentatives, de la plus stricte à la plus large,
 * et la dernière ne cherche que ce qui ne peut pas être de la prose — le
 * premier `{` jusqu'au dernier `}`. Ce qu'on ne trouve pas ainsi n'était pas
 * une configuration enveloppée : c'était autre chose, et ça reste un échec.
 */
function lireJson(texte: string): unknown {
  const brut = texte.trim()

  for (const candidat of candidatsJson(brut)) {
    try {
      return JSON.parse(candidat)
    } catch {
      // Le suivant.
    }
  }
  return undefined
}

function* candidatsJson(brut: string): Generator<string> {
  yield brut

  // Un bloc de code, où qu'il soit dans la réponse.
  const bloc = /```(?:json)?\s*([\s\S]*?)```/i.exec(brut)
  if (bloc?.[1] !== undefined) yield bloc[1].trim()

  // Le premier objet accolé, du premier `{` au dernier `}`.
  const debut = brut.indexOf('{')
  const fin = brut.lastIndexOf('}')
  if (debut !== -1 && fin > debut) yield brut.slice(debut, fin + 1)
}
