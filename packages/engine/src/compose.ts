import { evaluer } from './expression.js'
import { ID_COMPOSE_CALCUL } from './calcul.js'
import type { CalculDemande } from './calcul.js'
import { ID_COMPOSE } from './registre.js'
import type { RegistreDemande } from './registre.js'
import { squeletteCalc } from './skeletons/calc.js'
import type { SqueletteCalc } from './skeletons/calc.js'
import { squeletteListe } from './skeletons/liste.js'
import type { SqueletteListe } from './skeletons/liste.js'

/**
 * Un outil composé par le modèle n'a pas de squelette : sa configuration
 * voyage avec lui, dans l'outil enregistré. Ces deux fabriques la remontent en
 * squelette complet — schéma, calculs, carte et partage.
 *
 * C'est la thèse du brief prise au mot (§ 2.1, § 4) : le modèle n'a produit que
 * de la configuration, et c'est du code écrit à la main et éprouvé qui la
 * dessine. Rien ne distingue un outil composé d'un squelette, sinon d'où vient
 * sa description.
 *
 * Elles vivent ici, dans le moteur, et non dans le fragment qui les dessine,
 * parce que **le serveur en a besoin aussi**. Tant qu'elles n'étaient que du
 * côté de l'écran, la page de lecture ne trouvait rien à dessiner derrière le
 * lien d'un outil composé : elle répondait 200 avec « Ce lien ne mène à rien ».
 * L'outil payé était le seul qu'on ne pouvait pas partager. Deux définitions
 * auraient fini par ne plus dire la même chose ; il n'y en a qu'une.
 */

export function squeletteDeRegistre(registre: RegistreDemande): SqueletteListe {
  return squeletteListe({
    id: ID_COMPOSE,
    title: registre.titre,
    group: 'registres',
    keywords: [],
    titreNom: registre.titreNom,
    config: {
      kicker: registre.kicker,
      colonnes: registre.colonnes,
      libelleVide: registre.libelleVide,
      libelleAjout: registre.libelleAjout,
      relancesVides: registre.relancesVides,
      ...(registre.total !== undefined ? { total: registre.total } : {}),
      ...(registre.personnes !== undefined ? { personnes: registre.personnes } : {}),
    },
  })
}

/**
 * La formule est un arbre déclaré, pas du code : `evaluer` l'interprète, et
 * c'est ce qui permet au modèle de décrire un calcul sans jamais obtenir le
 * droit d'en exécuter un (invariant § 2.1).
 */
export function squeletteDeCalcul(demande: CalculDemande): SqueletteCalc {
  return squeletteCalc({
    id: ID_COMPOSE_CALCUL,
    title: demande.titre,
    group: 'calculs',
    keywords: [],
    titreNom: demande.titreNom,
    relancesVides: 'Une calculatrice se consulte, elle ne se relance pas.',
    config: {
      kicker: demande.kicker,
      entrees: demande.entrees,
      sortie: {
        libelle: demande.sortie.libelle,
        unite: demande.sortie.unite,
        calcul: (val) => evaluer(demande.sortie.formule, val),
      },
    },
  })
}
