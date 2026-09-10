import type { Extrait, FormulaireDemande } from '@a237/engine';
import '@a237/render/styles/vitrine.css';
import type { JSX } from 'preact';
import type { Compose, ProprietesOutil } from '../outils.js';
/** Un formulaire tout neuf, qui passe son propre contrôle. */
export declare const FORMULAIRE_VIDE: FormulaireDemande;
export declare function Outil(props: ProprietesOutil): JSX.Element;
export declare function creer(_skeleton: string, _maintenant: Date, _extrait: Extrait, compose?: Compose): {
    nom: string;
    etat: unknown;
};
