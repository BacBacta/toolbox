import { ALPHABET_LIEN, LONGUEUR_LIEN, publiable, pourquoiNonPubliable } from '@a237/engine';
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
export function tirerLien() {
    const octets = new Uint8Array(LONGUEUR_LIEN);
    crypto.getRandomValues(octets);
    let lien = '';
    for (const o of octets)
        lien += ALPHABET_LIEN[o % ALPHABET_LIEN.length];
    return lien;
}
function instantaneDe(outil, quand) {
    return {
        skeleton: outil.skeleton,
        nom: outil.nom,
        etat: outil.etat,
        ...(outil.registre === undefined ? {} : { registre: outil.registre }),
        ...(outil.calcul === undefined ? {} : { calcul: outil.calcul }),
        version: outil.version,
        publieLe: quand.toISOString(),
    };
}
/**
 * Dépose l'outil et rend son adresse.
 *
 * Ne lance jamais : une panne de réseau n'est pas une erreur du programme, et
 * l'invariant § 2.7 dit que ce qui a besoin du réseau peut attendre.
 */
export async function publier(outil, quand, lienExistant) {
    const pourquoi = pourquoiNonPubliable(outil.skeleton);
    if (!publiable(outil.skeleton) && pourquoi !== null) {
        // Refusé sans toucher au réseau : la raison est connue d'avance, et la
        // dire tout de suite vaut mieux que de la faire dire par un serveur.
        return { sorte: 'refuse', pourquoi };
    }
    const lien = lienExistant ?? tirerLien();
    let reponse;
    try {
        reponse = await fetch('/api/publier', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ lien, instantane: instantaneDe(outil, quand) }),
        });
    }
    catch {
        return { sorte: 'differe' };
    }
    if (reponse.ok)
        return { sorte: 'publie', lien };
    let corps = {};
    try {
        corps = (await reponse.json());
    }
    catch {
        // Un corps illisible ne change rien à ce que dit le code.
    }
    if (reponse.status === 403) {
        return {
            sorte: 'refuse',
            pourquoi: typeof corps.pourquoi === 'string' ? corps.pourquoi : 'Cet outil ne se publie pas.',
        };
    }
    if (reponse.status === 409) {
        const v = corps.versionServeur;
        return { sorte: 'conflit', versionServeur: typeof v === 'number' ? v : 0 };
    }
    // 400, 413, 500 : ce n'est pas à l'utilisateur de démêler. La publication
    // attend, et sera rejouée.
    return { sorte: 'differe' };
}
