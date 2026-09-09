/** Un outil tel qu'il est rangé sur le téléphone. */
export interface OutilEnregistre {
    readonly id: string;
    /** L'identifiant du squelette : `devis`, `facture`, `njangi`… */
    readonly skeleton: string;
    readonly nom: string;
    /** L'état, conforme au schéma du squelette. Validé avant d'être rendu. */
    readonly etat: unknown;
    /**
     * Version monotone. Le serveur refusera une publication dont la version est
     * inférieure ou égale à celle qu'il détient : un vieux téléphone n'écrase pas
     * une publication plus récente (BRIEF.md § 3.5).
     */
    readonly version: number;
    readonly creeLe: number;
    readonly majLe: number;
}
/** Une publication qui attend le réseau. */
export interface PublicationEnAttente {
    readonly id: string;
    readonly outilId: string;
    readonly version: number;
    readonly creeLe: number;
}
export declare function nouvelIdentifiant(): string;
/** Les outils, le plus récemment touché en premier. */
export declare function listerOutils(): Promise<OutilEnregistre[]>;
export declare function lireOutil(id: string): Promise<OutilEnregistre | null>;
export declare function enregistrerOutil(outil: OutilEnregistre): Promise<void>;
export declare function supprimerOutil(id: string): Promise<void>;
/**
 * Range un nouvel état et fait avancer la version.
 *
 * La version monte à chaque enregistrement, pas seulement à chaque publication :
 * c'est ce qui permet au serveur de reconnaître un état plus ancien même quand
 * l'appareil est resté longtemps hors ligne.
 */
export declare function majEtat(outil: OutilEnregistre, etat: unknown, maintenant: Date): Promise<OutilEnregistre>;
/**
 * Range un outil neuf.
 *
 * L'état initial est fourni par le fragment de l'outil, pas construit ici : le
 * stockage ne connaît aucun squelette, et la coquille ne tire donc pas les
 * dix-sept schémas dans son fragment de départ pour créer un devis.
 */
export declare function creerOutil(skeletonId: string, nom: string, etat: unknown, maintenant: Date): Promise<OutilEnregistre>;
/**
 * Met une publication en file d'attente.
 *
 * Le réseau ne sert qu'à publier, payer et appeler le modèle — trois choses qui
 * peuvent attendre (invariant § 2.7). Ce qui n'est pas parti est rejoué au
 * prochain lancement.
 */
export declare function filerPublication(entree: PublicationEnAttente): Promise<void>;
export declare function lireFile(): Promise<PublicationEnAttente[]>;
export declare function retirerDeLaFile(id: string): Promise<void>;
