/**
 * La palette du produit, en un seul endroit.
 *
 * Ces valeurs sont reprises du rendu de carte du prototype
 * (`reference/atelier-prototype.html:1186`) pour que l'écran du trésorier, la
 * carte partagée dans WhatsApp et la page de lecture aient l'air d'une même
 * chose. Le canvas les lit ici ; `styles/outil.css` les redéclare en variables
 * CSS, et un test vérifie que les deux ne divergent pas.
 *
 * Le prototype allait les chercher avec `getComputedStyle` au moment de
 * dessiner : une lecture du DOM, impossible à tester et fragile hors écran.
 */
export const COULEURS = {
  accent: '#1B5E43',
  accentSombre: '#164E38',
  encre: '#131A14',
  encre2: '#4A554A',
  encre3: '#7D887C',
  trait: '#E1E7DC',
  fond: '#FBFCF8',
  alerte: '#A32A1D',
  bandeau: '#EEF2EA',
  bandeauTrait: '#DCE3D6',
} as const

export type NomCouleur = keyof typeof COULEURS

/**
 * Deux teintes que seul le canvas emploie : le cercle d'une case non cochée et
 * le filigrane « ATELIER 237 » du pied de carte. Elles ne sont pas dans
 * `COULEURS` parce qu'aucune feuille de style ne les déclare, et que le test de
 * divergence exige une correspondance exacte des deux côtés.
 */
export const COULEURS_CARTE = {
  cercleVide: '#C3CCBF',
  filigrane: '#A9B5A6',
} as const
