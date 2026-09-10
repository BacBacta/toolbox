import type { Projet } from '@a237/etabli';
/**
 * Sauvegarder, et partager : c'est le même geste.
 *
 * Déposer le projet sur le serveur lui donne un lien. Ce lien le retrouve quand
 * le téléphone a disparu, et c'est aussi ce qu'on envoie à quelqu'un. Une seule
 * mécanique referme les deux manques.
 *
 * Rien de tout cela n'est une condition pour travailler : l'Établi s'ouvre, on
 * écrit et on exécute sans réseau. Le dépôt est un bouton, jamais un passage
 * obligé.
 */
export type Resultat = {
    readonly sorte: 'depose';
    readonly projet: Projet;
} | {
    readonly sorte: 'ouvert';
    readonly nom: string;
    readonly fichiers: Projet['fichiers'];
} | {
    readonly sorte: 'pas-de-reseau';
} | {
    readonly sorte: 'introuvable';
} | {
    readonly sorte: 'refuse';
    readonly pourquoi: string;
};
/**
 * Dépose le projet, et rend le projet muni de son lien.
 *
 * Le lien et la clef se tirent **sur l'appareil**, pas sur le serveur : celui
 * qui dépose n'a donc rien à demander à personne, et un premier dépôt tient en
 * un aller simple. Le serveur ne fait qu'accepter ou refuser.
 */
export declare function deposer(projet: Projet): Promise<Resultat>;
/** Ouvre un projet reçu. Ce qui revient est vérifié avant d'exister. */
export declare function recuperer(lien: string): Promise<Resultat>;
/**
 * Le lien tel qu'on l'envoie sur WhatsApp.
 *
 * Il ouvre l'éditeur sur le projet — il ne sert **jamais** la page directement.
 * Servir du HTML écrit par un inconnu ferait de cette adresse un hébergement de
 * pages piégées ; ici, le code reçu s'exécute dans le cadre isolé de celui qui
 * l'ouvre, comme n'importe quel autre projet.
 */
export declare function adressePartagee(lien: string, origine: string): string;
/** Le lien demandé dans l'adresse, s'il y en a un. */
export declare function lienDemande(recherche: string): string | null;
