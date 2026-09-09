import type { JsonSchema } from '../types.js'

/**
 * Le moteur de calculatrice : quelques entrées, un résultat.
 *
 * Deux outils du prototype tiennent là-dedans — le reste à payer d'une
 * scolarité, la part de chacun sur une course partagée. Ce sont les plus petits
 * outils du produit, et ce sont peut-être ceux qu'on ouvre le plus souvent :
 * ils doivent s'afficher tout de suite et ne jamais se tromper.
 *
 * La formule est du code écrit à la main dans le squelette ; l'état, lui, n'est
 * qu'un objet de nombres, validé par un schéma dérivé des entrées.
 */

export interface EntreeCalc {
  readonly clef: string
  readonly titre: string
  readonly defaut: number
  readonly unite: 'F' | ''
}

export type Valeurs = Readonly<Record<string, number>>

/**
 * Lit une entrée, toujours nettoyée.
 *
 * Les formules reçoivent ce lecteur plutôt que l'objet brut : elles s'écrivent
 * `val('total') - val('verse')` au lieu de traîner un `?? 0` par accès, et ce
 * `?? 0` était du code défensif qui ne pouvait jamais servir — le moteur
 * remplit chaque entrée déclarée avant d'appeler la formule.
 */
export type LecteurValeurs = (clef: string) => number

export interface ConfigCalc {
  readonly kicker: string
  readonly entrees: readonly EntreeCalc[]
  readonly sortie: {
    readonly libelle: string
    readonly unite: 'F' | ''
    /** La formule. Écrite à la main, jamais produite par un modèle. */
    readonly calcul: (val: LecteurValeurs) => number
    /** Une précision sous le résultat, ou `null` quand il n'y a rien à dire. */
    readonly precision?: (val: LecteurValeurs) => string | null
    /** Part de 0 à 1 pour la barre d'avancement, ou `null`. */
    readonly part?: (val: LecteurValeurs) => number | null
  }
}

export interface EtatCalc {
  readonly nom: string
  readonly valeurs: Valeurs
}

/** La valeur d'une entrée, nettoyée : jamais NaN, jamais négative. */
export function valeurDe(etat: EtatCalc, clef: string): number {
  const v = etat.valeurs[clef]
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0
}

function lecteur(etat: EtatCalc): LecteurValeurs {
  return (clef) => valeurDe(etat, clef)
}

/** Le résultat, arrondi au franc. La formule ne voit que des nombres valides. */
export function resultatCalc(config: ConfigCalc, etat: EtatCalc): number {
  const brut = config.sortie.calcul(lecteur(etat))
  return Number.isFinite(brut) ? Math.round(brut) : 0
}

export function precisionCalc(config: ConfigCalc, etat: EtatCalc): string | null {
  return config.sortie.precision?.(lecteur(etat)) ?? null
}

export function partCalc(config: ConfigCalc, etat: EtatCalc): number | null {
  const part = config.sortie.part?.(lecteur(etat))
  if (part === undefined || part === null || !Number.isFinite(part)) return null
  return Math.max(0, Math.min(1, part))
}

/**
 * Change une entrée.
 * @throws RangeError sur une valeur négative ou non finie — une calculatrice
 *   qui accepte n'importe quoi rend n'importe quoi.
 */
export function changerValeur(etat: EtatCalc, clef: string, valeur: number): EtatCalc {
  if (!Number.isFinite(valeur) || valeur < 0) {
    throw new RangeError(`valeur invalide pour « ${clef} » : ${valeur}`)
  }
  return { ...etat, valeurs: { ...etat.valeurs, [clef]: valeur } }
}

/** L'état de départ : chaque entrée à sa valeur par défaut. */
export function valeursParDefaut(config: ConfigCalc): Valeurs {
  const valeurs: Record<string, number> = {}
  for (const e of config.entrees) valeurs[e.clef] = e.defaut
  return valeurs
}

export function schemaCalc(config: ConfigCalc, titreNom: string): JsonSchema {
  const proprietes: Record<string, JsonSchema> = {}
  for (const e of config.entrees) {
    proprietes[e.clef] = {
      type: 'number',
      minimum: 0,
      maximum: 1_000_000_000,
      title: e.unite === 'F' ? `${e.titre} (F CFA)` : e.titre,
    }
  }
  return {
    type: 'object',
    additionalProperties: false,
    required: ['nom', 'valeurs'],
    properties: {
      nom: { type: 'string', minLength: 1, maxLength: 60, title: titreNom },
      valeurs: {
        type: 'object',
        additionalProperties: false,
        required: config.entrees.map((e) => e.clef),
        properties: proprietes,
        title: 'Valeurs',
      },
    },
  }
}
