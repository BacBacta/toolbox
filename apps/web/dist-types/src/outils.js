/**
 * Un import dynamique par squelette.
 *
 * C'est ce qui tient le budget de 120 Ko : la coquille ne paie pas les outils
 * qu'on n'ouvre pas. Rollup en tire un fragment par entrée, et le service
 * worker les met tous en cache à l'installation — donc le mode avion marche
 * quand même, dès la première visite.
 */
export const CHARGEURS = {
    devis: () => import('./outils/devis.js'),
    facture: () => import('./outils/facture.js'),
    njangi: () => import('./outils/njangi.js'),
};
export function outilDisponible(skeleton) {
    return Object.hasOwn(CHARGEURS, skeleton);
}
