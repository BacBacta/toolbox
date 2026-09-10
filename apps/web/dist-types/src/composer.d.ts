import type { CalculDemande, PageDemande, RegistreDemande } from '@a237/engine';
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
 * Une page à publier. C'est la réponse à « je veux un site internet », qui
 * était jusqu'ici la demande la plus refusée de toutes.
 */
 | {
    readonly sorte: 'page';
    readonly page: PageDemande;
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
}
/**
 * Le compte n'a plus de crédit. Ce n'est pas une panne, et proposer de
 * réessayer ferait tourner quelqu'un en rond sur un mur.
 *
 * Le pourquoi vient du serveur : il ne dit pas la même chose à un essai
 * épuisé — « l'abonnement en donne quarante par mois » — qu'à un abonné qui a
 * tout consommé, à qui il dit que les jours restants ne sont pas perdus.
 */
 | {
    readonly sorte: 'sans-credit';
    readonly pourquoi: string;
}
/**
 * La demande vaut plusieurs outils. Elle relève de l'abonnement, et on le
 * dit **avant** d'avoir dépensé quoi que ce soit.
 */
 | {
    readonly sorte: 'abonnement-requis';
    readonly pourquoi: string;
} | {
    readonly sorte: 'echoue';
    readonly pourquoi: string;
};
export declare function composer(demande: string, signal?: AbortSignal): Promise<Composition>;
