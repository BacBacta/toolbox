/**
 * Ce que l'application sait de son compte.
 *
 * Rien ici n'est nécessaire pour se servir de l'atelier : les outils
 * s'ouvrent, se remplissent et se partagent sans jamais appeler ces
 * fonctions. Elles ne servent qu'à ce qui coûte — composer avec le modèle — et
 * l'écran ne les appelle donc pas au démarrage.
 *
 * Chaque réponse est aussi une occasion de dire ce qu'il reste : le solde
 * revient avec ce qu'on demandait, sans aller-retour de plus.
 *
 * Le dernier état connu est gardé sur l'appareil, et c'est lui que l'écran
 * montre. Interroger le serveur au démarrage ferait une requête réseau à
 * chaque lancement, pour une ligne dont la plupart des gens n'ont pas besoin,
 * dans une application qui doit s'ouvrir en mode avion (§ 2.7). Il se
 * rafraîchit tout seul : la seule requête qui change le solde est aussi celle
 * qui le rapporte.
 */
export type Plan = 'essai' | 'atelier';
export interface EtatCompte {
    readonly plan: Plan;
    readonly credits: number;
    /** Fin de l'abonnement, en ms. `null` en essai. */
    readonly expire: number | null;
    readonly aUnCode: boolean;
}
export type Issue<T> = {
    readonly sorte: 'ok';
    readonly valeur: T;
}
/** Hors ligne, ou serveur muet. Ce n'est pas une panne du compte. */
 | {
    readonly sorte: 'differe';
} | {
    readonly sorte: 'refuse';
    readonly pourquoi: string;
};
export declare function lireCompte(): Promise<Issue<EtatCompte>>;
/** Un code neuf annule le précédent : c'est ce qu'on veut si on l'a laissé traîner. */
export declare function demanderCode(): Promise<Issue<{
    code: string;
    pourquoi: string;
}>>;
export declare function reprendreAvecCode(code: string): Promise<Issue<EtatCompte>>;
export interface Amorce {
    readonly id: string;
    readonly montantXaf: number;
    readonly consigne: string;
}
export declare function demarrerPaiement(telephone: string): Promise<Issue<Amorce>>;
export interface Suivi {
    readonly etat: 'attente' | 'reussi' | 'echoue';
    readonly plan: Plan;
    readonly credits: number;
}
export declare function suivrePaiement(id: string): Promise<Issue<Suivi>>;
export declare function dernierEtatConnu(): Promise<EtatCompte | null>;
export declare function retenirEtat(etat: EtatCompte): Promise<void>;
/**
 * Ce qu'une réponse du modèle apprend au passage.
 *
 * Le proxy renvoie le solde avec la composition : le compte se tient à jour
 * sans qu'on l'interroge, et sans coûter un aller-retour de plus.
 */
export declare function noterApresComposition(plan: unknown, credits: unknown): Promise<void>;
