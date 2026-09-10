import type { Reponse } from '@a237/engine';
export interface Recolte {
    readonly reponses: readonly Reponse[];
    /** Quand cette liste a été rapportée du serveur. `null` si jamais. */
    readonly leA: number | null;
    /** Vrai quand on n'a pas pu joindre le serveur cette fois-ci. */
    readonly horsLigne: boolean;
}
export declare function dernieresConnues(lien: string): Promise<Recolte>;
/**
 * Va chercher les réponses, et range ce qu'elle rapporte.
 *
 * En cas d'échec réseau elle rend ce qu'on avait, en le disant : un écran vide
 * ferait croire que personne n'a répondu, ce qui est le pire des malentendus
 * pour quelqu'un qui attend des commandes.
 */
export declare function rafraichir(lien: string, maintenant: Date): Promise<Recolte>;
