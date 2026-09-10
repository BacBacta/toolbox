import { compteDeLAppareil, journaliser, prendreUnCredit, rendreUnCredit } from './base.js'
import type { AppelIa, BaseD1 } from './base.js'
import { empreinte } from './identite.js'
import type { Compte } from './plan.js'

/**
 * Le compte de cette requête, et ce qu'on peut lui faire.
 *
 * C'est la seule chose que le proxy IA connaît des comptes : il reçoit une
 * séance, il ne sait pas qu'il y a une base derrière. Ce qui décide du droit de
 * composer reste ici ; le proxy l'applique.
 */
export interface Seance {
  readonly compte: Compte
  readonly maintenant: Date
  /** Rend faux si le compte n'avait plus rien : la condition est en base. */
  prendreUnCredit(): Promise<boolean>
  rendreUnCredit(): Promise<void>
  journaliser(appel: Omit<AppelIa, 'compteId'>): Promise<void>
}

/** L'en-tête par lequel un appareil se présente. */
export const SCHEMA_AUTORISATION = 'Appareil'

export function jetonDeLEntete(entetes: Headers): string | null {
  const brut = entetes.get('authorization')
  if (brut === null) return null
  const [schema, jeton] = brut.split(' ')
  if (schema !== SCHEMA_AUTORISATION || jeton === undefined) return null
  return jeton
}

export async function ouvrirSeance(db: BaseD1, jeton: string, maintenant: Date): Promise<Seance> {
  const compte = await compteDeLAppareil(db, await empreinte(jeton), maintenant)
  return {
    compte,
    maintenant,
    prendreUnCredit: () => prendreUnCredit(db, compte.id),
    rendreUnCredit: () => rendreUnCredit(db, compte.id),
    journaliser: (appel) => journaliser(db, { ...appel, compteId: compte.id }, maintenant),
  }
}
