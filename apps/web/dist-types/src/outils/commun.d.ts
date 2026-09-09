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
/**
 * Ce qui manque au document pour passer un contrôle.
 *
 * Les mentions manquantes s'énumèrent au lieu de se lire en prose : sept
 * mentions dans une phrase font cinq lignes de rouge dont on ne retient rien,
 * alors qu'une liste se pointe du doigt et se coche des yeux.
 *
 * Et l'encart porte le geste qui le fait disparaître. Un écran qui dit « il
 * manque ton NIU » sans emmener là où on le saisit laisse l'utilisateur
 * chercher l'onglet lui-même.
 */
export declare function Manquements(props: {
    readonly manquements: readonly Manquement[];
    readonly onCompleter?: () => void;
}): JSX.Element | null;
export type OngletDocument = 'Document' | 'Modifier';
/**
 * L'onglet d'ouverture d'un document.
 *
 * Un document qu'on vient de créer s'ouvre sur le formulaire : l'onglet
 * Document lui montrerait une page blanche surmontée de la liste des sept
 * mentions qui manquent — un reproche avant le premier geste. Une fois
 * l'entreprise saisie, il y a quelque chose à regarder, et c'est le document
 * qui prend la main.
 *
 * L'état arrive brut, avant validation : ce choix se fait au premier rendu,
 * donc avant qu'on sache s'il est conforme.
 */
export declare function ongletDOuverture(etat: unknown): OngletDocument;
export declare function CadreDocument(props: {
    readonly titre: string;
    readonly glyphe: string;
    readonly sousTitre: string;
    readonly onglet: OngletDocument;
    readonly onOnglet: (o: OngletDocument) => void;
    readonly onDiffuser: () => void;
    readonly children: ComponentChildren;
}): JSX.Element;
