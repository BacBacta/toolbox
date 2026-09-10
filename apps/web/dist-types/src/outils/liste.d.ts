import type { JSX } from 'preact';
import type { Compose, ProprietesOutil } from '../outils.js';
import type { Extrait } from '@a237/engine';
export declare function Outil(props: ProprietesOutil): JSX.Element;
export declare function creer(skeleton: string, _maintenant: Date, _extrait: Extrait, compose?: Compose): {
    nom: string;
    etat: unknown;
};
