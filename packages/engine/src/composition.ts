import type { CalculDemande } from './calcul.js'
import { verifierCalcul } from './calcul.js'
import type { PageDemande } from './page.js'
import { verifierPage } from './page.js'
import type { RefusModele, RegistreDemande } from './registre.js'
import { MAX_REFUS, schemaRefus, verifierRegistre } from './registre.js'
import type { ErreurValidation } from './types.js'
import { valider } from './valider.js'

/**
 * Lit ce que le modèle a répondu : un registre, une calculatrice, un refus, ou
 * rien de valable.
 *
 * L'aiguillage se fait sur la forme et non sur un champ « type » que le modèle
 * devrait penser à remplir : `colonnes` fait un registre, `entrees` une
 * calculatrice, `sections` une page, `impossible` un refus. Un champ de
 * discrimination de plus, c'est une occasion de plus de se tromper, et une
 * reprise coûte un tour.
 *
 * Le refus se reconnaît en premier. Un modèle qui dit « je ne peux pas » a
 * bien travaillé ; le reprendre pour non-conformité brûlerait un tour à lui
 * faire inventer ce qu'il vient justement de refuser d'inventer.
 */

export type ReponseModele =
  | { readonly sorte: 'registre'; readonly registre: RegistreDemande }
  | { readonly sorte: 'calcul'; readonly calcul: CalculDemande }
  | { readonly sorte: 'page'; readonly page: PageDemande }
  | { readonly sorte: 'refus'; readonly pourquoi: string }
  | { readonly sorte: 'invalide'; readonly erreurs: readonly ErreurValidation[] }

/**
 * Coupe à la longueur voulue, et à un mot.
 *
 * Trancher au caractère près laisserait « je ne peux pas créer ce regis… » :
 * la coupure se voit, et elle donne l'air d'une panne plutôt que d'une phrase
 * abrégée. On recule jusqu'à la dernière espace, et les points de suspension
 * disent qu'il y avait une suite.
 */
function raccourcir(texte: string, max: number): string {
  if (texte.length <= max) return texte
  const brut = texte.slice(0, max - 1)
  const espace = brut.lastIndexOf(' ')
  return `${(espace > max / 2 ? brut.slice(0, espace) : brut).trimEnd()}…`
}

/**
 * A-t-on reçu le schéma au lieu d'un objet qui le respecte ?
 *
 * Mesuré en production : une demande sur dix recevait notre propre schéma,
 * renvoyé tel quel. Il est long, il se fait couper en route, et le reproche qui
 * suivait — « la réponse n'est pas du JSON » — ne disait rien de ce qui s'était
 * passé. La reprise repartait donc au hasard, et coûtait un tour pour rien.
 *
 * `properties` avec `type` à la racine ne se rencontre que là : un registre a
 * `titre` et `colonnes`, une calculatrice `entrees`, un refus `impossible`.
 * Une colonne peut très bien s'appeler « type » — un registre de motos en a
 * un — mais elle vit dans `colonnes`, pas à la racine.
 */
function estUnSchema(valeur: object): boolean {
  return 'properties' in valeur && ('type' in valeur || '$schema' in valeur)
}

export function lireReponseModele(valeur: unknown): ReponseModele {
  if (typeof valeur !== 'object' || valeur === null) {
    return { sorte: 'invalide', erreurs: [{ chemin: '$', message: 'la réponse n’est pas un objet' }] }
  }

  if (estUnSchema(valeur)) {
    return {
      sorte: 'invalide',
      erreurs: [
        {
          chemin: '$',
          message:
            'tu as renvoyé le schéma. Renvoie un objet qui le respecte : ses champs remplis ' +
            'pour la demande, pas sa description.',
        },
      ],
    }
  }

  if ('impossible' in valeur) {
    /*
     * On coupe avant de valider, et non l'inverse.
     *
     * Mesuré en production sur dix générations : un refus de cent
     * quatre-vingt-onze caractères a été jugé invalide, le modèle repris —
     * donc payé deux fois — puis abandonné. La personne a dépensé un crédit
     * pour lire « le modèle n'a pas produit un registre utilisable » à la
     * place d'une phrase qui répondait à sa question.
     *
     * Le plafond est là pour que le modèle ne s'étale pas, pas pour jeter une
     * réponse juste. Le plancher, lui, reste : un refus vide n'est pas un
     * refus.
     */
    const brut = (valeur as { impossible: unknown }).impossible
    const coupe = typeof brut === 'string' ? raccourcir(brut, MAX_REFUS) : brut
    const erreurs = valider(schemaRefus, { ...valeur, impossible: coupe })
    return erreurs.length > 0
      ? { sorte: 'invalide', erreurs }
      : { sorte: 'refus', pourquoi: coupe as RefusModele['impossible'] }
  }

  if ('sections' in valeur) {
    const erreurs = verifierPage(valeur)
    return erreurs.length > 0
      ? { sorte: 'invalide', erreurs }
      : { sorte: 'page', page: valeur as PageDemande }
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
