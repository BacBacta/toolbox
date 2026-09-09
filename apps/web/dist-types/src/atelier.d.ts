import type { Extrait, FicheSquelette } from '@a237/engine';
import type { JSX } from 'preact';
import type { Compose } from './outils.js';
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
    /**
     * `fcfa` est ce que la composition a coûté. Il ne sert pas à décorer : la
     * consommation se paie à l'appel, et une dépense qu'on ne voit pas est une
     * dépense qu'on découvre à la fin du mois.
     */
    readonly onCreer: (skeleton: string, extrait: Extrait, compose?: Compose, fcfa?: number) => void;
}
export declare function Atelier(props: ProprietesAtelier): JSX.Element;
