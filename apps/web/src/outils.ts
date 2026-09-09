import type { RenderContext, ShareSpec } from '@a237/engine'
import type { JSX } from 'preact'
import type { OutilEnregistre } from './stockage.js'

export interface ProprietesOutil {
  readonly outil: OutilEnregistre
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
   */
  readonly creer: (maintenant: Date) => EtatNeuf
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
  devis: () => import('./outils/devis.js'),
  facture: () => import('./outils/facture.js'),
  njangi: () => import('./outils/njangi.js'),
}

export function outilDisponible(skeleton: string): boolean {
  return Object.hasOwn(CHARGEURS, skeleton)
}
