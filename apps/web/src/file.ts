import { lireFile, lireOutil, noterPublication, retirerDeLaFile } from './stockage.js'
import { publier } from './publier.js'

/**
 * Rejouer ce qui n'est pas parti.
 *
 * Le réseau ne sert qu'à publier, payer et appeler le modèle — trois choses qui
 * peuvent attendre (§ 2.7). Encore faut-il que quelqu'un les reprenne : une
 * file dans laquelle on dépose sans jamais rien retirer n'est pas une file
 * d'attente, c'est un tiroir.
 *
 * On rejoue **l'état d'aujourd'hui**, pas celui du jour où la publication a été
 * mise en attente. Quelqu'un qui a continué de travailler hors ligne veut voir
 * partir son carnet tel qu'il est, pas tel qu'il était à la première tentative.
 * L'entrée de file ne dit donc qu'une chose : cet outil attend d'être publié.
 */

export interface Bilan {
  readonly publies: number
  /** Restent en attente : le réseau n'est toujours pas là. */
  readonly attendent: number
  /** Retirés sans être publiés : l'outil a disparu, ou le serveur a dit non. */
  readonly abandonnes: number
}

/** Une seule vidange à la fois : le montage et le retour du réseau se suivent de près. */
let enCours = false

export async function viderLaFile(maintenant: Date): Promise<Bilan> {
  if (enCours) return { publies: 0, attendent: 0, abandonnes: 0 }
  enCours = true
  try {
    return await vider(maintenant)
  } finally {
    enCours = false
  }
}

async function vider(maintenant: Date): Promise<Bilan> {
  const entrees = await lireFile()
  let publies = 0
  let attendent = 0
  let abandonnes = 0

  // Un même outil peut avoir été mis en file plusieurs fois — une par tentative
  // hors ligne. Le publier une fois suffit : c'est son état d'aujourd'hui qui
  // part, et il est le même pour toutes les entrées.
  const traites = new Set<string>()

  for (const entree of entrees) {
    if (traites.has(entree.outilId)) {
      await retirerDeLaFile(entree.id)
      continue
    }

    const outil = await lireOutil(entree.outilId)
    if (outil === null) {
      // Supprimé depuis. Rien à publier, et rien à dire : c'est un choix qui a
      // été fait après coup.
      await retirerDeLaFile(entree.id)
      abandonnes += 1
      continue
    }

    /*
     * Déjà déposé dans cette version-là. L'écran fait le même raisonnement
     * avant de diffuser : le lien vaut toujours, et une requête pour le redire
     * repartirait en conflit — le serveur n'accepte que du strictement plus
     * récent. Sans ce court-circuit, la file dépensait cette requête, puis
     * comptait le refus comme un abandon.
     */
    if (outil.lien !== undefined && outil.versionPubliee === outil.version) {
      await retirerDeLaFile(entree.id)
      traites.add(entree.outilId)
      publies += 1
      continue
    }

    const issue = await publier(outil, maintenant, outil.lien)

    if (issue.sorte === 'publie') {
      await noterPublication(outil, issue.lien, outil.version)
      await retirerDeLaFile(entree.id)
      traites.add(entree.outilId)
      publies += 1
      continue
    }

    if (issue.sorte === 'differe') {
      // Toujours hors ligne : on garde l'entrée et on arrête là. Insister sur
      // les suivantes ferait autant de requêtes vouées à échouer.
      attendent += entrees.length - publies - abandonnes
      break
    }

    /*
     * Refusé, ou périmé côté serveur. Réessayer n'y changera rien : un refus
     * tient à ce qu'est l'outil, un conflit à ce que le serveur détient déjà.
     * On retire l'entrée plutôt que de rejouer indéfiniment ; l'utilisateur le
     * verra à sa prochaine diffusion, avec la raison.
     */
    await retirerDeLaFile(entree.id)
    traites.add(entree.outilId)
    abandonnes += 1
  }

  return { publies, attendent, abandonnes }
}
