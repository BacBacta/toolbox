import type { OutilEnregistre } from './stockage.js';
/**
 * Publier depuis le téléphone.
 *
 * Le lien est **tiré ici** et non par le serveur. Deux raisons : la carte doit
 * pouvoir porter son adresse au moment où on la dessine, sans un aller-retour
 * de plus ; et un outil republié garde le lien qu'il avait déjà, sans quoi
 * chaque correction d'une facture enverrait le client sur une adresse morte.
 *
 * Le serveur, lui, refuse un lien déjà pris par un autre outil — mais sur douze
 * caractères d'un alphabet de trente et un, la collision est un événement qu'on
 * n'observera jamais.
 */
/**
 * Un lien tiré au hasard vrai.
 *
 * `crypto.getRandomValues` et non `Math.random` : ce qui protège une facture
 * qui porte un nom de client et des montants, c'est que son adresse ne se
 * devine pas. Un générateur prévisible rendrait les douze caractères inutiles.
 *
 * Le modulo introduit un biais négligeable — 256 n'est pas un multiple de 31 —
 * mais on ne le corrige pas au prix d'une boucle de rejet : le biais porte sur
 * la fréquence d'un caractère, pas sur la devinabilité d'un lien de douze.
 */
export declare function tirerLien(): string;
/**
 * Téléverse la carte, sans jamais faire échouer la publication.
 *
 * Elle est **dessinée sur le téléphone** — le brief l'exige (§ 1, point 6), et
 * c'est le bon découpage : le serveur n'a ni police ni canvas. Elle part après
 * le dépôt, et non avec lui : une image en base64 dans du JSON coûte un tiers
 * de sa taille en plus, et la page de lecture fonctionne sans elle.
 *
 * Ce qui rate ici ne se dit pas à l'utilisateur. Sans carte, l'aperçu WhatsApp
 * porte le titre et la description au lieu de l'image — c'est moins bien, ce
 * n'est pas une panne, et le lien marche.
 */
export declare function televerserCarte(lien: string, png: Blob): Promise<boolean>;
export type Issue = {
    readonly sorte: 'publie';
    readonly lien: string;
}
/** Rien n'a changé depuis la dernière publication : le lien vaut toujours. */
 | {
    readonly sorte: 'deja';
    readonly lien: string;
}
/** L'ardoise et le call-box, pour une raison qui n'est pas technique. */
 | {
    readonly sorte: 'refuse';
    readonly pourquoi: string;
}
/** Le serveur détient plus récent. L'app doit poser la question. */
 | {
    readonly sorte: 'conflit';
    readonly versionServeur: number;
}
/** Hors ligne, ou serveur muet : la publication attend son tour. */
 | {
    readonly sorte: 'differe';
};
/**
 * Dépose l'outil et rend son adresse.
 *
 * Ne lance jamais : une panne de réseau n'est pas une erreur du programme, et
 * l'invariant § 2.7 dit que ce qui a besoin du réseau peut attendre.
 */
export declare function publier(outil: OutilEnregistre, quand: Date, lienExistant?: string): Promise<Issue>;
