/** Les numéros émis pour une série, du plus ancien au plus récent. */
export declare function numerosEmis(skeleton: string): Promise<readonly string[]>;
/**
 * Réserve le prochain numéro d'une série, et l'inscrit au registre.
 *
 * Rend `null` pour un squelette qui ne numérote pas — un carnet de njangi ou
 * une feuille de présence n'ont pas de série à tenir.
 */
export declare function reserverNumero(skeleton: string, maintenant: Date): Promise<string | null>;
/**
 * Pose sur un état neuf le numéro que l'atelier vient de réserver.
 *
 * Le squelette a posé un numéro de gabarit — il connaît son préfixe et
 * l'année, mais pas ce que le compte a déjà émis. Celui qui compte se réserve
 * ici, et remplace l'autre avant que l'outil ne soit enregistré.
 */
export declare function numeroter(skeleton: string, etat: unknown, maintenant: Date): Promise<unknown>;
