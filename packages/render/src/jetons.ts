/**
 * La palette du produit.
 *
 * Trois choses vivent ici, et elles ne se confondent pas :
 *
 * - `CLAIR` et `SOMBRE` : l'interface. Elles sont redéclarées en variables CSS
 *   dans `styles/outil.css`, et un test vérifie qu'elles ne divergent pas.
 * - `COULEURS_CARTE` : la carte partagée, dessinée en canvas. Elle reste
 *   **toujours claire**, quel que soit le thème du téléphone : c'est un
 *   document qui part dans WhatsApp et qui sera regardé par d'autres gens, sur
 *   d'autres appareils. Une carte sombre chez l'un et claire chez l'autre ne
 *   serait plus le même document.
 * - Les seuils de contraste, vérifiés par un test plutôt que jugés à l'œil.
 *
 * La cible est un Android d'entrée de gamme tenu en plein soleil par quelqu'un
 * qui compte de l'argent. Chaque couple texte/fond tient le niveau AA.
 */

export interface Palette {
  /** Le fond de la page. */
  readonly fond: string
  /** Les cartes et les panneaux posés sur le fond. */
  readonly surface: string
  /** Une surface qui doit ressortir davantage : entête d'outil, feuille. */
  readonly surfaceHaute: string
  /** Un aplat discret : bandeau, fond de champ inerte. */
  readonly bandeau: string
  /** Les séparations. Décoratives : elles ne portent aucune information. */
  readonly trait: string
  /** La bordure d'un champ ou d'un bouton : elle, porte l'information. */
  readonly traitChamp: string
  /** Le texte courant. */
  readonly encre: string
  /** Le texte secondaire : détails d'une rangée, aides de saisie. */
  readonly encre2: string
  /** Les étiquettes et les surtitres. */
  readonly encre3: string
  readonly accent: string
  readonly accentSombre: string
  /** Le fond d'un badge ou d'un aplat teinté. */
  readonly accentDoux: string
  /** Ce qui s'écrit sur l'accent. */
  readonly surAccent: string
  readonly alerte: string
  readonly alerteDouce: string
}

export const CLAIR: Palette = {
  fond: '#FAFBF7',
  surface: '#FFFFFF',
  surfaceHaute: '#FFFFFF',
  bandeau: '#EDF1E9',
  trait: '#DFE5D9',
  traitChamp: '#8C9689',
  encre: '#121710',
  encre2: '#414B3F',
  encre3: '#5E6A5C',
  accent: '#1B5E43',
  accentSombre: '#144A34',
  accentDoux: '#E2EEE7',
  surAccent: '#FFFFFF',
  alerte: '#9C2717',
  alerteDouce: '#F7E7E4',
}

export const SOMBRE: Palette = {
  fond: '#0E120D',
  surface: '#161B15',
  surfaceHaute: '#1D231B',
  bandeau: '#1A201A',
  trait: '#2A322A',
  traitChamp: '#6B766A',
  encre: '#EDF2EA',
  encre2: '#BAC4B7',
  encre3: '#96A194',
  accent: '#57B183',
  accentSombre: '#46986E',
  accentDoux: '#1B2E24',
  surAccent: '#0E120D',
  alerte: '#F08878',
  alerteDouce: '#2E1A17',
}

/**
 * La carte partagée. Toujours claire : c'est un document qui circule.
 *
 * Reprise du rendu du prototype, réaccordée sur la palette claire pour que
 * l'écran qui produit la carte et la carte elle-même aient l'air d'une même
 * chose.
 */
export const COULEURS_CARTE = {
  fond: '#FBFCF8',
  accent: CLAIR.accent,
  accentSombre: CLAIR.accentSombre,
  encre: '#131A14',
  encre2: '#4A554A',
  encre3: '#5E6A5C',
  trait: '#E1E7DC',
  alerte: CLAIR.alerte,
  bandeau: '#EEF2EA',
  bandeauTrait: '#DCE3D6',
  cercleVide: '#B7C2B4',
  filigrane: '#7A8678',
} as const

/** Les couples texte/fond que le produit emploie vraiment. Vérifiés par un test. */
export const COUPLES_A_VERIFIER = [
  ['encre', 'fond'],
  ['encre', 'surface'],
  ['encre2', 'fond'],
  ['encre2', 'surface'],
  ['encre3', 'fond'],
  ['encre3', 'surface'],
  ['encre3', 'bandeau'],
  ['accent', 'fond'],
  ['accent', 'surface'],
  ['accent', 'accentDoux'],
  ['surAccent', 'accent'],
  ['alerte', 'fond'],
  ['alerte', 'surface'],
  ['alerte', 'alerteDouce'],
] as const satisfies readonly (readonly [keyof Palette, keyof Palette])[]

/** Les bordures qui portent une information, à 3:1 au moins. */
export const BORDURES_A_VERIFIER = [
  ['traitChamp', 'surface'],
  ['traitChamp', 'fond'],
] as const satisfies readonly (readonly [keyof Palette, keyof Palette])[]
