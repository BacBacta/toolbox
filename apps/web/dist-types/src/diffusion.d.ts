import type { ShareSpec } from '@a237/engine';
import type { JSX } from 'preact';
export declare function Diffusion(props: {
    readonly partage: ShareSpec;
    /**
     * Ce que la publication a donné, quand elle n'a pas abouti.
     *
     * Elle n'empêche jamais de partager : la carte part sans adresse, comme
     * avant. Mais le taire ferait croire à un lien qui n'existe pas.
     */
    readonly mot?: string;
    readonly onFermer: () => void;
}): JSX.Element;
