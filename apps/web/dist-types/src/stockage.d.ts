import type { CalculDemande, RegistreDemande } from '@a237/engine';
/** Un outil tel qu'il est rangé sur le téléphone. */
export interface OutilEnregistre {
    readonly id: string;
    /** L'identifiant du squelette : `devis`, `facture`, `njangi`… */
    readonly skeleton: string;
    readonly nom: string;
    /** L'état, conforme au schéma du squelette. Validé avant d'être rendu. */
    readonly etat: unknown;
    /**
     * La configuration d'un registre composé par le modèle, quand il n'y a pas de
     * squelette derrière.
     *
     * C'est ce qui rend l'étage 2 durable : le registre composé n'est pas une
     * vue jetable, il vit sur le téléphone comme les autres, s'ouvre hors ligne,
     * et se partage pareil. `skeleton` vaut alors `'compose'` — aucun squelette
     * ne porte ce nom, et le fragment de liste sait le reconnaître.
     *
     * Absent pour les outils bâtis sur un squelette, qui sont la règle.
     */
    readonly registre?: RegistreDemande;
    /** L'autre forme composable : quelques champs, une formule, un résultat. */
    readonly calcul?: CalculDemande;
    /**
     * Version monotone. Le serveur refusera une publication dont la version est
     * inférieure ou égale à celle qu'il détient : un vieux téléphone n'écrase pas
     * une publication plus récente (BRIEF.md § 3.5).
     */
    readonly version: number;
    /**
     * L'adresse publique, une fois qu'elle existe vraiment.
     *
     * Elle est tirée au premier dépôt accepté et ne change plus : un outil
     * republié garde son lien, sans quoi chaque correction d'une facture
     * enverrait le client sur une adresse morte.
     */
    readonly lien?: string;
    /**
     * La version que le serveur détient. Elle dit si republier a un objet :
     * `version === versionPubliee` veut dire que rien n'a bougé depuis.
     */
    readonly versionPubliee?: number;
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
 * Note qu'un dépôt a été accepté.
 *
 * Le lien et la version publiée sont écrits **après** la réponse du serveur, et
 * jamais avant : un lien inscrit d'avance serait une adresse morte, envoyée
 * sous le nom de celui qui la partage.
 */
export declare function noterPublication(outil: OutilEnregistre, lien: string, version: number): Promise<OutilEnregistre>;
/**
 * Range un outil neuf.
 *
 * L'état initial est fourni par le fragment de l'outil, pas construit ici : le
 * stockage ne connaît aucun squelette, et la coquille ne tire donc pas les
 * dix-sept schémas dans son fragment de départ pour créer un devis.
 */
export declare function creerOutil(skeletonId: string, nom: string, etat: unknown, maintenant: Date, compose?: {
    readonly registre?: RegistreDemande;
    readonly calcul?: CalculDemande;
}): Promise<OutilEnregistre>;
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
