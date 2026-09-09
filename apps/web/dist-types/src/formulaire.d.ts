import type { JsonSchema } from '@a237/engine';
import type { JSX } from 'preact';
/**
 * Le formulaire d'édition, dressé à partir du schéma.
 *
 * C'est la thèse du brief appliquée à l'éditeur : le squelette décrit sa
 * configuration en JSON Schema, et l'écran s'en déduit. Écrire un formulaire à
 * la main par squelette, ce serait dix-sept écrans à tenir à jour, qui
 * divergeraient du schéma au premier champ ajouté — et le schéma est ce que le
 * modèle remplit, donc la divergence se paierait deux fois.
 *
 * Les libellés viennent de `title`, un mot-clef standard de JSON Schema : pas
 * de table de traduction à côté, donc rien à oublier de traduire.
 */
export interface ProprietesChamps {
    readonly schema: JsonSchema;
    readonly valeur: unknown;
    readonly onChange: (valeur: unknown) => void;
    /** Chemins à ne pas montrer : dérivés, ou tenus par un autre écran. */
    readonly masques?: readonly string[];
    readonly chemin?: string;
}
export declare function ChampsSchema(props: ProprietesChamps): JSX.Element | null;
/** Une valeur neuve conforme au schéma, pour l'ajout d'une ligne. */
export declare function valeurNeuve(schema: JsonSchema): unknown;
