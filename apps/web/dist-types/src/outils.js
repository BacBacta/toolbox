/**
 * Un import dynamique par squelette.
 *
 * C'est ce qui tient le budget de 120 Ko : la coquille ne paie pas les outils
 * qu'on n'ouvre pas. Rollup en tire un fragment par entrée, et le service
 * worker les met tous en cache à l'installation — donc le mode avion marche
 * quand même, dès la première visite.
 */
export const CHARGEURS = {
    // Un registre composé par le modèle : même écran, même moteur, sa
    // configuration voyage simplement avec l'outil au lieu d'un squelette.
    compose: () => import('./outils/liste.js'),
    'compose-calcul': () => import('./outils/calc.js'),
    devis: () => import('./outils/devis.js'),
    facture: () => import('./outils/facture.js'),
    // Un seul fragment pour les quatre actes : même cadre, même formulaire, seul
    // le rendu de la page change.
    attestation: () => import('./outils/actes.js'),
    recu: () => import('./outils/actes.js'),
    dette: () => import('./outils/actes.js'),
    motivation: () => import('./outils/actes.js'),
    cv: () => import('./outils/cv.js'),
    ardoise: () => import('./outils/ardoise.js'),
    presence: () => import('./outils/presence.js'),
    njangi: () => import('./outils/njangi.js'),
    // Un seul fragment pour les quatre registres décrits par leurs colonnes, et
    // un pour les deux calculatrices : ils partagent leur écran et leur moteur.
    prix: () => import('./outils/liste.js'),
    caisse: () => import('./outils/liste.js'),
    stock: () => import('./outils/liste.js'),
    clients: () => import('./outils/liste.js'),
    scolarite: () => import('./outils/calc.js'),
    course: () => import('./outils/calc.js'),
};
export function outilDisponible(skeleton) {
    return Object.hasOwn(CHARGEURS, skeleton);
}
