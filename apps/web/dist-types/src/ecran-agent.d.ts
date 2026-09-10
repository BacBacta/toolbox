import type { Extrait } from '@a237/engine';
import '@a237/render/styles/vitrine.css';
import type { JSX } from 'preact';
import type { Compose } from './outils.js';
/**
 * L'atelier : on discute, et l'outil se dessine à côté.
 *
 * C'est l'étage 2 du brief rendu conversationnel. Un bouton qui lance une
 * génération et rend un outil marchait — mais il ne laissait aucune place à la
 * deuxième phrase, alors que personne ne décrit du premier coup l'outil qu'il
 * veut. « Non, ajoute une colonne pour le mode de paiement » est la vraie
 * façon dont un outil se fabrique.
 *
 * Deux moitiés d'écran, et la seconde est le sujet de tout ce fichier :
 *
 * - **la conversation**, où l'agent écrit lettre par lettre ;
 * - **la fenêtre**, où l'on voit ce qui est en train d'être fabriqué — le
 *   titre dès qu'il est écrit, puis les colonnes ou les sections qui
 *   s'ajoutent une à une.
 *
 * Cette fenêtre ne montre pas un outil : elle montre une **ébauche**, qui n'a
 * traversé aucun validateur et qui n'a le droit de rien créer. L'outil
 * n'existe qu'à la fin, quand la réponse complète est passée par le moteur.
 * La frontière du § 2.1 n'a pas bougé d'un pouce — c'est la même que celle du
 * bouton, à un écran de plus.
 */
export interface ProprietesAgent {
    /** La première phrase, celle qui a été tapée dans l'atelier. */
    readonly demande: string;
    readonly onCreer: (skeleton: string, extrait: Extrait, compose?: Compose, fcfa?: number) => void;
    readonly onFermer: () => void;
}
export declare function EcranAgent(props: ProprietesAgent): JSX.Element;
