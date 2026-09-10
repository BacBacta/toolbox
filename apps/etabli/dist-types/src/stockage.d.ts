import type { Projet } from '@a237/etabli';
/** Les projets, du plus récemment touché au plus ancien. */
export declare function lireProjets(): Promise<readonly Projet[]>;
export declare function enregistrer(projet: Projet): Promise<void>;
export declare function supprimer(id: string): Promise<void>;
