import { prefixeDe, prochainNumero } from '@a237/engine';
import { createStore, get, set } from 'idb-keyval';
/**
 * Les numéros déjà émis, et pourquoi ils ne se rendent pas.
 *
 * La section 5 du brief exige une numérotation « unique, continue et
 * chronologique » : c'est la mention que la DGI regarde en premier. Le moteur
 * sait déduire le suivant d'une liste ; encore faut-il que quelqu'un tienne
 * cette liste. Personne ne la tenait, et chaque facture neuve repartait donc à
 * `FA-2026-0001`.
 *
 * Le registre est **séparé des outils**, et c'est tout l'intérêt : supprimer
 * une facture ne rend pas son numéro. Sans cette séparation, effacer la
 * dernière facture ferait réattribuer son numéro à la suivante — deux
 * documents différents portant la même référence, dont l'un est peut-être déjà
 * chez un client.
 *
 * C'est aussi ce que la phase 2 enverra au serveur : le contrôle d'unicité par
 * compte a besoin de savoir ce que ce téléphone a déjà émis, y compris hors
 * ligne.
 */
// Une base à elle : `createStore` crée son magasin à la version 1, donc deux
// magasins d'une même base ne peuvent pas coexister (voir `stockage.ts`).
const NUMEROS = createStore('atelier237-numeros', 'numeros');
/** Les numéros émis pour une série, du plus ancien au plus récent. */
export async function numerosEmis(skeleton) {
    return (await get(skeleton, NUMEROS)) ?? [];
}
/**
 * Réserve le prochain numéro d'une série, et l'inscrit au registre.
 *
 * Rend `null` pour un squelette qui ne numérote pas — un carnet de njangi ou
 * une feuille de présence n'ont pas de série à tenir.
 */
export async function reserverNumero(skeleton, maintenant) {
    const prefixe = prefixeDe(skeleton);
    if (prefixe === null)
        return null;
    const emis = await numerosEmis(skeleton);
    const numero = prochainNumero(prefixe, emis, maintenant);
    await set(skeleton, [...emis, numero], NUMEROS);
    return numero;
}
/**
 * Pose sur un état neuf le numéro que l'atelier vient de réserver.
 *
 * Le squelette a posé un numéro de gabarit — il connaît son préfixe et
 * l'année, mais pas ce que le compte a déjà émis. Celui qui compte se réserve
 * ici, et remplace l'autre avant que l'outil ne soit enregistré.
 */
export async function numeroter(skeleton, etat, maintenant) {
    const numero = await reserverNumero(skeleton, maintenant);
    if (numero === null || etat === null || typeof etat !== 'object')
        return etat;
    if (!('numero' in etat))
        return etat;
    return { ...etat, numero };
}
