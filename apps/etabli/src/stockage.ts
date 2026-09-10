import type { Projet } from '@a237/etabli'
import { createStore, del, entries, set } from 'idb-keyval'

/**
 * Les projets vivent sur le téléphone, et nulle part ailleurs.
 *
 * C'est le point de départ, pas une commodité : quelqu'un qui apprend à coder
 * dans un quartier de Douala travaille pendant les coupures, dans un taxi, la
 * veille d'un devoir. Un éditeur qui a besoin du réseau pour ouvrir ce qu'on a
 * écrit hier n'est pas utilisable ici.
 *
 * IndexedDB plutôt que `localStorage` : celui-ci plafonne vers cinq
 * mégaoctets, il est synchrone — donc il fige l'écran pendant qu'on écrit — et
 * un projet qui grossit finirait par le remplir sans prévenir.
 */

const PROJETS = createStore('etabli-projets', 'projets')

/**
 * Ce qui sort du stockage a été écrit par une version d'avant, ou par personne.
 *
 * Un projet mal formé fait tomber la liste entière si on le croit sur parole —
 * et la liste, c'est tout ce que la personne possède. On vérifie donc chaque
 * entrée, et on laisse tomber celles qui ne tiennent pas debout plutôt que
 * l'écran.
 */
function lireProjet(valeur: unknown): Projet | null {
  if (typeof valeur !== 'object' || valeur === null) return null
  const p = valeur as { id?: unknown; nom?: unknown; fichiers?: unknown; maj?: unknown }
  if (typeof p.id !== 'string' || p.id === '') return null
  if (typeof p.nom !== 'string') return null
  if (!Array.isArray(p.fichiers)) return null

  const fichiers = p.fichiers.filter(
    (f): f is { nom: string; contenu: string } =>
      typeof f === 'object' && f !== null &&
      typeof (f as { nom?: unknown }).nom === 'string' &&
      typeof (f as { contenu?: unknown }).contenu === 'string',
  )
  if (fichiers.length !== p.fichiers.length) return null

  return {
    id: p.id,
    nom: p.nom,
    fichiers: fichiers.map((f) => ({ nom: f.nom, contenu: f.contenu })),
    maj: typeof p.maj === 'number' ? p.maj : 0,
  }
}

/** Les projets, du plus récemment touché au plus ancien. */
export async function lireProjets(): Promise<readonly Projet[]> {
  try {
    const tout = await entries(PROJETS)
    return tout
      .map(([, valeur]) => lireProjet(valeur))
      .filter((p): p is Projet => p !== null)
      .sort((a, b) => b.maj - a.maj)
  } catch {
    // Navigation privée, quota plein, stockage refusé : l'Établi s'ouvre quand
    // même, avec une liste vide. Il vaut mieux un éditeur sans historique qu'un
    // écran blanc.
    return []
  }
}

export async function enregistrer(projet: Projet): Promise<void> {
  try {
    await set(projet.id, projet, PROJETS)
  } catch {
    // Rien à faire de mieux ici : prévenir se fait à l'écran, pas dans le
    // stockage, et faire jeter ferait perdre la frappe en cours.
  }
}

export async function supprimer(id: string): Promise<void> {
  try {
    await del(id, PROJETS)
  } catch {
    /* voir plus haut */
  }
}
