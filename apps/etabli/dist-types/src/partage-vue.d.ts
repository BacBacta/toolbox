import type { Projet, Textes } from '@a237/etabli';
import type { JSX } from 'preact';
export declare function Partage(props: {
    readonly projet: Projet;
    readonly onChanger: (projet: Projet) => void;
    readonly t: Textes;
}): JSX.Element;
