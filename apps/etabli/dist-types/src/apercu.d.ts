import type { Langue, Projet, Textes } from '@a237/etabli';
import type { JSX } from 'preact';
/**
 * Ce que le code fait, et ce qu'il dit.
 *
 * Le cadre est isolé — voir `BAC_A_SABLE` : sans `allow-same-origin`, le code
 * exécuté ici n'atteint ni le stockage de l'Établi, ni ses cookies, ni son DOM.
 * C'est ce qui rend acceptable d'ouvrir un projet reçu de quelqu'un d'autre.
 *
 * La console en dessous n'est pas un ornement. Sur un ordinateur, une erreur
 * s'ouvre dans les outils du navigateur ; sur un Android d'entrée de gamme il
 * n'y a ni touche F12 ni outils, et une page blanche ressemble exactement à une
 * page qui charge. Sans cet écran-là, quelqu'un qui apprend conclut qu'il n'y
 * arrive pas, alors qu'il lui manquait une virgule.
 */
export declare function Apercu(props: {
    readonly projet: Projet;
    /** Change à chaque « Lancer » : c'est ce qui force le cadre à repartir de zéro. */
    readonly tour: number;
    readonly langue: Langue;
    readonly t: Textes;
}): JSX.Element;
