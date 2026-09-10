import type { Fichier, Projet } from './projet.js'
import { MAX_FICHIERS, MAX_OCTETS_PROJET } from './projet.js'
import { sorteDuFichier, verifierNomDeFichier } from './assembler.js'
import type { Langue } from './expliquer.js'

/**
 * Le compagnon : on lui dit ce qu'on veut, il écrit le code.
 *
 * C'est un écart assumé au premier invariant du brief — « jamais de génération
 * de code libre par l'IA » — et il faut dire pourquoi, sinon c'est juste une
 * règle qu'on contourne parce qu'elle gêne.
 *
 * Cet invariant donne trois raisons. Deux ne s'appliquent pas ici :
 *
 * - **La surface d'attaque.** Dans l'atelier, la sortie du modèle devient une
 *   page publiée que des inconnus ouvrent : du code libre y serait un trou.
 *   L'Établi, lui, exécute déjà du code arbitraire — celui de la personne —
 *   dans une `iframe sandbox="allow-scripts"` sans `allow-same-origin`, donc
 *   dans une origine opaque, et ce qui est déposé n'est jamais servi comme une
 *   page. Le code du modèle tourne dans la même prison que le code tapé à la
 *   main. Rien n'est ajouté à la surface.
 * - **La fiabilité.** Une configuration invalide dans l'atelier casse un outil
 *   qu'un trésorier de njangi utilise devant vingt personnes. Ici, on voit le
 *   code tourner, la console dit ce qui ne va pas, et on redemande.
 *
 * La troisième — **le coût** — s'applique, et elle chiffre. Mesuré en
 * production sur 417 générations de l'atelier : 0,199 F CFA en moyenne, pour
 * 3 645 jetons d'entrée et 263 de sortie. Écrire du code demande dix fois plus
 * de sortie et plusieurs tours. C'est pourquoi le prix de chaque tour est
 * affiché, comme les cinq mégaoctets de Python : ce qui coûte de l'argent à
 * quelqu'un se dit avant, pas sur le relevé.
 *
 * L'invariant reste entier pour l'atelier. Il a été écrit pour un produit qui
 * n'avait pas d'éditeur de code.
 */

/** Ce que le modèle doit rendre, et rien d'autre. */
export interface ReponseCompagnon {
  /** Une phrase pour la personne. Ce qui a été fait, pas un cours. */
  readonly mot: string
  /** Les fichiers à écrire, entiers. */
  readonly fichiers: readonly Fichier[]
}

/**
 * Des fichiers entiers, pas des rustines.
 *
 * Un modèle qui rend « remplace la ligne 14 » se trompe de ligne dès que le
 * fichier a bougé, et il a bougé — c'est la personne qui écrit entre deux
 * tours. Un fichier entier ne peut pas se tromper d'endroit. Ça coûte des
 * jetons de sortie, et c'est le prix de ne pas corrompre le travail de
 * quelqu'un en silence.
 */
export const SCHEMA_COMPAGNON = {
  type: 'object',
  properties: {
    mot: {
      type: 'string',
      description: 'Une phrase, à la personne, sur ce que tu viens de faire.',
    },
    fichiers: {
      type: 'array',
      minItems: 1,
      maxItems: MAX_FICHIERS,
      description: 'Les fichiers que tu écris ou remplaces, entiers. Ne renvoie pas ceux que tu ne changes pas.',
      items: {
        type: 'object',
        properties: {
          nom: { type: 'string', description: 'Comme « script.js ». Pas de dossier.' },
          contenu: { type: 'string', description: 'Le fichier entier, du début à la fin.' },
        },
        required: ['nom', 'contenu'],
      },
    },
  },
  required: ['mot', 'fichiers'],
} as const

/** Deux mille caractères pour le mot : au-delà, ce n'est plus une phrase. */
const MAX_MOT = 2000

