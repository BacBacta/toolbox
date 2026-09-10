import type { CalculDemande } from './calcul.js'
import { redresserCalcul, verifierCalcul } from './calcul.js'
import type { FormulaireDemande } from './formulaire.js'
import { redresserFormulaire, verifierFormulaire } from './formulaire.js'
import type { PageDemande } from './page.js'
import { redresserPage, verifierPage } from './page.js'
import type { RefusModele, RegistreDemande } from './registre.js'
import { MAX_REFUS, redresserRegistre, schemaRefus, verifierRegistre } from './registre.js'
import type { ErreurValidation } from './types.js'
import { valider } from './valider.js'

/**
 * Lit ce que le modèle a répondu : un registre, une calculatrice, un refus, ou
 * rien de valable.
 *
 * L'aiguillage se fait sur la forme et non sur un champ « type » que le modèle
 * devrait penser à remplir : `colonnes` fait un registre, `entrees` une
 * calculatrice, `sections` une page, `champs` un formulaire, `impossible` un
 * refus. Un champ de discrimination de plus, c'est une occasion de plus de se
 * tromper, et une reprise coûte un tour.
 *
 * Le refus se reconnaît en premier. Un modèle qui dit « je ne peux pas » a
 * bien travaillé ; le reprendre pour non-conformité brûlerait un tour à lui
 * faire inventer ce qu'il vient justement de refuser d'inventer.
 */

export type ReponseModele =
  | { readonly sorte: 'registre'; readonly registre: RegistreDemande }
  | { readonly sorte: 'calcul'; readonly calcul: CalculDemande }
  | { readonly sorte: 'page'; readonly page: PageDemande }
  | { readonly sorte: 'formulaire'; readonly formulaire: FormulaireDemande }
  | { readonly sorte: 'refus'; readonly pourquoi: string }
  /**
   * Le modèle a rendu une coquille : le bon nom de famille, et rien dedans.
   *
   * Ce n'est pas un échec, c'est une question — il demande de quoi remplir, et
   * il pose son ébauche à côté. Une coquille ne porte aucune information : la
   * jeter ne perd rien, et le mot qui l'accompagne est ce dont la personne a
   * besoin pour que le tour suivant fabrique quelque chose. Distinct
   * d'« invalide », qui se dit de ce qui porte quelque chose de faux.
   */
  | { readonly sorte: 'vide' }
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

/**
 * L'étiquette de famille, jetée avant le jugement.
 *
 * Le modèle a quatre schémas devant lui et aucun endroit où dire lequel il a
 * pris ; il se le dit à lui-même, en tête de l'outil : `"type":
 * "calculatrice"`. Le contrat interdit les champs en trop, et une calculatrice
 * juste mourait pour ce mot-là — deux fois sur vingt-quatre, mesuré en
 * production. C'est le même geste que le `colonnes: []` oublié à côté d'un
 * refus : ce qui compte est ce qu'il a dit, pas ce qu'il a ajouté par-dessus.
 *
 * Aucune des quatre familles ne porte `type` ni `sorte` à sa racine — `sorte`
 * vit dans une section ou un champ, jamais au-dessus — et la frontière aiguille
 * sur la forme, pas sur ce mot. Il ne dit donc rien que la forme ne dise déjà,
 * et le jeter ne peut rien emporter avec lui.
 *
 * **Seule une chaîne s'en va.** La tolérance s'arrête là où le contenu
 * commence : un objet ou un tableau sous ce nom est autre chose, et le refus
 * doit le nommer plutôt que de l'effacer en silence.
 */
function sansLEtiquette(valeur: object): object {
  const reste = Object.fromEntries(
    Object.entries(valeur as Record<string, unknown>).filter(
      ([clef, v]) => !((clef === 'type' || clef === 'sorte') && typeof v === 'string'),
    ),
  )
  return Object.keys(reste).length === Object.keys(valeur).length ? valeur : reste
}

/**
 * Ce qui fait la matière d'un outil, famille par famille.
 *
 * Tout le reste — titres, sur-titres, accroches, libellés — habille. Un outil
 * qui n'a que son habillage n'a rien à montrer.
 */
const MATIERE = ['sections', 'colonnes', 'entrees', 'champs'] as const

/** Vrai quand l'outil ne porte aucune matière : ni section, ni colonne, ni champ. */
function coquilleVide(valeur: object): boolean {
  const o = valeur as Record<string, unknown>
  return MATIERE.every((clef) => {
    const liste = o[clef]
    return liste === undefined || (Array.isArray(liste) && liste.length === 0)
  })
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

  const outil = sansLEtiquette(valeur)

  if ('impossible' in outil) {
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
    const brut = (outil as { impossible: unknown }).impossible
    const coupe = typeof brut === 'string' ? raccourcir(brut, MAX_REFUS) : brut
    /*
     * On valide **le refus seul**, et non l'objet qui le porte.
     *
     * `schemaRefus` interdit tout champ supplémentaire, et un modèle qui dit
     * « je ne peux pas » laisse parfois traîner à côté un `colonnes: []` qu'il
     * n'a pas fini d'effacer. Juger l'objet entier rejetait alors un refus
     * parfaitement clair, et coûtait un tour à lui faire redire la même chose.
     * Ce qui compte est ce qu'il a dit, pas ce qu'il a oublié d'enlever.
     */
    const erreurs = valider(schemaRefus, { impossible: coupe })
    return erreurs.length > 0
      ? { sorte: 'invalide', erreurs }
      : { sorte: 'refus', pourquoi: coupe as RefusModele['impossible'] }
  }

  if ('champs' in outil) {
    const redresse = redresserFormulaire(outil)
    if (coquilleVide(redresse as object)) return { sorte: 'vide' }
    const erreurs = verifierFormulaire(redresse)
    return erreurs.length > 0
      ? { sorte: 'invalide', erreurs }
      : { sorte: 'formulaire', formulaire: redresse as FormulaireDemande }
  }

  if ('sections' in outil) {
    /*
     * Redressé avant d'être jugé, et c'est le redressé qu'on garde.
     *
     * Une section dont l'étiquette contredit le contenu se rattrape ; juger
     * l'original puis publier l'original laisserait passer la contradiction
     * jusqu'à l'écran. Redresser ne desserre rien : ce qui sort repasse entier
     * devant le schéma, champs interdits compris.
     */
    const redressee = redresserPage(outil)
    if (coquilleVide(redressee as object)) return { sorte: 'vide' }
    const erreurs = verifierPage(redressee)
    return erreurs.length > 0
      ? { sorte: 'invalide', erreurs }
      : { sorte: 'page', page: redressee as PageDemande }
  }

  if ('entrees' in outil) {
    const redresse = redresserCalcul(outil)
    if (coquilleVide(redresse as object)) return { sorte: 'vide' }
    const erreurs = verifierCalcul(redresse)
    return erreurs.length > 0
      ? { sorte: 'invalide', erreurs }
      : { sorte: 'calcul', calcul: redresse as CalculDemande }
  }

  const redresse = redresserRegistre(outil)
  if (coquilleVide(redresse as object)) return { sorte: 'vide' }
  const erreurs = verifierRegistre(redresse)
  return erreurs.length > 0
    ? { sorte: 'invalide', erreurs }
    : { sorte: 'registre', registre: redresse as RegistreDemande }
}
