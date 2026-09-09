import type { CalculDemande, RegistreDemande } from '@a237/engine';
/**
 * L'étage 2 : ce que l'étage 1 n'a pas su faire, on le fait composer.
 *
 * Le modèle n'est jamais appelé d'ici. Cette fonction parle à `/api/ai`, qui
 * détient la clef dans son environnement et ne la rend à personne (§ 2.8). Le
 * client ne voit qu'une configuration de registre — jamais de HTML, jamais de
 * code (§ 3, point 5).
 *
 * Et il la **revérifie** avant de s'en servir. Le serveur l'a déjà fait, mais
 * un serveur peut être d'une version plus ancienne que l'application qui
 * l'interroge, et le contrat vit dans le moteur précisément pour que les deux
 * côtés lisent la même règle. Un contrôle qu'on ne fait qu'une fois est un
 * contrôle qu'on finira par ne plus faire.
 */
export type Composition = {
    readonly sorte: 'compose';
    readonly registre: RegistreDemande;
    readonly fcfa: number;
} | {
    readonly sorte: 'calcule';
    readonly calcul: CalculDemande;
    readonly fcfa: number;
}
/**
 * Le modèle a répondu que la demande n'est pas un registre. C'est une
 * réponse, pas une panne : on la montre telle quelle et on ne réessaie pas.
 */
 | {
    readonly sorte: 'hors-sujet';
    readonly pourquoi: string;
}
/** Le proxy existe mais n'est pas ouvert. On le dit, on ne fait pas semblant. */
 | {
    readonly sorte: 'pas-ouvert';
} | {
    readonly sorte: 'echoue';
    readonly pourquoi: string;
};
export declare function composer(demande: string, signal?: AbortSignal): Promise<Composition>;
