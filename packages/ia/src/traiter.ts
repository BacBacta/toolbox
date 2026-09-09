import type { CalculDemande, ErreurValidation, RegistreDemande } from '@a237/engine'
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
        }
  }
}

/**
 * Le JSON du modèle, ou rien.
 *
 * `responseMimeType` le demande déjà, mais un fournisseur de secours pourrait
 * envelopper la réponse dans un bloc de code. On le déshabille plutôt que de
 * refuser — c'est une faute de forme, pas de fond.
 */
function lireJson(texte: string): unknown {
  const propre = texte.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    return JSON.parse(propre)
  } catch {
    return undefined
  }
}
