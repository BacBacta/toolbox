import type { JSX } from 'preact';
import type { EtatCompte } from './compte.js';
export interface ProprietesCompte {
    readonly etat: EtatCompte | null;
    readonly onEtat: (etat: EtatCompte) => void;
    readonly onRetour: () => void;
}
export declare function EcranCompte(props: ProprietesCompte): JSX.Element;
