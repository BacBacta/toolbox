/**
 * Rejouer ce qui n'est pas parti.
 *
 * Le réseau ne sert qu'à publier, payer et appeler le modèle — trois choses qui
 * peuvent attendre (§ 2.7). Encore faut-il que quelqu'un les reprenne : une
 * file dans laquelle on dépose sans jamais rien retirer n'est pas une file
 * d'attente, c'est un tiroir.
 *
 * On rejoue **l'état d'aujourd'hui**, pas celui du jour où la publication a été
 * mise en attente. Quelqu'un qui a continué de travailler hors ligne veut voir
 * partir son carnet tel qu'il est, pas tel qu'il était à la première tentative.
 * L'entrée de file ne dit donc qu'une chose : cet outil attend d'être publié.
 */
export interface Bilan {
    readonly publies: number;
    /** Restent en attente : le réseau n'est toujours pas là. */
    readonly attendent: number;
    /** Retirés sans être publiés : l'outil a disparu, ou le serveur a dit non. */
    readonly abandonnes: number;
}
export declare function viderLaFile(maintenant: Date): Promise<Bilan>;
