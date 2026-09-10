/**
 * Ce qu'est un projet à l'Établi.
 *
 * Trois fichiers au plus dans le cas courant — une page, une feuille, un
 * script — et rien de plus compliqué tant qu'on n'en a pas besoin. Un projet
 * tient dans le stockage du téléphone, se rouvre hors ligne, et s'exporte en un
 * seul fichier qu'on envoie sur WhatsApp.
 *
 * Il n'y a pas de dossiers. Ce n'est pas une limite technique : sur un écran de
 * 360 pixels, une arborescence coûte la moitié de la hauteur utile pour ranger
 * ce que personne n'a demandé à ranger.
 */

export interface Fichier {
  /** Avec son extension : c'est elle qui dit comment le fichier s'exécute. */
  readonly nom: string
  readonly contenu: string
}

export interface Projet {
  readonly id: string
  readonly nom: string
  readonly fichiers: readonly Fichier[]
  /** Quand il a changé pour la dernière fois. Sert à ranger la liste. */
  readonly maj: number
}

/** Huit fichiers : au-delà, les onglets ne tiennent plus sur la largeur. */
export const MAX_FICHIERS = 8

/**
 * Cent kilo-octets par projet.
 *
 * Ce n'est pas une limite de stockage — le téléphone en a plus. C'est la
 * limite de ce qu'on peut envoyer sur WhatsApp sans y penser, et de ce qu'un
 * navigateur d'entrée de gamme relit sans ramer.
 */
export const MAX_OCTETS_PROJET = 100 * 1024

export function poidsDuProjet(projet: Projet): number {
  return projet.fichiers.reduce((total, f) => total + f.nom.length + f.contenu.length, 0)
}
