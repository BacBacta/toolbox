import type { JSX } from 'preact';
import type { Compose, ProprietesOutil } from '../outils.js';
import type { Extrait } from '@a237/engine';
/**
 * Un registre composé par le modèle n'a pas de squelette : sa configuration
 * voyage avec lui, dans l'outil enregistré.
 *
 * C'est la thèse du brief prise au mot (§ 2.1, § 4) — le modèle n'a produit
 * que de la configuration, et c'est `RegistreListe`, écrit à la main et testé,
 * qui la dessine. Rien ici ne distingue un registre composé d'un squelette,
 * sinon d'où vient sa description ; il s'ouvre hors ligne comme les autres.
 */
export declare const ID_COMPOSE = "compose";
export declare function Outil(props: ProprietesOutil): JSX.Element;
export declare function creer(skeleton: string, _maintenant: Date, _extrait: Extrait, compose?: Compose): {
    nom: string;
    etat: unknown;
};
