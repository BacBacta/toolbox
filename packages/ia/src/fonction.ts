
/**
 * Le proxy IA (§ 3, « Appeler l'IA »).
 *
 * Il existe pour une seule raison : **aucune clef d'API dans le client, jamais**
 * (invariant § 2.8). La clef est lue ici, dans l'environnement de la fonction,
 * et ne traverse pas la frontière. Le client ne reçoit qu'une configuration
 * déjà validée — jamais de HTML, jamais de code (§ 3, point 5).
 *
 * Il ne connaît pas son hébergeur : ce fichier lit des réglages, et
 * l'adaptateur qui les relie à un `Request` vit ailleurs. C'est ce qui a permis
 * de passer de Vercel à Cloudflare sans toucher à une seule décision.
 *
 * Les réglages arrivent en argument et ne se lisent pas dans
 * `process.env` : un Worker n'a pas de `process`, ses variables arrivent dans
 * un objet passé à chaque requête. Les lire au chargement du module aurait
 * marché sur Vercel et rendu partout `undefined` sur Cloudflare.
 *
 */

/** Ce que l'environnement dit, une fois lu et interprété. */
export interface Reglages {
  readonly clef: string
  /** Poser la clef ne suffit pas : il faut avoir voulu ouvrir. */
  readonly ouverte: boolean
  readonly fournisseur: string
  readonly modele: string
  readonly prixEntree: number
  readonly prixSortie: number
  /** Le taux sert au journal des coûts. Une décision de gestion, pas une constante. */
  readonly tauxFcfa: number
}

/** Ce qu'un hébergeur nous tend : des chaînes, ou rien. */
export type Environnement = Readonly<Record<string, string | undefined>>

export const MODELE_PAR_DEFAUT = 'google/gemini-2.5-flash-lite'

function nombre(brut: string | undefined, defaut: number): number {
  const n = Number(brut)
  return Number.isFinite(n) ? n : defaut
}

export function reglagesDe(env: Environnement): Reglages {
  return {
    clef: env.A237_CLEF_IA ?? '',
    ouverte: env.A237_IA_OUVERTE === '1',
    fournisseur: env.A237_FOURNISSEUR ?? 'openrouter',
    modele: env.A237_MODELE ?? MODELE_PAR_DEFAUT,
    prixEntree: nombre(env.A237_PRIX_ENTREE, 0.1),
    prixSortie: nombre(env.A237_PRIX_SORTIE, 0.4),
    tauxFcfa: nombre(env.A237_TAUX_FCFA, 600),
  }
}
