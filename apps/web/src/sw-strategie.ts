/**
 * Les règles de cache du service worker, isolées pour être testables.
 *
 * Un service worker s'exécute dans une portée que ni Vitest ni happy-dom ne
 * fournissent. Plutôt que de laisser sa logique non vérifiée, elle vit ici sous
 * forme de fonctions pures, et `sw.ts` ne fait plus que les appeler.
 */

export type Strategie =
  /** Une navigation : on sert la coquille, même hors ligne. */
  | 'coquille'
  /** Un fichier de l'application : le cache d'abord, le réseau pour se tenir à jour. */
  | 'cache-puis-reseau'
  /** Tout le reste : le réseau, sans rien mettre en cache. */
  | 'reseau'

export interface RequeteObservee {
  readonly methode: string
  readonly mode: string
  readonly url: string
  readonly destination: string
}

const DESTINATIONS_APP = new Set(['script', 'style', 'font', 'image', 'manifest', ''])

/**
 * Ce qui vit sur le même domaine sans appartenir à l'application.
 *
 * `/d/…` est une page publiée, rendue par le serveur ; `/api/…` sont les
 * fonctions. Servir la coquille à leur place ferait voir l'accueil de
 * l'application à qui ouvre le lien d'un devis — et seulement aux gens qui ont
 * installé l'application, ce qui rend le défaut invisible pour celui qui a
 * envoyé le lien.
 *
 * Hors ligne, ces adresses échouent, et c'est honnête : leur contenu est sur le
 * serveur, il n'a jamais été sur le téléphone.
 */
const CHEMINS_SERVEUR = ['/d/', '/api/']

export function strategiePour(requete: RequeteObservee, origine: string): Strategie {
  // On ne met jamais en cache autre chose qu'une lecture : publier, payer et
  // appeler le modèle passent par le réseau ou par la file d'attente.
  if (requete.methode !== 'GET') return 'reseau'

  let url: URL
  try {
    url = new URL(requete.url)
  } catch {
    return 'reseau'
  }
  if (url.origin !== origine) return 'reseau'
  if (CHEMINS_SERVEUR.some((prefixe) => url.pathname.startsWith(prefixe))) return 'reseau'

  if (requete.mode === 'navigate') return 'coquille'

  return DESTINATIONS_APP.has(requete.destination) ? 'cache-puis-reseau' : 'reseau'
}

/** Le nom du cache porte sa version : changer de version purge l'ancien. */
export function nomCache(version: string): string {
  return `atelier237-${version}`
}

/** Les caches à supprimer à l'activation : les nôtres, sauf le courant. */
export function cachesAPurger(existants: readonly string[], courant: string): string[] {
  return existants.filter((c) => c.startsWith('atelier237-') && c !== courant)
}

/**
 * La coquille, telle qu'elle est rangée et relue.
 *
 * `/` et non `/index.html` : voir `fichiersAPrecacher`.
 */
export const COQUILLE = '/'

/**
 * La liste des fichiers à précharger, dédoublonnée.
 *
 * `cache.addAll` **rejette** quand deux entrées désignent la même requête, et
 * l'installation du service worker échoue alors en silence : rien n'est mis en
 * cache, aucune erreur ne remonte à la page, et le mode avion ne marche pas.
 * C'est arrivé — `index.html` figurait à la fois dans la coquille et dans la
 * liste des fichiers émis par la construction.
 *
 * Cette fonction est employée des deux côtés : par le greffon qui écrit
 * `precache.json` à la construction, et par le service worker qui le relit.
 *
 * **`/index.html` n'y figure pas, et c'est la même panne sous un autre
 * déguisement.** Cloudflare Pages le redirige vers `/` en 308 ; `addAll` suit
 * la redirection, obtient une réponse marquée `redirected`, et `Cache.put` la
 * refuse. L'installation échoue en entier, sans un mot, et le mode avion ne
 * marche pas. `/` sert les mêmes octets et ne redirige pas : la coquille se
 * range et se relit sous ce nom-là. Le serveur des vérifications de bout en
 * bout reproduit la redirection, faute de quoi la garde ne garderait rien.
 */
export function fichiersAPrecacher(emis: readonly string[]): string[] {
  const coquille = [COQUILLE, '/manifest.webmanifest']
  const emisSansCoquille = emis
    .map((f) => (f.startsWith('/') ? f : `/${f}`))
    .filter((f) => f !== '/index.html')
  return [...new Set([...coquille, ...emisSansCoquille])]
}
