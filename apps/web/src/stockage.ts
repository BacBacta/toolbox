import type { CalculDemande, RegistreDemande } from '@a237/engine'
import { createStore, del, entries, get, set } from 'idb-keyval'

/**
 * L'état vit sur le téléphone, dans IndexedDB.
 *
 * `localStorage` plafonne vers 5 Mo, il est synchrone — donc il bloque le fil
 * d'exécution pendant qu'on écrit — et il ne sait stocker que du texte, alors
 * qu'on y mettra des PNG de carte. IndexedDB coche les trois cases, et
 * `idb-keyval` en fait une clef-valeur pour un kilo-octet.
 *
 * Deux bases séparées, et non deux magasins d'une même base : `createStore`
 * d'idb-keyval crée son magasin à la version 1 de la base, donc deux appels sur
 * la même base ne peuvent pas coexister.
 */

const OUTILS = createStore('atelier237-outils', 'outils')
const FILE = createStore('atelier237-file', 'file')

/** Un outil tel qu'il est rangé sur le téléphone. */
export interface OutilEnregistre {
  readonly id: string
  /** L'identifiant du squelette : `devis`, `facture`, `njangi`… */
  readonly skeleton: string
  readonly nom: string
  /** L'état, conforme au schéma du squelette. Validé avant d'être rendu. */
  readonly etat: unknown
  /**
   * La configuration d'un registre composé par le modèle, quand il n'y a pas de
   * squelette derrière.
   *
   * C'est ce qui rend l'étage 2 durable : le registre composé n'est pas une
   * vue jetable, il vit sur le téléphone comme les autres, s'ouvre hors ligne,
   * et se partage pareil. `skeleton` vaut alors `'compose'` — aucun squelette
   * ne porte ce nom, et le fragment de liste sait le reconnaître.
   *
   * Absent pour les outils bâtis sur un squelette, qui sont la règle.
   */
  readonly registre?: RegistreDemande
  /** L'autre forme composable : quelques champs, une formule, un résultat. */
  readonly calcul?: CalculDemande
  /**
   * Version monotone. Le serveur refusera une publication dont la version est
   * inférieure ou égale à celle qu'il détient : un vieux téléphone n'écrase pas
   * une publication plus récente (BRIEF.md § 3.5).
   */
  readonly version: number
  /**
   * L'adresse publique, une fois qu'elle existe vraiment.
   *
   * Elle est tirée au premier dépôt accepté et ne change plus : un outil
   * republié garde son lien, sans quoi chaque correction d'une facture
   * enverrait le client sur une adresse morte.
   */
  readonly lien?: string
  /**
   * La version que le serveur détient. Elle dit si republier a un objet :
   * `version === versionPubliee` veut dire que rien n'a bougé depuis.
   */
  readonly versionPubliee?: number
  readonly creeLe: number
  readonly majLe: number
}

/** Une publication qui attend le réseau. */
export interface PublicationEnAttente {
  readonly id: string
  readonly outilId: string
  readonly version: number
  readonly creeLe: number
}

export function nouvelIdentifiant(): string {
  return crypto.randomUUID()
}

/** Les outils, le plus récemment touché en premier. */
export async function listerOutils(): Promise<OutilEnregistre[]> {
  const tout = await entries<string, OutilEnregistre>(OUTILS)
  return tout.map(([, o]) => o).sort((a, b) => b.majLe - a.majLe)
}

export async function lireOutil(id: string): Promise<OutilEnregistre | null> {
  return (await get<OutilEnregistre>(id, OUTILS)) ?? null
}

export async function enregistrerOutil(outil: OutilEnregistre): Promise<void> {
  await set(outil.id, outil, OUTILS)
}

export async function supprimerOutil(id: string): Promise<void> {
  await del(id, OUTILS)
}

/**
 * Range un nouvel état et fait avancer la version.
 *
 * La version monte à chaque enregistrement, pas seulement à chaque publication :
 * c'est ce qui permet au serveur de reconnaître un état plus ancien même quand
 * l'appareil est resté longtemps hors ligne.
 */
export async function majEtat(
  outil: OutilEnregistre,
  etat: unknown,
  maintenant: Date,
): Promise<OutilEnregistre> {
  const suivant: OutilEnregistre = {
    ...outil,
    etat,
    version: outil.version + 1,
    majLe: maintenant.getTime(),
  }
  await enregistrerOutil(suivant)
  return suivant
}

/**
 * Note qu'un dépôt a été accepté.
 *
 * Le lien et la version publiée sont écrits **après** la réponse du serveur, et
 * jamais avant : un lien inscrit d'avance serait une adresse morte, envoyée
 * sous le nom de celui qui la partage.
 */
export async function noterPublication(
  outil: OutilEnregistre,
  lien: string,
  version: number,
): Promise<OutilEnregistre> {
  const suivant: OutilEnregistre = { ...outil, lien, versionPubliee: version }
  await enregistrerOutil(suivant)
  return suivant
}

/**
 * Range un outil neuf.
 *
 * L'état initial est fourni par le fragment de l'outil, pas construit ici : le
 * stockage ne connaît aucun squelette, et la coquille ne tire donc pas les
 * dix-sept schémas dans son fragment de départ pour créer un devis.
 */
export async function creerOutil(
  skeletonId: string,
  nom: string,
  etat: unknown,
  maintenant: Date,
  compose?: { readonly registre?: RegistreDemande; readonly calcul?: CalculDemande },
): Promise<OutilEnregistre> {
  const outil: OutilEnregistre = {
    id: nouvelIdentifiant(),
    skeleton: skeletonId,
    nom,
    etat,
    ...(compose?.registre !== undefined ? { registre: compose.registre } : {}),
    ...(compose?.calcul !== undefined ? { calcul: compose.calcul } : {}),
    version: 0,
    creeLe: maintenant.getTime(),
    majLe: maintenant.getTime(),
  }
  await enregistrerOutil(outil)
  return outil
}

/**
 * Met une publication en file d'attente.
 *
 * Le réseau ne sert qu'à publier, payer et appeler le modèle — trois choses qui
 * peuvent attendre (invariant § 2.7). Ce qui n'est pas parti est rejoué au
 * prochain lancement.
 */
export async function filerPublication(entree: PublicationEnAttente): Promise<void> {
  await set(entree.id, entree, FILE)
}

export async function lireFile(): Promise<PublicationEnAttente[]> {
  const tout = await entries<string, PublicationEnAttente>(FILE)
  return tout.map(([, e]) => e).sort((a, b) => a.creeLe - b.creeLe)
}

export async function retirerDeLaFile(id: string): Promise<void> {
  await del(id, FILE)
}
