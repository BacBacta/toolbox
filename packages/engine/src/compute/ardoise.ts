import { joursEntre, normaliser } from '../format.js'
import type { Encre, XAF } from '../types.js'

/**
 * L'ardoise : ce que les clients doivent.
 *
 * C'est le cahier le plus courant du commerce camerounais, et le plus délicat.
 * Il porte des noms, des sommes et des retards, et la tentation de le publier
 * pour faire pression est forte. Le brief l'interdit (§ 2.5) : une ardoise
 * publiée avec les noms, c'est de l'humiliation, et on perd le client en même
 * temps que l'argent. Ce qui part dans WhatsApp, ce sont les relances
 * individuelles.
 *
 * L'ancienneté d'une dette se **calcule**, elle ne se saisit pas. Le prototype
 * gardait un nombre de jours dans l'état ; il n'aurait jamais bougé, et une
 * dette de trois mois se serait affichée « depuis 4 jours » pour toujours. On
 * garde la date d'ouverture, et le nombre de jours se déduit de l'instant que
 * l'appelant fournit — jamais d'une horloge lue par le moteur.
 */

export interface DetteClient {
  readonly client: string
  readonly montant: XAF
  /** Date d'ouverture de la dette, ISO 8601. */
  readonly depuis: string
  /** Numéro pour la relance. Absent quand on ne l'a pas. */
  readonly tel?: string
  readonly regle: boolean
}

export interface EtatArdoise {
  readonly nom: string
  readonly encre: Encre
  /** Nom de la boutique, tel qu'il apparaît sur la carte. */
  readonly boutique: string
  readonly dettes: readonly DetteClient[]
}

/** Au-delà, une dette n'est plus un délai : c'est un retard. */
export const JOURS_RETARD = 30

/** Bornes des tranches d'ancienneté, en jours. */
export const TRANCHES = [15, JOURS_RETARD] as const

export interface DetteVue extends DetteClient {
  /** Rang de la dette dans l'état, pour la retrouver après un tri. */
  readonly index: number
  /** Jours écoulés depuis l'ouverture. Zéro pour une dette réglée. */
  readonly jours: number
  readonly enRetard: boolean
}

/** Le nombre de jours qu'une dette a passés ouverte. */
export function joursOuverts(dette: DetteClient, maintenant: Date): number {
  if (dette.regle) return 0
  const debut = new Date(dette.depuis)
  if (Number.isNaN(debut.getTime())) return 0
  return Math.max(0, joursEntre(debut, maintenant))
}

export function vueDettes(etat: EtatArdoise, maintenant: Date): DetteVue[] {
  return etat.dettes.map((d, index) => {
    const jours = joursOuverts(d, maintenant)
    return { ...d, index, jours, enRetard: !d.regle && jours > JOURS_RETARD }
  })
}

/**
 * L'ordre de l'écran : ce qui est dû d'abord, le plus vieux en tête.
 *
 * Une ardoise se lit pour savoir qui relancer. Trier par nom obligerait à
 * parcourir toute la liste pour trouver les trois lignes qui comptent.
 */
export function ordonner(vues: readonly DetteVue[]): DetteVue[] {
  return [...vues].sort((a, b) => {
    if (a.regle !== b.regle) return a.regle ? 1 : -1
    if (a.jours !== b.jours) return b.jours - a.jours
    return b.montant - a.montant
  })
}

export function chercher(vues: readonly DetteVue[], question: string): DetteVue[] {
  const q = normaliser(question)
  if (q === '') return [...vues]
  return vues.filter((v) => normaliser(v.client).includes(q))
}

export interface TotauxArdoise {
  /** Ce qui reste dû. */
  readonly encours: XAF
  /** Ce qui a été recouvré. */
  readonly recouvre: XAF
  /** Nombre de clients qui doivent encore. */
  readonly ouverts: number
  /** Parmi eux, ceux au-delà du délai. */
  readonly enRetard: number
  /** Part recouvrée du total ouvert un jour, 0 à 1. Vaut 0 sans dette. */
  readonly part: number
}

export function totaux(vues: readonly DetteVue[]): TotauxArdoise {
  const ouvertes = vues.filter((v) => !v.regle)
  const encours = ouvertes.reduce((a, v) => a + v.montant, 0)
  const recouvre = vues.filter((v) => v.regle).reduce((a, v) => a + v.montant, 0)
  const total = encours + recouvre
  return {
    encours,
    recouvre,
    ouverts: ouvertes.length,
    enRetard: ouvertes.filter((v) => v.enRetard).length,
    part: total === 0 ? 0 : recouvre / total,
  }
}

export interface Tranche {
  readonly libelle: string
  readonly montant: XAF
  readonly clients: number
}

/**
 * L'encours par ancienneté.
 *
 * Trois tranches, parce que trois suffisent à décider : ce qui vient de
 * partir, ce qui commence à traîner, ce qu'il faut aller chercher.
 */
export function vieillissement(vues: readonly DetteVue[]): Tranche[] {
  const ouvertes = vues.filter((v) => !v.regle)
  const dans = (min: number, max: number): DetteVue[] =>
    ouvertes.filter((v) => v.jours >= min && v.jours <= max)
  const tranche = (libelle: string, lignes: readonly DetteVue[]): Tranche => ({
    libelle,
    montant: lignes.reduce((a, v) => a + v.montant, 0),
    clients: lignes.length,
  })
  return [
    tranche('0–15 j', dans(0, TRANCHES[0])),
    tranche('16–30 j', dans(TRANCHES[0] + 1, TRANCHES[1])),
    tranche('+30 j', ouvertes.filter((v) => v.jours > TRANCHES[1])),
  ]
}

// ─────────────────────────────── transitions ───────────────────────────────

/**
 * Marque une dette réglée, ou la rouvre.
 *
 * Rouvrir remet le compteur d'ancienneté à l'instant où on rouvre : une dette
 * qu'on a soldée puis rouverte n'a pas traîné entre-temps, et lui rendre ses
 * quatre-vingts jours ferait mentir la tranche « +30 j ».
 */
export function basculerReglee(
  etat: EtatArdoise,
  index: number,
  maintenant: Date,
): EtatArdoise {
  const d = etat.dettes[index]
  if (d === undefined) return etat
  const rouvre = d.regle
  return {
    ...etat,
    dettes: etat.dettes.map((x, i) =>
      i === index
        ? { ...x, regle: !rouvre, ...(rouvre ? { depuis: maintenant.toISOString() } : {}) }
        : x,
    ),
  }
}

export const MAX_DETTES = 200

export function ajouterDette(
  etat: EtatArdoise,
  client: string,
  montant: XAF,
  maintenant: Date,
  tel?: string,
): EtatArdoise {
  const nom = client.trim()
  if (nom === '' || etat.dettes.length >= MAX_DETTES) return etat
  const numero = (tel ?? '').trim()
  return {
    ...etat,
    dettes: [
      ...etat.dettes,
      {
        client: nom,
        montant: Math.max(0, Math.round(montant)),
        depuis: maintenant.toISOString(),
        regle: false,
        ...(numero === '' ? {} : { tel: numero }),
      },
    ],
  }
}

export function retirerDette(etat: EtatArdoise, index: number): EtatArdoise {
  return { ...etat, dettes: etat.dettes.filter((_, i) => i !== index) }
}
