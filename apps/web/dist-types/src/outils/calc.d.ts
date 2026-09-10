import type { Extrait } from '@a237/engine';
import type { JSX } from 'preact';
import type { Compose, ProprietesOutil } from '../outils.js';
export declare function Outil(props: ProprietesOutil): JSX.Element;
export declare function creer(skeleton: string, _maintenant: Date, _extrait: Extrait, compose?: Compose): {
    nom: string;
    etat: unknown;
};
