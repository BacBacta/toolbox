import type { JsonSchema, XAF } from '../types.js'

/**
 * Le moteur de liste : un registre décrit par ses colonnes, pas par du code.
 *
 * Quatre squelettes du prototype ne sont rien d'autre qu'un tableau de lignes
 * avec des colonnes différentes — livre de caisse, inventaire, annuaire de
 * clients, liste de prix. Écrire quatre écrans, ce serait quatre fois le même
 * bogue à corriger. Ici la configuration décrit les colonnes, et **le schéma
 * de l'état s'en déduit** : c'est la thèse du brief appliquée jusqu'au bout.
 */

export type TypeColonne = 'texte' | 'montant' | 'nombre' | 'bascule'

export interface Colonne {
  readonly clef: string
  readonly titre: string
  readonly type: TypeColonne
}

/** Comment totaliser la liste, quand ça a un sens. */
export type TotalListe =
  | { readonly type: 'somme'; readonly clef: string; readonly libelle: string; readonly unite: 'F' | '' }
  | {
      readonly type: 'difference'
      readonly plus: string
      readonly moins: string
      readonly libelle: string
    }

export interface ConfigListe {
  /** Le sur-titre de la carte partagée. En capitales. */
  readonly kicker: string
  readonly colonnes: readonly Colonne[]
  readonly total?: TotalListe
  /** Signale une ligne dont une valeur passe sous un seuil. */
  readonly alerte?: { readonly clef: string; readonly seuil: number; readonly libelle: string }
  readonly libelleVide: string
  readonly libelleAjout: string
  /** Ce qu'on affiche à la place des relances : une liste ne se relance pas. */
  readonly relancesVides: string
  /**
   * Avertissement affiché avant de partager. Texte simple, jamais du balisage.
   * L'ardoise s'en servira : publier des noms et des montants dans un groupe,
   * c'est de l'humiliation, et on perd le client avec l'argent (§ 2.5).
   */
  readonly avertissement?: string
}

export type ValeurCellule = string | number | boolean
export type LigneListe = Readonly<Record<string, ValeurCellule>>

export interface EtatListe {
  readonly nom: string
  readonly lignes: readonly LigneListe[]
}

// ─────────────────────────── lecture d'une ligne ───────────────────────────

export function texteDe(ligne: LigneListe, clef: string): string {
  const v = ligne[clef]
  return typeof v === 'string' ? v : ''
}

