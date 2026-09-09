import type { Instantane } from '@a237/engine'
import { dateLongue } from '@a237/engine'
import type { JSX } from 'preact'

/**
 * La page de lecture : ce que voit un client qui ouvre le lien.
 *
 * **Aucun script.** Ce n'est pas une économie, c'est ce qui la rend fiable :
 * elle s'ouvre sur un téléphone d'entrée de gamme, sur une connexion qui
 * hoquette, dans le navigateur intégré de WhatsApp, et elle s'imprime. Rien à
 * charger, rien à attendre, rien qui puisse échouer à mi-chemin.
 *
 * Elle est **en lecture seule** et ne porte aucun bouton : ce lien s'envoie à
 * quelqu'un qui n'a pas de compte et n'en veut pas.
 */

/** L'entête de la page : ce que WhatsApp lit pour son aperçu. */
export interface MetaPage {
  readonly titre: string
  readonly description: string
  /** L'adresse de la carte, quand elle existe. Absente tant que R2 n'est pas là. */
  readonly image?: string
  readonly lien: string
}

/**
 * Le pied de page.
 *
 * Il dit d'où vient le document et quand il a été arrêté. Un client qui reçoit
 * un devis doit pouvoir répondre « celui du 9 septembre » sans ouvrir un
 * fichier.
 */
export function PiedLecture(props: { readonly instantane: Instantane }): JSX.Element {
  const quand = new Date(props.instantane.publieLe)
  return (
    <footer class="lecture-pied">
      <p>
        Arrêté le {Number.isNaN(quand.getTime()) ? '—' : dateLongue(quand)}.
        Document en lecture seule.
      </p>
      <p class="lecture-marque">Atelier&nbsp;237</p>
    </footer>
  )
}

/**
 * La page quand le lien ne mène à rien.
 *
 * Un 404 nu laisse croire à une panne. Celui-ci dit la seule chose utile : le
 * lien est peut-être mal recopié, ou le document n'est plus publié.
 */
export function PageIntrouvable(): JSX.Element {
  return (
    <main class="lecture lecture-vide">
      <h1>Ce lien ne mène à rien</h1>
      <p>
        Le document n’est plus publié, ou le lien a été recopié de travers.
        Demande-le à nouveau à la personne qui te l’a envoyé.
      </p>
      <p class="lecture-marque">Atelier&nbsp;237</p>
    </main>
  )
}
