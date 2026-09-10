import { createStore, get, set } from 'idb-keyval'
import { entetesDAppareil } from './appareil.js'

/**
 * Ce que l'application sait de son compte.
 *
 * Rien ici n'est nécessaire pour se servir de l'atelier : les outils
 * s'ouvrent, se remplissent et se partagent sans jamais appeler ces
 * fonctions. Elles ne servent qu'à ce qui coûte — composer avec le modèle — et
 * l'écran ne les appelle donc pas au démarrage.
 *
 * Chaque réponse est aussi une occasion de dire ce qu'il reste : le solde
 * revient avec ce qu'on demandait, sans aller-retour de plus.
 *
 * Le dernier état connu est gardé sur l'appareil, et c'est lui que l'écran
 * montre. Interroger le serveur au démarrage ferait une requête réseau à
 * chaque lancement, pour une ligne dont la plupart des gens n'ont pas besoin,
 * dans une application qui doit s'ouvrir en mode avion (§ 2.7). Il se
 * rafraîchit tout seul : la seule requête qui change le solde est aussi celle
 * qui le rapporte.
 */

export type Plan = 'essai' | 'atelier'

export interface EtatCompte {
  readonly plan: Plan
  readonly credits: number
  /** Fin de l'abonnement, en ms. `null` en essai. */
  readonly expire: number | null
  readonly aUnCode: boolean
}

export type Issue<T> =
  | { readonly sorte: 'ok'; readonly valeur: T }
  /** Hors ligne, ou serveur muet. Ce n'est pas une panne du compte. */
  | { readonly sorte: 'differe' }
  | { readonly sorte: 'refuse'; readonly pourquoi: string }

async function appeler<T>(chemin: string, options: RequestInit = {}): Promise<Issue<T>> {
  let reponse: Response
  try {
    reponse = await fetch(chemin, {
      ...options,
      headers: { 'content-type': 'application/json', ...(await entetesDAppareil()), ...options.headers },
    })
  } catch {
    return { sorte: 'differe' }
  }

  const corps = (await reponse.json().catch(() => null)) as Record<string, unknown> | null
  if (reponse.ok) return { sorte: 'ok', valeur: corps as T }

  // 503 est le seul refus qui se réessaie : le serveur n'est pas branché, ce
  // n'est ni la faute ni l'affaire de qui regarde.
  if (reponse.status === 503) return { sorte: 'differe' }

  const pourquoi = typeof corps?.pourquoi === 'string' ? corps.pourquoi : ''
  const erreur = typeof corps?.erreur === 'string' ? corps.erreur : 'refus'
  return { sorte: 'refuse', pourquoi: pourquoi === '' ? erreur : pourquoi }
}

export function lireCompte(): Promise<Issue<EtatCompte>> {
  return appeler<EtatCompte>('/api/compte')
}

/** Un code neuf annule le précédent : c'est ce qu'on veut si on l'a laissé traîner. */
export function demanderCode(): Promise<Issue<{ code: string; pourquoi: string }>> {
  return appeler('/api/compte/code', { method: 'POST' })
}

export function reprendreAvecCode(code: string): Promise<Issue<EtatCompte>> {
  return appeler<EtatCompte>('/api/compte/reprendre', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

export interface Amorce {
  readonly id: string
  readonly montantXaf: number
  readonly consigne: string
}

export function demarrerPaiement(telephone: string): Promise<Issue<Amorce>> {
  return appeler<Amorce>('/api/pay/demarrer', {
    method: 'POST',
    body: JSON.stringify({ telephone }),
  })
}

export interface Suivi {
  readonly etat: 'attente' | 'reussi' | 'echoue'
  readonly plan: Plan
  readonly credits: number
}

export function suivrePaiement(id: string): Promise<Issue<Suivi>> {
  return appeler<Suivi>(`/api/pay/${id}`)
}


/*
 * Le dernier état connu, gardé à part.
 *
 * Un magasin qui n'est pas celui des outils : effacer ses outils ne doit pas
 * effacer ce qu'on sait de son abonnement.
 */
const COMPTE = createStore('atelier237-compte', 'compte')
const CLEF = 'etat'

export async function dernierEtatConnu(): Promise<EtatCompte | null> {
  return (await get<EtatCompte>(CLEF, COMPTE)) ?? null
}

export async function retenirEtat(etat: EtatCompte): Promise<void> {
  await set(CLEF, etat, COMPTE)
}

/**
 * Ce qu'une réponse du modèle apprend au passage.
 *
 * Le proxy renvoie le solde avec la composition : le compte se tient à jour
 * sans qu'on l'interroge, et sans coûter un aller-retour de plus.
 */
export async function noterApresComposition(plan: unknown, credits: unknown): Promise<void> {
  if ((plan !== 'essai' && plan !== 'atelier') || typeof credits !== 'number') return
  const connu = await dernierEtatConnu()
  await retenirEtat({
    plan,
    credits,
    expire: connu?.expire ?? null,
    aUnCode: connu?.aUnCode ?? false,
  })
}
