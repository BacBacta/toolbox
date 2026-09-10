import type { BaseD1 } from './base.js'
import { empreinte } from './identite.js'

/**
 * Ce qu'un formulaire publié reçoit.
 *
 * C'est la première fois que le produit accepte une écriture venue de
 * l'extérieur. Tout le reste part du téléphone de son propriétaire — un
 * instantané qu'il dépose, un paiement qu'il déclenche. Ici, c'est un inconnu
 * qui écrit, et trois choses tiennent la porte ouverte sans la laisser
 * fracturer : un plafond par formulaire, un délai entre deux envois du même
 * endroit, et le piège à robots qui vit dans la page.
 *
 * L'adresse du visiteur n'est jamais rangée telle quelle. Son empreinte suffit
 * à espacer deux envois, et une copie de la base ne dit alors pas qui a
 * répondu — un formulaire de tontine reçoit des choses qui ne regardent pas
 * l'hébergeur.
 */

export interface LigneReponse {
  readonly contenu: string
  readonly recu_le: number
}

/**
 * Note qui a publié quoi.
 *
 * Sans ça, une adresse publique qui reçoit n'aurait pas de destinataire : le
 * propriétaire ne pourrait pas relire ses réponses, et n'importe qui le
 * pourrait. Écrit à chaque dépôt d'un formulaire, et mis à jour quand il est
 * republié — le lien ne change pas, la configuration si.
 */
export async function noterPublication(
  db: BaseD1,
  publication: { readonly lien: string; readonly compteId: string; readonly skeleton: string },
  maintenant: Date,
): Promise<void> {
  const t = maintenant.getTime()
  await db
    .prepare(
      'INSERT INTO publications (lien, compte_id, skeleton, cree_le, maj_le) VALUES (?, ?, ?, ?, ?)' +
        // Republier n'ouvre pas une deuxième publication, et ne change jamais
        // de propriétaire : le lien appartient à qui l'a tiré.
        ' ON CONFLICT(lien) DO UPDATE SET skeleton = excluded.skeleton, maj_le = excluded.maj_le' +
        ' WHERE publications.compte_id = excluded.compte_id',
    )
    .bind(publication.lien, publication.compteId, publication.skeleton, t, t)
    .run()
}

/** Le compte à qui ce lien appartient, ou `null` s'il n'a pas été noté. */
export async function proprietaireDe(db: BaseD1, lien: string): Promise<string | null> {
  const ligne = await db
    .prepare('SELECT compte_id FROM publications WHERE lien = ?')
    .bind(lien)
    .first<{ compte_id: string }>()
  return ligne?.compte_id ?? null
}

/** Combien de réponses ce formulaire a déjà reçues. */
export async function combienDeReponses(db: BaseD1, lien: string): Promise<number> {
  const ligne = await db
    .prepare('SELECT COUNT(*) AS n FROM reponses WHERE lien = ?')
    .bind(lien)
    .first<{ n: number }>()
  return ligne?.n ?? 0
}

/**
 * Le même endroit a-t-il déjà écrit il y a moins de ça ?
 *
 * Un délai, et non un compteur de requêtes : ce qu'on veut empêcher est le
 * remplissage en boucle, pas la famille qui répond depuis le même wifi. Trente
 * secondes laissent passer plusieurs personnes d'un même foyer et arrêtent un
 * script.
 */
export const DELAI_ENTRE_ENVOIS_MS = 30_000

export async function tropTot(
  db: BaseD1,
  lien: string,
  source: string,
  maintenant: Date,
): Promise<boolean> {
  const ligne = await db
    .prepare('SELECT recu_le FROM reponses WHERE lien = ? AND source = ? ORDER BY recu_le DESC LIMIT 1')
    .bind(lien, source)
    .first<{ recu_le: number }>()
  return ligne !== null && maintenant.getTime() - ligne.recu_le < DELAI_ENTRE_ENVOIS_MS
}

export async function rangerReponse(
  db: BaseD1,
  reponse: {
    readonly lien: string
    readonly contenu: Readonly<Record<string, string>>
    readonly source: string | null
  },
  maintenant: Date,
): Promise<void> {
  await db
    .prepare('INSERT INTO reponses (id, lien, contenu, source, recu_le) VALUES (?, ?, ?, ?, ?)')
    .bind(
      crypto.randomUUID(),
      reponse.lien,
      JSON.stringify(reponse.contenu),
      reponse.source,
      maintenant.getTime(),
    )
    .run()
}

/**
 * Les réponses d'un formulaire, la plus récente en tête.
 *
 * Plafonnées : cinq cents réponses dans une seule requête feraient un corps
 * que le téléphone qui le demande n'a pas la mémoire de tenir, et la personne
 * qui les lit n'en regarde de toute façon que les dernières.
 */
export const REPONSES_PAR_PAGE = 100

export async function lireReponses(
  db: BaseD1,
  lien: string,
  avant?: number,
): Promise<readonly LigneReponse[]> {
  const requete =
    avant === undefined
      ? db
          .prepare('SELECT contenu, recu_le FROM reponses WHERE lien = ? ORDER BY recu_le DESC LIMIT ?')
          .bind(lien, REPONSES_PAR_PAGE)
      : db
          .prepare(
            'SELECT contenu, recu_le FROM reponses WHERE lien = ? AND recu_le < ? ORDER BY recu_le DESC LIMIT ?',
          )
          .bind(lien, avant, REPONSES_PAR_PAGE)
  const { results } = await requete.all<LigneReponse>()
  return results
}

/**
 * L'empreinte d'une adresse, salée par le lien.
 *
 * Salée, parce que sans sel la même adresse donne la même empreinte sur tous
 * les formulaires : on saurait alors qu'une même personne a répondu à celui de
 * la tontine et à celui du lycée. Le lien lui-même fait le sel — il est déjà
 * secret, et il change d'un formulaire à l'autre.
 */
export async function empreinteSource(lien: string, adresse: string | null): Promise<string | null> {
  return adresse === null || adresse === '' ? null : empreinte(`${lien}:${adresse}`)
}
