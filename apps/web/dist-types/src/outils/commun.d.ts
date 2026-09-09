import type { ErreurValidation, Manquement } from '@a237/engine';
import type { ComponentChildren, JSX } from 'preact';
/**
 * Ce que devis et facture partagent à l'écran. Ils ne diffèrent que par ce
 * qu'ils engagent ; leur cadre est le même.
 */
/**
 * Un état qui ne valide pas contre son schéma ne doit jamais atteindre le
 * rendu (invariant § 2.1). On le dit, on ne devine pas.
 */
export declare function EtatInvalide(props: {
    readonly erreurs: readonly ErreurValidation[];
}): JSX.Element;
/** Ce qui manque au document pour passer un contrôle. */
export declare function Manquements(props: {
    readonly manquements: readonly Manquement[];
}): JSX.Element | null;
export type OngletDocument = 'Document' | 'Modifier';
export declare function CadreDocument(props: {
    readonly titre: string;
    readonly sousTitre: string;
    readonly onglet: OngletDocument;
    readonly onOnglet: (o: OngletDocument) => void;
    readonly onDiffuser: () => void;
    readonly children: ComponentChildren;
}): JSX.Element;
