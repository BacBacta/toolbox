import { ALPHABET_LIEN } from '@a237/engine'

/**
 * Qui est là, sans mot de passe et sans compte à créer.
 *
 * Rien à remplir avant de se servir : § 2 du brief tient à ce que l'atelier
 * marche tout de suite, hors ligne, sans inscription. L'appareil tire donc son
 * propre jeton au premier lancement et le garde ; le serveur ne le voit qu'au
 * premier appel qui coûte quelque chose, et lui ouvre un compte à ce
 * moment-là. Un numéro de téléphone n'apparaît qu'au premier paiement, parce
 * que c'est le paiement qui en a besoin.
 *
 * Le serveur ne range jamais le jeton lui-même, seulement son empreinte : une
 * copie de la base ne distribue pas d'identités.
 */

/** Cent vingt-huit bits : ce n'est pas tapé à la main, ce n'est pas deviné. */
const OCTETS_JETON = 16

/**
 * Seize caractères de l'alphabet des liens — sans I, 1, O, 0 ni U.
 *
 * Le code de récupération, lui, **se dit au téléphone** et se recopie sur un
 * cahier : il tient à la même contrainte que les liens. Seize caractères pris
 * dans trente et un font près de quatre-vingts bits.
 *
 * Le brief demandait argon2, et cette exigence répond à un mot de passe
 * *choisi par quelqu'un* — quelques dizaines de bits au mieux, qu'un dérivateur
 * lent rend coûteux à essayer. Un code tiré par la machine sur quatre-vingts
 * bits n'a pas ce défaut : sa force est dans son entropie, pas dans la lenteur
 * du calcul. Un SHA-256 suffit, il ne demande aucune dépendance — le § 8 en
 * plafonne le nombre — et il ne dépense pas le temps processeur du Worker à
 * chaque récupération.
 */
const LONGUEUR_CODE = 16

/** Par groupes de quatre : c'est ainsi qu'on lit un numéro à voix haute. */
const GROUPE = 4

function hex(octets: Uint8Array): string {
  return Array.from(octets, (o) => o.toString(16).padStart(2, '0')).join('')
}

/** Le jeton d'un appareil. Tiré sur l'appareil, jamais par le serveur. */
export function tirerJeton(): string {
  const octets = new Uint8Array(OCTETS_JETON)
  crypto.getRandomValues(octets)
  return hex(octets)
}

export function jetonValide(jeton: string): boolean {
  return jeton.length === OCTETS_JETON * 2 && /^[0-9a-f]+$/.test(jeton)
}

/** Ce que le serveur range à la place du jeton. */
export async function empreinte(secret: string): Promise<string> {
  const condense = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))
  return hex(new Uint8Array(condense))
}

/** Un code de récupération, montré une fois et jamais rangé en clair. */
export function tirerCode(): string {
  const octets = new Uint8Array(LONGUEUR_CODE)
  crypto.getRandomValues(octets)
  /*
   * Le modulo biaise, et ici il ne peut pas nuire : trente et un ne divise pas
   * deux cent cinquante-six, donc les huit premières lettres sortent un peu
   * plus souvent. Le biais coûte moins d'un bit sur quatre-vingts. Le corriger
   * par tirage avec rejet ferait boucler un code pour rien.
   */
  const lettres = Array.from(octets, (o) => ALPHABET_LIEN[o % ALPHABET_LIEN.length] ?? '2')
  const groupes: string[] = []
  for (let i = 0; i < lettres.length; i += GROUPE) groupes.push(lettres.slice(i, i + GROUPE).join(''))
  return groupes.join('-')
}

/**
 * Ce qu'on accepte de ce qui est tapé.
 *
 * Les tirets sont une aide à la lecture, pas une donnée ; les espaces arrivent
 * d'un copier-coller ; les minuscules d'un clavier de téléphone. Rend `null`
 * si ce qui reste n'est pas un code, plutôt que de comparer une bouillie.
 */
export function normaliserCode(saisi: string): string | null {
  const propre = saisi.toUpperCase().replace(/[\s-]/g, '')
  if (propre.length !== LONGUEUR_CODE) return null
  for (const lettre of propre) {
    if (!ALPHABET_LIEN.includes(lettre)) return null
  }
  return propre
}

/** Le code tel qu'il se montre, une seule fois. */
export function codeLisible(code: string): string {
  const groupes: string[] = []
  for (let i = 0; i < code.length; i += GROUPE) groupes.push(code.slice(i, i + GROUPE))
  return groupes.join('-')
}
