/**
 * Mise en forme des nombres et des dates.
 *
 * Rien n'est délégué à `Intl` : la sortie doit être identique au franc et à la
 * minute près sur le téléphone qui publie et sur le Worker qui rend la page de
 * lecture. `toLocaleString` dépend de la version d'ICU embarquée, ce qui n'est
 * pas la même chose sur un Tecno de 2019 et au bord de Cloudflare.
 */

/**
 * Séparateur de milliers : espace insécable U+00A0. L'espace fine insécable
 * U+202F serait plus juste typographiquement, mais elle manque à beaucoup de
 * polices Android d'entrée de gamme et se rend alors en carré vide.
 */
export const ESPACE_INSECABLE = ' '

const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
] as const

/**
 * Décalage d'Africa/Douala : UTC+1, toute l'année, sans heure d'été.
 *
 * Les dates sont mises en forme dans ce fuseau et pas dans celui de la machine.
 * Sans ça, un document publié à 23 h 30 à Douala porterait la veille sur la page
 * rendue par un Worker qui vit en UTC.
 */
export const DECALAGE_WAT_MS = 60 * 60 * 1000

interface PartsDate {
  readonly jour: number
  readonly mois: number
  readonly annee: number
  readonly heures: number
  readonly minutes: number
}

function partsWAT(d: Date): PartsDate {
  const t = d.getTime()
  if (!Number.isFinite(t)) throw new RangeError('date invalide')
  const wat = new Date(t + DECALAGE_WAT_MS)
  return {
    jour: wat.getUTCDate(),
    mois: wat.getUTCMonth(),
    annee: wat.getUTCFullYear(),
    heures: wat.getUTCHours(),
    minutes: wat.getUTCMinutes(),
  }
}

function nom(mois: number): string {
  const m = MOIS[mois]
  if (m === undefined) throw new RangeError(`mois hors table : ${mois}`)
  return m
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/**
 * Nombre groupé par milliers : `nf(353000)` → `353 000` (espaces insécables).
 * Le montant est arrondi au franc.
 */
export function nf(n: number): string {
  if (!Number.isFinite(n)) throw new RangeError(`nombre non représentable : ${n}`)
  const arrondi = Math.round(n)
  const signe = arrondi < 0 ? '-' : ''
  const chiffres = Math.abs(arrondi).toString()
  let out = ''
  for (let i = 0; i < chiffres.length; i += 1) {
    if (i > 0 && (chiffres.length - i) % 3 === 0) out += ESPACE_INSECABLE
    out += chiffres.charAt(i)
  }
  return signe + out
}

/** `montantF(353000)` → `353 000 F`. */
export function montantF(n: number): string {
  return `${nf(n)}${ESPACE_INSECABLE}F`
}

/** `dateLongue()` → `9 septembre 2026`. */
export function dateLongue(d: Date): string {
  const p = partsWAT(d)
  return `${p.jour} ${nom(p.mois)} ${p.annee}`
}

/**
 * La date longue d'une chaîne ISO, ou `null` si elle n'en est pas une.
 *
 * `dateLongue` refuse une date invalide, et elle a raison : dessiner « Invalid
 * Date » sur un document serait pire. Mais une date que l'utilisateur est en
 * train de saisir n'est pas encore une date, et le rendu ne doit pas se
 * casser en l'attendant. Le rendu choisit alors de ne rien écrire.
 */
export function dateLongueSiValide(iso: string): string | null {
  if (iso.trim() === '') return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return dateLongue(d)
}

/** `dateCourte()` → `09/09/2026`. */
export function dateCourte(d: Date): string {
  const p = partsWAT(d)
  return `${pad2(p.jour)}/${pad2(p.mois + 1)}/${p.annee}`
}

/** `heureCourte()` → `08h45`. */
export function heureCourte(d: Date): string {
  const p = partsWAT(d)
  return `${pad2(p.heures)}h${pad2(p.minutes)}`
}

/**
 * Le jour civil de Douala, `2026-09-09`.
 *
 * Sert de clef de regroupement, pas d'affichage : deux opérations du même
 * après-midi doivent tomber dans le même seau, et un `toISOString()` les
 * séparerait dès que l'heure locale passe minuit UTC — c'est-à-dire à 1 h du
 * matin à Douala.
 */
export function jourWAT(d: Date): string {
  const p = partsWAT(d)
  return `${p.annee}-${pad2(p.mois + 1)}-${pad2(p.jour)}`
}

/** L'horodatage imprimé en pied de carte : `Arrêté le 9 septembre 2026 à 08h45`. */
export function arreteLe(d: Date): string {
  return `Arrêté le ${dateLongue(d)} à ${heureCourte(d)}`
}

/** L'année civile, dans le fuseau de Douala — celle qui numérote les documents. */
export function anneeDe(d: Date): number {
  return partsWAT(d).annee
}

/** Deux initiales, pour la pastille d'un outil : `Njangi Nkolbisson` → `NN`. */
export function initiales(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((mot) => mot.charAt(0))
    .join('')
    .toUpperCase()
}

/**
 * Forme de comparaison : minuscules, sans accent, sans ponctuation.
 * Sert à l'étage 1 du moteur (correspondance de mots-clés, zéro jeton).
 */
export function normaliser(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Minuit du jour civil de Douala qui contient `d`, en millisecondes. */
function minuitWAT(d: Date): number {
  const t = d.getTime()
  if (!Number.isFinite(t)) throw new RangeError('date invalide')
  const wat = new Date(t + DECALAGE_WAT_MS)
  return Date.UTC(wat.getUTCFullYear(), wat.getUTCMonth(), wat.getUTCDate())
}

/**
 * Nombre de jours civils entre deux dates, comptés sur le calendrier de Douala.
 *
 * Compté en jours et non en millisecondes : une facture échue hier est en
 * retard d'un jour, qu'il soit 1 h du matin ou 23 h. Négatif si `fin` précède
 * `debut`.
 */
export function joursEntre(debut: Date, fin: Date): number {
  return Math.round((minuitWAT(fin) - minuitWAT(debut)) / 86_400_000)
}
