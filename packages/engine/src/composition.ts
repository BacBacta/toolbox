import type { CalculDemande } from './calcul.js'
import { verifierCalcul } from './calcul.js'
import type { RefusModele, RegistreDemande } from './registre.js'
import { schemaRefus, verifierRegistre } from './registre.js'
import type { ErreurValidation } from './types.js'
import { valider } from './valider.js'

/**
 * Lit ce que le modèle a répondu : un registre, une calculatrice, un refus, ou
 * rien de valable.
 *
 * L'aiguillage se fait sur la forme et non sur un champ « type » que le modèle
 * devrait penser à remplir : `colonnes` fait un registre, `entrees` une
 * calculatrice, `impossible` un refus. Un champ de discrimination de plus,
 * c'est une occasion de plus de se tromper, et une reprise coûte un tour.
 *
 * Le refus se reconnaît en premier. Un modèle qui dit « je ne peux pas » a
 * bien travaillé ; le reprendre pour non-conformité brûlerait un tour à lui
 * faire inventer ce qu'il vient justement de refuser d'inventer.
 */

export type ReponseModele =
  | { readonly sorte: 'registre'; readonly registre: RegistreDemande }
  | { readonly sorte: 'calcul'; readonly calcul: CalculDemande }
  | { readonly sorte: 'refus'; readonly pourquoi: string }
  | { readonly sorte: 'invalide'; readonly erreurs: readonly ErreurValidation[] }

export function lireReponseModele(valeur: unknown): ReponseModele {
  if (typeof valeur !== 'object' || valeur === null) {
    return { sorte: 'invalide', erreurs: [{ chemin: '$', message: 'la réponse n’est pas un objet' }] }
  }

  if ('impossible' in valeur) {
    const erreurs = valider(schemaRefus, valeur)
    return erreurs.length > 0
      ? { sorte: 'invalide', erreurs }
      : { sorte: 'refus', pourquoi: (valeur as RefusModele).impossible }
  }

  if ('entrees' in valeur) {
    const erreurs = verifierCalcul(valeur)
    return erreurs.length > 0
      ? { sorte: 'invalide', erreurs }
      : { sorte: 'calcul', calcul: valeur as CalculDemande }
  }

  const erreurs = verifierRegistre(valeur)
  return erreurs.length > 0
    ? { sorte: 'invalide', erreurs }
    : { sorte: 'registre', registre: valeur as RegistreDemande }
}
