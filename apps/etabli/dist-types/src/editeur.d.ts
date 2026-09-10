import type { Fichier, Langue, Projet, Textes } from '@a237/etabli';
import type { JSX } from 'preact';
export declare function Editeur(props: {
    readonly projet: Projet;
    readonly ouvert: string;
    readonly onOuvrir: (nom: string) => void;
    readonly onEcrire: (nom: string, contenu: string) => void;
    readonly onAjouter: (fichier: Fichier) => void;
    readonly langue: Langue;
    readonly t: Textes;
}): JSX.Element;
