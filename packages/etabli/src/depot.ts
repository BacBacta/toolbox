import { verifierNomDeFichier } from './assembler.js'
import type { Fichier, Projet } from './projet.js'
import { MAX_FICHIERS, MAX_OCTETS_PROJET } from './projet.js'

/**
 * Le dépôt : ce qui sauve un projet du téléphone perdu, et ce qui le partage.
 *
 * C'est le même travail, et c'était le premier écart bloquant face à Replit.
 * Les projets ne vivaient que dans l'IndexedDB de l'appareil : téléphone volé,
 * vendu, réinitialisé, ou simplement « effacer les données du site », et trois
 * mois de travail disparaissaient sans avertissement. Personne ne découvre ça
 * avant le jour où c'est arrivé.
 *
 * Et pas de compte pour autant. Créer un compte avant d'avoir écrit trois
 * lignes est exactement la marche que cet outil existe pour retirer : un lien
 * qu'on garde, une clef qui autorise à réécrire, et rien d'autre.
 */

/**
 * L'alphabet du lien : celui des liens de l'atelier, et pour la même raison.
 *
 * Ni I, ni 1, ni O, ni 0, ni U. Un lien se dicte au téléphone et se recopie sur
 * un cahier ; deux caractères qu'on confond à l'œil font perdre le travail
 * qu'ils devaient retrouver.
 */
export const ALPHABET_LIEN = '23456789ABCDEFGHJKLMNPQRSTVWXYZ'

/** Dix caractères sur trente et un : cinquante bits, et ça se dicte encore. */
export const LONGUEUR_LIEN = 10

/**
 * La clef, elle, ne se dit jamais.
 *
 * Le lien se partage — c'est son but. S'il donnait aussi le droit de réécrire,
 * le premier destinataire pourrait effacer le travail de celui qui le lui a
 * envoyé. Deux choses distinctes, et une seule des deux voyage.
 */
export const LONGUEUR_CLEF = 32

/**
 * Deux cent cinquante kilo-octets par dépôt.
 *
 * Plus large que ce qu'un projet tient sur le téléphone, pour ne jamais refuser
 * une sauvegarde qui était acceptée localement — et assez serré pour qu'un
 * dépôt public ne devienne pas un hébergement de fichiers.
 */
export const MAX_OCTETS_DEPOT = 250 * 1024

/** Le nom d'un projet, à l'écran comme dans une liste. */
const MAX_NOM = 60

const MOTIF_LIEN = new RegExp(`^[${ALPHABET_LIEN}]{${LONGUEUR_LIEN}}$`)
const MOTIF_CLEF = /^[0-9a-f]+$/

function tirer(alphabet: string, longueur: number): string {
  const octets = new Uint8Array(longueur)
  crypto.getRandomValues(octets)
  /*
   * Le modulo biaise, et ici il ne peut pas nuire : trente et un ne divise pas
   * deux cent cinquante-six, donc les premières lettres sortent un peu plus
   * souvent. Le biais coûte moins d'un bit sur cinquante. Le corriger par
   * tirage avec rejet ferait boucler la création d'un lien pour rien.
   */
  return Array.from(octets, (o) => alphabet[o % alphabet.length]).join('')
}

export function nouveauLien(): string {
  return tirer(ALPHABET_LIEN, LONGUEUR_LIEN)
}

export function lienValide(lien: unknown): boolean {
  return typeof lien === 'string' && MOTIF_LIEN.test(lien)
}

export function nouvelleClef(): string {
  const octets = new Uint8Array(LONGUEUR_CLEF / 2)
  crypto.getRandomValues(octets)
  return Array.from(octets, (o) => o.toString(16).padStart(2, '0')).join('')
}

export function clefValide(clef: unknown): boolean {
  return typeof clef === 'string' && clef.length === LONGUEUR_CLEF && MOTIF_CLEF.test(clef)
}

/** Ce qui voyage : le nom et les fichiers. */
export interface Depot {
  readonly nom: string
  readonly fichiers: readonly Fichier[]
}

/**
 * Le projet, réduit à ce qui doit partir.
 *
 * L'identifiant local et la date de modification ne regardent que le téléphone.
 * Les envoyer ne servirait qu'à en dire plus qu'il ne faut sur l'appareil de
 * quelqu'un — et un dépôt se lit publiquement.
 */
export function pourLeDepot(projet: Projet): Depot {
  return { nom: projet.nom, fichiers: projet.fichiers.map((f) => ({ ...f })) }
}

/**
 * Ce qui revient du serveur, vérifié.
 *
 * Un dépôt se lit publiquement : celui qui a le lien l'ouvre. Ce qui en revient
 * a donc pu être écrit par n'importe qui, et ne devient un projet qu'après ce
 * contrôle — sinon un dépôt trafiqué ferait tomber l'éditeur de celui qui ouvre
 * un lien reçu sur WhatsApp, et il ne saurait même pas pourquoi.
 *
 * Les noms de fichiers passent par le même contrôle que la saisie à la main :
 * c'est la seule façon que le lecteur d'un lien ne se retrouve pas avec un
 * projet que son propre éditeur refuserait.
 */
export function lireDepot(valeur: unknown): Depot | null {
  if (typeof valeur !== 'object' || valeur === null) return null
  const d = valeur as { nom?: unknown; fichiers?: unknown }
  if (typeof d.nom !== 'string') return null
  if (!Array.isArray(d.fichiers) || d.fichiers.length === 0) return null
  if (d.fichiers.length > MAX_FICHIERS) return null

  const fichiers: Fichier[] = []
  const vus: string[] = []
  for (const brut of d.fichiers) {
    if (typeof brut !== 'object' || brut === null) return null
    const f = brut as { nom?: unknown; contenu?: unknown }
    if (typeof f.nom !== 'string' || typeof f.contenu !== 'string') return null
    if (verifierNomDeFichier(f.nom, vus) !== null) return null
    vus.push(f.nom)
    fichiers.push({ nom: f.nom, contenu: f.contenu })
  }

  const poids = fichiers.reduce((t, f) => t + f.nom.length + f.contenu.length, 0)
  if (poids > MAX_OCTETS_DEPOT) return null

  /*
   * Le nom se coupe, il ne fait pas refuser.
   *
   * Un nom trop long est une maladresse, pas une attaque : refuser tout le
   * dépôt ferait perdre le travail pour un titre. Les fichiers, eux, ne se
   * rattrapent pas — s'ils ne tiennent pas le contrat, il n'y a plus de projet.
   */
  return { nom: d.nom.slice(0, MAX_NOM), fichiers }
}

/** Ce qu'un dépôt pèse, pour le refuser avant de le lire en entier. */
export { MAX_OCTETS_PROJET }
