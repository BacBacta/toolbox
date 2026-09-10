import type { Extrait, PageDemande } from '@a237/engine';
import '@a237/render/styles/vitrine.css';
import type { JSX } from 'preact';
import type { Compose, ProprietesOutil } from '../outils.js';
/**
 * Une page toute neuve, quand on en ouvre une sans que le modèle en ait écrit.
 *
 * Elle **passe son propre contrôle**, et ce n'est pas une évidence : sa
 * première version ouvrait sur une ligne de liste vide, que `verifierPage`
 * refuse à juste titre — un outil qui s'ouvre sur l'écran d'erreur de son
 * propre validateur n'est pas un outil. Une section de texte, elle, tient
 * debout avec une phrase, et cette phrase dit quoi faire.
 */
export declare const PAGE_VIDE: PageDemande;
export declare function Outil(props: ProprietesOutil): JSX.Element;
export declare function creer(_skeleton: string, _maintenant: Date, _extrait: Extrait, compose?: Compose): {
    nom: string;
    etat: unknown;
};
