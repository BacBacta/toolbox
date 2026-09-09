/**
 * Numérotation des documents d'affaires.
 *
 * La section 5 du brief l'exige « unique, continue et chronologique » — c'est
 * une des mentions que la DGI contrôle. La forme retenue est celle du
 * prototype : `DV-2026-0118`, soit préfixe, année civile, séquence.
 *
 * Le compteur vit dans la configuration de l'outil et s'incrémente sur le
 * téléphone, hors ligne. Deux appareils du même compte peuvent donc produire le
 * même numéro : c'est au serveur de refuser un numéro déjà publié pour ce
 * compte, et à l'app de renuméroter le brouillon. `trouverAnomalies` sert à
 * détecter le problème des deux côtés.
 */

export interface Numero {
  /** Deux à quatre majuscules. `DV` devis, `FA` facture, `REC` reçu… */
  readonly prefixe: string
  readonly annee: number
  /** Entier strictement positif, remis à 1 à chaque année civile. */
  readonly sequence: number
}

export const FORME_NUMERO = /^([A-Z]{2,4})-(\d{4})-(\d{4,})$/

/** @throws RangeError si le numéro n'est pas représentable. */
export function formatNumero(n: Numero): string {
  if (!/^[A-Z]{2,4}$/.test(n.prefixe)) {
    throw new RangeError(`préfixe invalide : « ${n.prefixe} »`)
  }
  if (!Number.isInteger(n.annee) || n.annee < 2000 || n.annee > 2999) {
    throw new RangeError(`année invalide : ${n.annee}`)
  }
  if (!Number.isInteger(n.sequence) || n.sequence < 1) {
    throw new RangeError(`séquence invalide : ${n.sequence}`)
  }
  return `${n.prefixe}-${n.annee}-${String(n.sequence).padStart(4, '0')}`
}

/** `null` si la chaîne n'est pas un numéro de la maison. */
export function parseNumero(s: string): Numero | null {
  const m = FORME_NUMERO.exec(s.trim().toUpperCase())
  if (m === null) return null
  const [, prefixe, annee, sequence] = m
  if (prefixe === undefined || annee === undefined || sequence === undefined) return null
  const seq = Number(sequence)
  if (seq < 1) return null
  return { prefixe, annee: Number(annee), sequence: seq }
}

/**
 * Le numéro qui suit. La séquence repart à 1 dès que l'année civile change —
 * c'est ce qui rend la numérotation chronologique et lisible à l'œil.
 */
export function numeroSuivant(precedent: Numero | null, annee: number, prefixe: string): Numero {
  if (precedent === null || precedent.annee !== annee || precedent.prefixe !== prefixe) {
    return { prefixe, annee, sequence: 1 }
  }
  return { prefixe, annee, sequence: precedent.sequence + 1 }
}

export type Anomalie =
  | { readonly type: 'illisible'; readonly numero: string }
  | { readonly type: 'doublon'; readonly numero: string }
  | { readonly type: 'trou'; readonly manquants: readonly string[] }

/**
 * Cherche ce qui casse la continuité d'une suite de numéros : illisibles,
 * doublons, et trous dans la séquence d'une même année.
 */
export function trouverAnomalies(numeros: readonly string[]): Anomalie[] {
  const anomalies: Anomalie[] = []
  const parSerie = new Map<string, number[]>()

  for (const brut of numeros) {
    const n = parseNumero(brut)
    if (n === null) {
      anomalies.push({ type: 'illisible', numero: brut })
      continue
    }
    const clef = `${n.prefixe}-${n.annee}`
    const suite = parSerie.get(clef) ?? []
    if (suite.includes(n.sequence)) {
      anomalies.push({ type: 'doublon', numero: formatNumero(n) })
    } else {
      suite.push(n.sequence)
      parSerie.set(clef, suite)
    }
  }

  for (const [clef, suite] of parSerie) {
    const [prefixe, annee] = clef.split('-')
    if (prefixe === undefined || annee === undefined) continue
    const triee = [...suite].sort((a, b) => a - b)
    const manquants: string[] = []
    const premier = triee[0]
    const dernier = triee[triee.length - 1]
    if (premier === undefined || dernier === undefined) continue
    for (let s = premier; s <= dernier; s += 1) {
      if (!triee.includes(s)) {
        manquants.push(formatNumero({ prefixe, annee: Number(annee), sequence: s }))
      }
    }
    if (manquants.length > 0) anomalies.push({ type: 'trou', manquants })
  }

  return anomalies
}
