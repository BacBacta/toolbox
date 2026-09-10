import type { Langue } from './expliquer.js'
import type { Fichier, Projet } from './projet.js'
import { sorteDuFichier } from './assembler.js'

/**
 * Python, et son prix annoncé avant.
 *
 * Python ne tient pas dans un navigateur : il faut y descendre un interpréteur
 * entier, compilé en WebAssembly. Mesuré, brotli compris, ça fait cinq
 * mégaoctets — deux cent soixante-dix fois l'Établi tout entier.
 *
 * Sur un forfait compté à l'octet, ce n'est pas un détail technique : c'est de
 * l'argent. Un outil qui télécharge ça sans demander a dépensé le crédit de
 * quelqu'un à sa place, et ce quelqu'un ne l'apprendra qu'en voyant son solde.
 * Donc : le chiffre d'abord, le bouton ensuite.
 *
 * Et le chiffre n'est pas écrit à la main ici. Il est mesuré à la construction,
 * sur les fichiers réellement déposés, et lu dans leur manifeste. Une constante
 * tapée par un humain aurait menti dès la première montée de version — et elle
 * aurait menti dans le sens qui arrange.
 */

/**
 * Le fichier qu'on exécute.
 *
 * `main.py` d'abord si le projet en a un — c'est la convention que tout le
 * monde reconnaîtra ailleurs. Sinon le premier `.py` : quelqu'un qui a nommé
 * son unique fichier `calcul.py` s'attend à ce que « Lancer » le lance, pas à
 * ce qu'on lui reproche un nom.
 */
export function fichierPrincipalPython(projet: Projet): Fichier | null {
  const pythons = projet.fichiers.filter((f) => sorteDuFichier(f.nom) === 'py')
  if (pythons.length === 0) return null
  return pythons.find((f) => f.nom.toLowerCase() === 'main.py') ?? pythons[0] ?? null
}

/**
 * Un projet Python, ou un projet de page ?
 *
 * Les deux ne se mélangent pas : une page s'affiche, un programme Python écrit
 * dans la console. Le départager par la présence d'un `.py` évite un réglage
 * de plus à comprendre — on ajoute un fichier Python, et « Lancer » lance
 * Python.
 */
export function estProjetPython(projet: Projet): boolean {
  return fichierPrincipalPython(projet) !== null
}

export interface FichierPyodide {
  readonly nom: string
  /** Ce qui restera sur le téléphone. */
  readonly octets: number
  /** Ce que le forfait paiera — compressé, comme le sert un vrai serveur. */
  readonly surLeFil: number
  /**
   * L'empreinte du fichier tel qu'il a été déposé.
   *
   * Un téléchargement de cinq mégaoctets sur un réseau qui coupe ne rate pas
   * bruyamment : il rend un fichier tronqué, et l'interpréteur part alors dans
   * une erreur incompréhensible. On vérifie donc ce qu'on a reçu avant de le
   * garder, et on redemande plutôt que de garder un moteur cassé.
   */
  readonly empreinte: string
  /** Un script s'injecte comme du texte ; le reste voyage en octets. */
  readonly forme: 'texte' | 'octets'
}

export interface ManifestePython {
  readonly version: string
  readonly fichiers: readonly FichierPyodide[]
  readonly surLeFil: number
  readonly octets: number
}

const FORMES = new Set(['texte', 'octets'])

function lireFichier(valeur: unknown): FichierPyodide | null {
  if (typeof valeur !== 'object' || valeur === null) return null
  const f = valeur as Record<string, unknown>
  if (typeof f['nom'] !== 'string' || f['nom'] === '') return null
  if (typeof f['empreinte'] !== 'string' || !/^[0-9a-f]{64}$/.test(f['empreinte'])) return null
  if (typeof f['forme'] !== 'string' || !FORMES.has(f['forme'])) return null
  const octets = f['octets']
  const surLeFil = f['surLeFil']
  if (typeof octets !== 'number' || !Number.isFinite(octets) || octets <= 0) return null
  if (typeof surLeFil !== 'number' || !Number.isFinite(surLeFil) || surLeFil <= 0) return null
  return {
    nom: f['nom'],
    octets,
    surLeFil,
    empreinte: f['empreinte'],
    forme: f['forme'] as 'texte' | 'octets',
  }
}

/**
 * Le manifeste, vérifié.
 *
 * Il arrive par le réseau, donc on ne le croit pas sur parole. Un manifeste à
 * moitié lu ferait annoncer « 0 Mo » avant un téléchargement de cinq — c'est
 * exactement le mensonge que tout ceci existe pour éviter, et il vaut mieux ne
 * rien proposer que de proposer un prix faux.
 */
export function lireManifeste(valeur: unknown): ManifestePython | null {
  if (typeof valeur !== 'object' || valeur === null) return null
  const m = valeur as Record<string, unknown>
  if (typeof m['version'] !== 'string' || m['version'] === '') return null
  if (!Array.isArray(m['fichiers']) || m['fichiers'].length === 0) return null

  const fichiers = m['fichiers'].map(lireFichier)
  if (fichiers.some((f) => f === null)) return null
  const bons = fichiers as FichierPyodide[]

  // Les totaux se recalculent : les recopier du manifeste laisserait passer un
  // fichier oublié dans la liste sans que le prix annoncé bouge.
  return {
    version: m['version'],
    fichiers: bons,
    surLeFil: bons.reduce((t, f) => t + f.surLeFil, 0),
    octets: bons.reduce((t, f) => t + f.octets, 0),
  }
}

/**
 * Des octets en mégaoctets, dans la langue de la personne.
 *
 * La virgule décimale n'est pas un détail de style : « 5.3 » se lit « cinq
 * mille trois cents » pour qui compte en français, et c'est un facteur mille
 * sur un prix.
 */
export function enMegaoctets(octets: number, langue: Langue): string {
  const mo = octets / 1_048_576
  const arrondi = mo < 10 ? mo.toFixed(1) : String(Math.round(mo))
  return langue === 'fr' ? `${arrondi.replace('.', ',')} Mo` : `${arrondi} MB`
}
