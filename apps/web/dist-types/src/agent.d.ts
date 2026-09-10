import type { Ebauche, LectureTour } from '@a237/engine';
/**
 * Parler à l'agent, et recevoir ce qu'il écrit pendant qu'il l'écrit.
 *
 * Le modèle n'est jamais appelé d'ici. Cette fonction parle à `/api/chat`, qui
 * détient la clef dans son environnement et ne la rend à personne (§ 2.8). Ce
 * qui revient n'est pas du HTML ni du code : une phrase, et une configuration
 * que le moteur a déjà validée (§ 3, point 5).
 *
 * `EventSource` ne sert à rien ici : il ne sait pas faire de `POST`, et il
 * faudrait mettre la conversation dans l'adresse. On lit donc le corps de la
 * réponse à la main, ce qui a l'avantage de rendre l'abandon possible — quand
 * quelqu'un ferme l'écran, le tour s'arrête.
 */
export type Signe = 
/** Ce qu'il y a à montrer maintenant. Remplace entièrement le précédent. */
{
    readonly sorte: 'ebauche';
    readonly ebauche: Ebauche;
} | {
    readonly sorte: 'fin';
    readonly tour: LectureTour;
    readonly fcfa: number;
    readonly conversation: string;
}
/** Le proxy existe mais n'est pas ouvert. On le dit, on ne fait pas semblant. */
 | {
    readonly sorte: 'pas-ouvert';
} | {
    readonly sorte: 'sans-credit';
    readonly pourquoi: string;
} | {
    readonly sorte: 'abonnement-requis';
    readonly pourquoi: string;
} | {
    readonly sorte: 'panne';
    readonly pourquoi: string;
};
export interface Dit {
    readonly qui: 'personne' | 'agent';
    readonly texte: string;
}
export interface Tour {
    readonly messages: readonly Dit[];
    /** L'outil déjà sur la table, tel que le dernier tour l'a rendu. */
    readonly outil?: unknown;
    /** Le laissez-passer du tour précédent : sans lui, on repaie un crédit. */
    readonly conversation?: string;
}
/**
 * Un tour, rendu signe par signe.
 *
 * Un générateur et non un rappel : celui qui appelle décide du rythme auquel il
 * redessine, et `for await` s'arrête tout seul quand on quitte l'écran.
 */
export declare function parler(tour: Tour, signal?: AbortSignal): AsyncGenerator<Signe>;
