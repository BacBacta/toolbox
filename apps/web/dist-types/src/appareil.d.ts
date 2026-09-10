export declare function jetonDeCetAppareil(): Promise<string>;
/** L'en-tête que porte chaque requête qui engage le compte. */
export declare function entetesDAppareil(): Promise<Record<string, string>>;
/**
 * Le même en-tête, mais qui ne fait jamais échouer ce qu'il accompagne.
 *
 * Publier ne demande aucun compte, sauf pour un formulaire, qui a besoin d'un
 * destinataire. Y ajouter l'en-tête sans précaution a fait dépendre la
 * publication **de tous les outils** d'un accès à IndexedDB : en navigation
 * privée, sur un téléphone plein, ou dans un navigateur qui bloque le stockage,
 * un devis cessait de se publier — silencieusement, puisque l'échec ressemble
 * à une absence de réseau et repart dans la file.
 *
 * Ici, ce qui rate ne rate que pour soi : la requête part sans en-tête, et
 * seul un dépôt de formulaire sera refusé — ce qui est exact, puisqu'on ne sait
 * alors pas à qui les réponses reviendraient.
 */
export declare function entetesSiPossible(): Promise<Record<string, string>>;
/** Remet le cache en mémoire à zéro. Sert aux essais, et à rien d'autre. */
export declare function oublierEnMemoire(): void;
