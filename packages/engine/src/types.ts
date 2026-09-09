/**
 * Les types du moteur.
 *
 * Ce paquet ne connaît ni le DOM, ni le réseau, ni l'horloge. Tout ce dont un
 * calcul a besoin lui est passé en argument — y compris la date, sans quoi les
 * tests ne seraient pas déterministes et la page de lecture rendue au bord
 * n'afficherait pas la même chose que le téléphone qui a publié.
 */

/** Montant en francs CFA. Toujours un entier : le XAF n'a pas de subdivision. */
export type XAF = number

export type SkeletonId = string

export type SkeletonGroup = 'documents' | 'registres' | 'calculs'

/** Quel moteur de rendu prend le relais. Écrits à la main, jamais générés. */
export type EngineKind = 'doc' | 'registre' | 'liste' | 'calc'

// ─────────────────────────────── documents ───────────────────────────────

export interface Ligne {
  readonly designation: string
  readonly quantite: number
  readonly prixUnitaire: XAF
}

export interface LigneCalculee extends Ligne {
  readonly montantHT: XAF
  readonly tva: XAF
  readonly montantTTC: XAF
}

export interface Totaux {
  readonly lignes: readonly LigneCalculee[]
  readonly totalHT: XAF
  readonly totalTVA: XAF
  readonly totalTTC: XAF
}

// ───────────────────────────── carte partagée ─────────────────────────────

/**
 * Une entrée de la liste dessinée sur la carte : un membre, un client, un
 * article. `ok` coche, `warn` alerte, `val` est la colonne de droite.
 */
export interface CardItem {
  readonly n: string
  readonly ok: boolean
  readonly warn: boolean
  readonly val: string | null
}

/**
 * La spécification d'une carte partagée. Structure unique pour tous les outils —
 * elle est déjà uniforme dans le prototype, on la reprend telle quelle. C'est
 * `packages/render/card.ts` qui la dessine en canvas sur le téléphone du
 * propriétaire, jamais le serveur.
 */
export interface CardSpec {
  readonly kicker: string
  readonly title: string
  readonly sub: string
  readonly tag: string | null
  readonly bigLabel: string
  readonly big: string
  /** Barre de progression, 0 à 1, ou `null` quand elle n'a pas de sens. */
  readonly pct: number | null
  readonly subline: string
  readonly listTitle: string
  readonly items: readonly CardItem[]
  readonly link: string
  readonly stamp: string
}

/** Une relance individuelle. Elle part du pouce du propriétaire, via `wa.me`. */
export interface Relance {
  readonly nom: string
  /** Numéro au format local, tel que saisi. Le lien `wa.me` est bâti au rendu. */
  readonly tel: string
  readonly message: string
}

/** Tout ce que la feuille de partage a besoin de savoir. */
export interface ShareSpec {
  readonly title: string
  /** Description de l'aperçu de discussion. */
  readonly desc: string
  /** Nom de fichier de la carte PNG, sans extension. */
  readonly name: string
  /** Le résumé à coller dans une discussion. */
  readonly txt: string
  /** Variante pour une liste de diffusion, quand elle diffère du résumé. */
  readonly broad: string | null
  /**
   * Avertissement à afficher au propriétaire avant de partager. Texte simple,
   * jamais du balisage : l'invariant § 2.1 interdit d'injecter du HTML.
   */
  readonly warn: string | null
  readonly card: CardSpec
  readonly relances: readonly Relance[]
  /** Ce qu'on affiche quand il n'y a personne à relancer. */
  readonly relancesVides: string
}

/**
 * Ce que l'appelant fournit au moteur pour bâtir une carte : le lien public et
 * l'instant de l'arrêté. Passés en argument, jamais lus dans l'environnement.
 */
export interface RenderContext {
  readonly lien: string
  readonly maintenant: Date
}

// ──────────────────────────────── squelette ────────────────────────────────

/** Fonctions de calcul propres à un squelette, exposées au rendu et aux tests. */
export type ComputeMap = Readonly<Record<string, (...args: never[]) => unknown>>

/**
 * Un squelette : la seule chose que le produit sait fabriquer.
 *
 * L'IA ne produit jamais autre chose qu'un objet conforme à `schema`. Le rendu
 * est fait par le moteur nommé dans `engine`, écrit à la main, testé.
 */
export interface Skeleton<E = unknown, C extends ComputeMap = ComputeMap> {
  readonly id: SkeletonId
  readonly group: SkeletonGroup
  readonly title: string
  /** Mots-clés de l'étage 1 : correspondance directe, zéro jeton. */
  readonly keywords: readonly string[]
  readonly engine: EngineKind
  /** JSON Schema — la seule chose que l'IA a le droit de remplir. */
  readonly schema: JsonSchema
  /** État par défaut, conforme au schéma. Vérifié par un test. */
  readonly defaults: E
  readonly compute: C
  readonly card: (etat: E, ctx: RenderContext) => CardSpec
  readonly share: (etat: E, ctx: RenderContext) => ShareSpec
}

// ─────────────────────────────── JSON Schema ───────────────────────────────

/**
 * Le sous-ensemble de JSON Schema que le produit utilise. Volontairement petit :
 * il est validé par un validateur écrit à la main d'une centaine de lignes
 * (`valider.ts`), ce qui évite d'embarquer une bibliothèque dans un budget de
 * 120 Ko et rend la surface de la sortie du modèle facile à raisonner.
 */
export type JsonSchema =
  | { readonly type: 'string'; readonly enum?: readonly string[]; readonly minLength?: number; readonly maxLength?: number; readonly description?: string }
  | { readonly type: 'number'; readonly entier?: boolean; readonly minimum?: number; readonly maximum?: number; readonly description?: string }
  | { readonly type: 'boolean'; readonly description?: string }
  | { readonly type: 'array'; readonly items: JsonSchema; readonly minItems?: number; readonly maxItems?: number; readonly description?: string }
  | {
      readonly type: 'object'
      readonly properties: Readonly<Record<string, JsonSchema>>
      readonly required?: readonly string[]
      readonly additionalProperties?: false
      readonly description?: string
    }

/** Une erreur de validation, désignée par son chemin dans l'objet. */
export interface ErreurValidation {
  readonly chemin: string
  readonly message: string
}
