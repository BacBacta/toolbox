import type { Extrait, FicheSquelette } from '@a237/engine';
import type { JSX } from 'preact';
/**
 * L'atelier : on dit ce dont on a besoin, l'outil s'ouvre.
 *
 * C'est l'étage 1 du brief rendu conversationnel (§ 4) — **zéro jeton, hors
 * ligne, instantané**. Une boîte de recherche filtrait une grille ; ici la
 * demande est lue, l'outil est ouvert, et ce que la phrase disait déjà y est
 * déjà écrit.
 *
 * Trois réponses possibles, et la troisième compte autant que les deux
 * premières :
 *
 * - **Sûr** — un squelette se détache, on l'ouvre.
 * - **Ambigu** — plusieurs répondent, on demande. Ouvrir d'autorité le mauvais
 *   outil fait perdre plus de temps qu'une question : il faut comprendre ce
 *   qui s'est passé, revenir, recommencer. Une question coûte un tapotement.
 * - **Hors de portée** — aucun mot ne mord. On le dit franchement au lieu de
 *   renvoyer une grille vide, et on nomme ce qu'on sait faire. Les étages 2 et
 *   3, qui feraient composer un outil par le modèle, passent par le proxy du
 *   Worker (§ 3.1) : tant qu'il n'existe pas, promettre serait mentir.
 */
export interface ProprietesAtelier {
    readonly fiches: readonly FicheSquelette[];
    readonly onCreer: (skeleton: string, extrait: Extrait) => void;
    /**
     * Ouvrir la conversation avec l'agent, la phrase déjà tapée en main.
     *
     * L'atelier ne compose plus lui-même. Un bouton qui lançait une génération
     * et rendait un outil marchait, mais il ne laissait aucune place à la
     * deuxième phrase — et personne ne décrit du premier coup l'outil qu'il
     * veut.
     */
    readonly onDiscuter: (demande: string) => void;
}
export declare function Atelier(props: ProprietesAtelier): JSX.Element;
