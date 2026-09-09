import type { JSX } from 'preact';
import type { ProprietesOutil } from '../outils.js';
import type { Extrait } from '@a237/engine';
export declare function Outil(props: ProprietesOutil): JSX.Element;
export declare function creer(_skeleton: string, maintenant: Date, _extrait: Extrait): {
    nom: string;
    etat: unknown;
};
