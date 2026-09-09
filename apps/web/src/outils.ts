import type { CalculDemande, Extrait, RegistreDemande, RenderContext, ShareSpec } from '@a237/engine'
import type { JSX } from 'preact'
import type { OutilEnregistre } from './stockage.js'

/**
 * Ce que le modèle a composé, quand il a composé quelque chose.
 *
 * Deux formes, jamais les deux à la fois : un registre tient une liste, une
 * calculatrice répond à une question. La coquille les transporte sans les
 * comprendre — c'est le fragment de l'outil qui sait les dessiner.
 */
export interface Compose {
  readonly registre?: RegistreDemande
  readonly calcul?: CalculDemande
}

export interface ProprietesOutil {
  readonly outil: OutilEnregistre
  /**
   * Le signe du catalogue, transmis par la coquille.
   *
   * Il ne se lit pas depuis le fragment : le catalogue est déjà en mémoire dans
   * la coquille, et l'importer ici le dupliquerait dans chacun des cinq
   * fragments pour un caractère.
   */
  readonly glyphe: string
  readonly ctx: RenderContext
  readonly onChange: (etat: unknown) => void
  readonly onDiffuser: (partage: ShareSpec) => void
}

export interface EtatNeuf {
  readonly nom: string
  readonly etat: unknown
}

export interface ModuleOutil {
  readonly Outil: (p: ProprietesOutil) => JSX.Element
  /**
   * L'état d'un outil neuf. Il vit avec le fragment de l'outil et non dans la
   * coquille : le squelette complet — schéma, calculs, valeurs par défaut — ne
   * se charge qu'au moment où on en a vraiment besoin.
   *
   * L'identifiant est passé parce qu'un même fragment sert plusieurs
   * squelettes : les quatre registres de liste partagent un écran, les deux
   * calculatrices aussi.
   *
   * `extrait` porte ce que la demande disait déjà — « njangi de 20 000 F par
   * mois ». Le squelette en prend ce qu'il sait interpréter sans risque, et
   * ignore le reste.
   */
  readonly creer: (
    skeleton: string,
    maintenant: Date,
    extrait: Extrait,
    compose?: Compose,
  ) => EtatNeuf
}

/**
 * Un import dynamique par squelette.
 *
 * C'est ce qui tient le budget de 120 Ko : la coquille ne paie pas les outils
 * qu'on n'ouvre pas. Rollup en tire un fragment par entrée, et le service
 * worker les met tous en cache à l'installation — donc le mode avion marche
 * quand même, dès la première visite.
 */
export const CHARGEURS: Readonly<Record<string, () => Promise<ModuleOutil>>> = {
  // Un registre composé par le modèle : même écran, même moteur, sa
  // configuration voyage simplement avec l'outil au lieu d'un squelette.
  compose: () => import('./outils/liste.js'),
  'compose-calcul': () => import('./outils/calc.js'),
  devis: () => import('./outils/devis.js'),
  facture: () => import('./outils/facture.js'),
  njangi: () => import('./outils/njangi.js'),
  // Un seul fragment pour les quatre registres décrits par leurs colonnes, et
  // un pour les deux calculatrices : ils partagent leur écran et leur moteur.
  prix: () => import('./outils/liste.js'),
  caisse: () => import('./outils/liste.js'),
  stock: () => import('./outils/liste.js'),
  clients: () => import('./outils/liste.js'),
  scolarite: () => import('./outils/calc.js'),
  course: () => import('./outils/calc.js'),
}

export function outilDisponible(skeleton: string): boolean {
  return Object.hasOwn(CHARGEURS, skeleton)
}