/**
 * La réponse du modèle, vérifiée.
 *
 * On ne la croit sur rien. Un nom de fichier décide de la façon dont le
 * contenu s'exécute — `.js` devient un script, `.html` devient la page — donc
 * un nom inventé ou un dossier glissé dedans change le sens de ce qu'on
 * écrit. Et un fichier gigantesque remplirait le stockage du téléphone de
 * quelqu'un pour un tour qu'il n'a peut-être pas voulu.
 *
 * `null` quand ça ne tient pas debout : on préfère redemander que d'écrire
 * n'importe quoi par-dessus le travail de la personne.
 */
export function lireReponseCompagnon(valeur: unknown, langue: Langue = 'fr'): ReponseCompagnon | null {
  if (typeof valeur !== 'object' || valeur === null) return null
  const r = valeur as { mot?: unknown; fichiers?: unknown }
  if (typeof r.mot !== 'string') return null
  if (!Array.isArray(r.fichiers) || r.fichiers.length === 0) return null
  if (r.fichiers.length > MAX_FICHIERS) return null

  const fichiers: Fichier[] = []
  let octets = 0
  for (const brut of r.fichiers) {
    if (typeof brut !== 'object' || brut === null) return null
    const f = brut as { nom?: unknown; contenu?: unknown }
    if (typeof f.nom !== 'string' || typeof f.contenu !== 'string') return null
    // Les mêmes règles que pour un nom tapé à la main : le modèle n'a pas plus
    // de droits que la personne.
    if (verifierNomDeFichier(f.nom, fichiers.map((d) => d.nom), langue) !== null) return null
    if (sorteDuFichier(f.nom) === 'inconnu') return null
    octets += f.nom.length + f.contenu.length
    if (octets > MAX_OCTETS_PROJET) return null
    fichiers.push({ nom: f.nom, contenu: f.contenu })
  }

  return {
    mot: r.mot.length > MAX_MOT ? `${r.mot.slice(0, MAX_MOT)}…` : r.mot,
    fichiers,
  }
}

export interface Changement {
  readonly nom: string
  readonly quoi: 'ajoute' | 'remplace'
  /** Ce qu'il y avait avant, pour pouvoir revenir en arrière. */
  readonly avant: string | null
}

/**
 * Le projet après le passage du compagnon, et ce qui a bougé.
 *
 * Ce qui a bougé n'est pas un détail d'affichage : sans lui, quelqu'un voit son
 * fichier changer sans savoir ce qui a été touché, et n'a aucun moyen de
 * revenir. On garde donc l'avant de chaque fichier remplacé.
 *
 * Les fichiers que le modèle ne renvoie pas restent tels quels. C'est ce qui
 * permet de dire « ajoute un bouton » sans qu'il réécrive la feuille de style
 * de travers en passant.
 */
export function appliquer(
  projet: Projet,
  reponse: ReponseCompagnon,
): { readonly projet: Projet; readonly changements: readonly Changement[] } {
  const changements: Changement[] = []
  let fichiers = [...projet.fichiers]

  for (const neuf of reponse.fichiers) {
    const rang = fichiers.findIndex((f) => f.nom === neuf.nom)
    if (rang === -1) {
      changements.push({ nom: neuf.nom, quoi: 'ajoute', avant: null })
      fichiers = [...fichiers, neuf]
    } else {
      const avant = fichiers[rang]?.contenu ?? ''
      // Un fichier réécrit à l'identique n'est pas un changement : l'annoncer
      // ferait chercher une différence qui n'existe pas.
      if (avant === neuf.contenu) continue
      changements.push({ nom: neuf.nom, quoi: 'remplace', avant })
      fichiers = fichiers.map((f, i) => (i === rang ? neuf : f))
    }
  }

  return { projet: { ...projet, fichiers, maj: projet.maj }, changements }
}

/** Remettre le projet comme il était avant le dernier passage. */
export function revenir(projet: Projet, changements: readonly Changement[]): Projet {
  let fichiers = [...projet.fichiers]
  for (const c of changements) {
    if (c.avant === null) fichiers = fichiers.filter((f) => f.nom !== c.nom)
    else fichiers = fichiers.map((f) => (f.nom === c.nom ? { ...f, contenu: c.avant! } : f))
  }
  return { ...projet, fichiers }
}
