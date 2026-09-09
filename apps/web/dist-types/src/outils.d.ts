import type { Extrait, RenderContext, ShareSpec } from '@a237/engine';
import type { JSX } from 'preact';
import type { OutilEnregistre } from './stockage.js';
export interface ProprietesOutil {
    readonly outil: OutilEnregistre;
    /**
     * Le signe du catalogue, transmis par la coquille.
     *
     * Il ne se lit pas depuis le fragment : le catalogue est déjà en mémoire dans
     * la coquille, et l'importer ici le dupliquerait dans chacun des cinq
     * fragments pour un caractère.
     */
    readonly glyphe: string;
    readonly ctx: RenderContext;
    readonly onChange: (etat: unknown) => void;
    readonly onDiffuser: (partage: ShareSpec) => void;
}
export interface EtatNeuf {
    readonly nom: string;
    readonly etat: unknown;
}
export interface ModuleOutil {
    readonly Outil: (p: ProprietesOutil) => JSX.Element;
    /**
     * L'état d'un outil neuf. Il vit avec le fragment de l'outil et non dans la
     * coquille : le squelette complet — schéma, calculs, valeurs par défaut — ne
     * se charge qu'au moment où on en a vraiment besoin.
     *
     * L'identifiant est passé parce qu'un même fragment sert plusieurs
     * squelettes : les quatre registres de liste partagent un écran, les deux
     * calculatrices aussi.
     *
     * `extrait` porte ce que la demande disait déjà — « njangi de 20 000 F par
     * mois ». Le squelette en prend ce qu'il sait interpréter sans risque, et
     * ignore le reste.
     */
    readonly creer: (skeleton: string, maintenant: Date, extrait: Extrait) => EtatNeuf;
}
/**
 * Un import dynamique par squelette.
 *
 * C'est ce qui tient le budget de 120 Ko : la coquille ne paie pas les outils
 * qu'on n'ouvre pas. Rollup en tire un fragment par entrée, et le service
 * worker les met tous en cache à l'installation — donc le mode avion marche
 * quand même, dès la première visite.
 */
export declare const CHARGEURS: Readonly<Record<string, () => Promise<ModuleOutil>>>;
export declare function outilDisponible(skeleton: string): boolean;