export function nombreDe(ligne: LigneListe, clef: string): number {
  const v = ligne[clef]
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

export function booleenDe(ligne: LigneListe, clef: string): boolean {
  return ligne[clef] === true
}

/** La colonne d'identité : la première, celle qui nomme la ligne. */
export function colonneIdentite(config: ConfigListe): Colonne {
  const premiere = config.colonnes[0]
  if (premiere === undefined) throw new RangeError('liste sans colonne')
  return premiere
}

/** La colonne bascule, s'il y en a une. Une seule par liste. */
export function colonneBascule(config: ConfigListe): Colonne | null {
  return config.colonnes.find((c) => c.type === 'bascule') ?? null
}

/** Les colonnes affichées à droite du nom : tout sauf l'identité et la bascule. */
export function colonnesSecondaires(config: ConfigListe): readonly Colonne[] {
  return config.colonnes.slice(1).filter((c) => c.type !== 'bascule')
}

// ─────────────────────────────── calculs ───────────────────────────────

/** Le total de la liste, ou `null` quand la configuration n'en prévoit pas. */
export function totalListe(config: ConfigListe, etat: EtatListe): XAF | null {
  const total = config.total
  if (total === undefined) return null
  if (total.type === 'somme') {
    return etat.lignes.reduce((a, l) => a + nombreDe(l, total.clef), 0)
  }
  return etat.lignes.reduce(
    (a, l) => a + nombreDe(l, total.plus) - nombreDe(l, total.moins),
    0,
  )
}

/** Les index des lignes sous le seuil d'alerte. */
export function lignesEnAlerte(config: ConfigListe, etat: EtatListe): readonly number[] {
  const alerte = config.alerte
  if (alerte === undefined) return []
  return etat.lignes
    .map((l, i) => (nombreDe(l, alerte.clef) <= alerte.seuil ? i : -1))
    .filter((i) => i >= 0)
}

/** Combien de lignes sont basculées, sur combien. `null` sans colonne bascule. */
export function comptageBascule(
  config: ConfigListe,
  etat: EtatListe,
): { readonly oui: number; readonly total: number } | null {
  const bascule = colonneBascule(config)
  if (bascule === null) return null
  return {
    oui: etat.lignes.filter((l) => booleenDe(l, bascule.clef)).length,
    total: etat.lignes.length,
  }
}

// ───────────────────────── transitions, toutes pures ─────────────────────────

/** Une ligne neuve, conforme aux colonnes : chaque type a sa valeur vide. */
export function ligneNeuve(config: ConfigListe): LigneListe {
  const ligne: Record<string, ValeurCellule> = {}
  for (const c of config.colonnes) {
    ligne[c.clef] = c.type === 'texte' ? '' : c.type === 'bascule' ? false : 0
  }
  return ligne
}

/**
 * Ajoute une ligne.
 * @throws RangeError si la ligne ne porte aucune valeur — une ligne vide dans
 *   un registre, c'est du bruit que personne ne relira.
 */
export function ajouterLigne(config: ConfigListe, etat: EtatListe, ligne: LigneListe): EtatListe {
  const remplie = config.colonnes.some((c) => {
    const v = ligne[c.clef]
    return c.type === 'texte' ? typeof v === 'string' && v.trim() !== '' : v !== 0 && v !== false
  })
  if (!remplie) throw new RangeError('ligne vide')
  return { ...etat, lignes: [...etat.lignes, ligne] }
}

export function retirerLigne(etat: EtatListe, index: number): EtatListe {
  if (etat.lignes[index] === undefined) throw new RangeError(`aucune ligne à l'index ${index}`)
  return { ...etat, lignes: etat.lignes.filter((_, i) => i !== index) }
}

export function basculerLigne(config: ConfigListe, etat: EtatListe, index: number): EtatListe {
  const bascule = colonneBascule(config)
  if (bascule === null) throw new RangeError('cette liste n’a pas de colonne à basculer')
  const cible = etat.lignes[index]
  if (cible === undefined) throw new RangeError(`aucune ligne à l'index ${index}`)
  return {
    ...etat,
    lignes: etat.lignes.map((l, i) =>
      i === index ? { ...l, [bascule.clef]: !booleenDe(l, bascule.clef) } : l,
    ),
  }
}

// ──────────────────────── le schéma se déduit des colonnes ────────────────────

const SCHEMA_PAR_TYPE: Readonly<Record<TypeColonne, (titre: string) => JsonSchema>> = {
  texte: (titre) => ({ type: 'string', maxLength: 120, title: titre }),
  montant: (titre) => ({ type: 'integer', minimum: 0, maximum: 1_000_000_000, title: titre }),
  nombre: (titre) => ({ type: 'number', minimum: 0, maximum: 1_000_000, title: titre }),
  bascule: (titre) => ({ type: 'boolean', title: titre }),
}

/**
 * Le schéma de l'état, dérivé des colonnes.
 *
 * C'est ce qui fait qu'ajouter une colonne à un registre ne demande **aucune**
 * autre modification : le schéma suit, la validation suit, et le formulaire
 * d'édition suit — il se dresse déjà à partir du schéma.
 */
export function schemaListe(config: ConfigListe, titreNom: string): JsonSchema {
  const proprietes: Record<string, JsonSchema> = {}
  for (const c of config.colonnes) {
    proprietes[c.clef] = SCHEMA_PAR_TYPE[c.type](c.titre)
  }
  return {
    type: 'object',
    additionalProperties: false,
    required: ['nom', 'lignes'],
    properties: {
      nom: { type: 'string', minLength: 1, maxLength: 60, title: titreNom },
      lignes: {
        type: 'array',
        maxItems: 500,
        title: 'Lignes',
        items: {
          type: 'object',
          additionalProperties: false,
          required: config.colonnes.map((c) => c.clef),
          properties: proprietes,
        },
      },
    },
  }
}
