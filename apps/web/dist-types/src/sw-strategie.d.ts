/**
 * Les règles de cache du service worker, isolées pour être testables.
 *
 * Un service worker s'exécute dans une portée que ni Vitest ni happy-dom ne
 * fournissent. Plutôt que de laisser sa logique non vérifiée, elle vit ici sous
 * forme de fonctions pures, et `sw.ts` ne fait plus que les appeler.
 */
export type Strategie = 
/** Une navigation : on sert la coquille, même hors ligne. */
'coquille'
/** Un fichier de l'application : le cache d'abord, le réseau pour se tenir à jour. */
 | 'cache-puis-reseau'
/** Tout le reste : le réseau, sans rien mettre en cache. */
 | 'reseau';
export interface RequeteObservee {
    readonly methode: string;
    readonly mode: string;
    readonly url: string;
    readonly destination: string;
}
export declare function strategiePour(requete: RequeteObservee, origine: string): Strategie;
/** Le nom du cache porte sa version : changer de version purge l'ancien. */
export declare function nomCache(version: string): string;
/** Les caches à supprimer à l'activation : les nôtres, sauf le courant. */
export declare function cachesAPurger(existants: readonly string[], courant: string): string[];
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
 */
export declare function fichiersAPrecacher(emis: readonly string[]): string[];
