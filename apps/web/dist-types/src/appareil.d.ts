export declare function jetonDeCetAppareil(): Promise<string>;
/** L'en-tête que porte chaque requête qui engage le compte. */
export declare function entetesDAppareil(): Promise<Record<string, string>>;
/** Remet le cache en mémoire à zéro. Sert aux essais, et à rien d'autre. */
export declare function oublierEnMemoire(): void;
