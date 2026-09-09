import type { Extrait } from '@a237/engine';
import type { JSX } from 'preact';
import type { ProprietesOutil } from '../outils.js';
export declare function Outil(props: ProprietesOutil): JSX.Element;
export declare function creer(skeleton: string, maintenant: Date, _extrait: Extrait): {
    nom: string;
    etat: unknown;
};
