import { estNiuBienForme, estRccmBienForme } from './identifiants.js'

/**
 * Mentions obligatoires des documents d'affaires camerounais (BRIEF.md § 5).
 *
 * Le NIU est la mention la plus surveillée par la DGI : sans lui l'entreprise
 * n'existe pas fiscalement et le client B2B ne peut pas déduire. En B2B, le NIU
 * du client doit figurer lui aussi.
 */

/** L'entreprise qui émet le document. */
export interface Emetteur {
  readonly nom: string
  /** Forme juridique. Ex. « Ets — Établissement individuel ». */
  readonly forme: string
  readonly activite: string
  readonly adresse: string
  readonly tel: string
  readonly mail: string
  readonly rccm: string
  readonly niu: string
  /** Centre des impôts de rattachement. Ex. « CDI Douala 3ᵉ ». */
  readonly centre: string
}

/**
 * Le destinataire. `estEntreprise` déclenche l'exigence de son NIU.
 *
 * Les champs inconnus sont des chaînes vides, jamais `null` : l'état d'un outil
 * fait l'aller-retour par JSON et est validé par un schéma volontairement
 * minuscule, où ajouter le type `null` coûterait plus qu'il ne rapporte.
 */
export interface Client {
  readonly nom: string
  readonly niu: string
  readonly estEntreprise: boolean
  /** Numéro pour la relance. Absent quand on ne l'a pas. */
  readonly tel?: string
}

export type Gravite = 'bloquant' | 'avertissement'

export interface Manquement {
  readonly champ: string
  readonly libelle: string
  readonly gravite: Gravite
}

function vide(s: string | null | undefined): boolean {
  return s === null || s === undefined || s.trim() === ''
}

/**
 * Ce qui manque au document pour être présentable à un contrôle.
 *
 * `bloquant` : le document ne devrait pas être émis en l'état.
 * `avertissement` : la mention est là mais mal formée — on le signale sans
 * bloquer, la forme exacte des identifiants n'étant pas vérifiée à la source.
 */
export function mentionsManquantes(emetteur: Emetteur, client?: Client): Manquement[] {
  const m: Manquement[] = []

  if (vide(emetteur.niu)) {
    m.push({ champ: 'emetteur.niu', libelle: 'NIU de l’entreprise', gravite: 'bloquant' })
  } else if (!estNiuBienForme(emetteur.niu)) {
    m.push({ champ: 'emetteur.niu', libelle: 'NIU de l’entreprise mal formé', gravite: 'avertissement' })
  }

  if (vide(emetteur.rccm)) {
    m.push({ champ: 'emetteur.rccm', libelle: 'numéro RCCM', gravite: 'bloquant' })
  } else if (!estRccmBienForme(emetteur.rccm)) {
    m.push({ champ: 'emetteur.rccm', libelle: 'numéro RCCM mal formé', gravite: 'avertissement' })
  }

  const obligatoires: readonly (readonly [keyof Emetteur, string])[] = [
    ['nom', 'raison sociale'],
    ['forme', 'forme juridique'],
    ['adresse', 'adresse'],
    ['centre', 'centre des impôts'],
  ]
  for (const [champ, libelle] of obligatoires) {
    if (vide(emetteur[champ])) {
      m.push({ champ: `emetteur.${champ}`, libelle, gravite: 'bloquant' })
    }
  }

  if (client !== undefined) {
    if (vide(client.nom)) {
      m.push({ champ: 'client.nom', libelle: 'nom du client', gravite: 'bloquant' })
    }
    if (client.estEntreprise) {
      if (vide(client.niu)) {
        m.push({ champ: 'client.niu', libelle: 'NIU du client (obligatoire en B2B)', gravite: 'bloquant' })
      } else if (!estNiuBienForme(client.niu)) {
        m.push({ champ: 'client.niu', libelle: 'NIU du client mal formé', gravite: 'avertissement' })
      }
    }
  }

  return m
}

/** Vrai si rien ne bloque l'émission du document. */
export function peutEtreEmis(emetteur: Emetteur, client?: Client): boolean {
  return !mentionsManquantes(emetteur, client).some((x) => x.gravite === 'bloquant')
}

/**
 * Le pied de page légal, tel qu'il s'imprime sous le document.
 *
 * Les mentions absentes sont sautées plutôt que d'imprimer une étiquette
 * orpheline : sur un document qu'on vient d'ouvrir, « RCCM  · NIU  · » ne
 * renseigne personne et donne l'air d'un bug. Ce qui manque est signalé par
 * `mentionsManquantes`, à l'écran, pas sur le papier.
 */
export function piedLegal(e: Emetteur): string {
  return [
    [e.nom, e.forme].filter((x) => !vide(x)).join(' — '),
    vide(e.rccm) ? null : `RCCM ${e.rccm}`,
    vide(e.niu) ? null : `NIU ${e.niu}`,
    e.adresse,
  ]
    .filter((x): x is string => x !== null && !vide(x))
    .join(' · ')
}
