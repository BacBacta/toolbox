import type { Totaux, XAF } from '@a237/engine'
import { montantF, nf } from '@a237/engine'
import { LIBELLE_TVA_CM } from '@a237/legal-cm'
import type { JSX } from 'preact'

/**
 * Le tableau des lignes, **avec la TVA colonne par colonne**.
 *
 * La section 5 du brief l'exige : « TVA 19,25 %, indiquée ligne par ligne, puis
 * en bloc HT / TVA / TTC ». Le prototype n'affichait que le bloc. Un contrôleur
 * doit pouvoir recalculer chaque ligne au stylo et retomber sur le total — d'où
 * aussi la règle d'arrondi du moteur, qui arrondit à la ligne avant de sommer.
 */
/**
 * Une ligne qui ne dit rien : ni désignation, ni montant.
 *
 * « Ajouter une ligne » en insère une vide, et c'est voulu — on la remplit
 * ensuite. Reste qu'on peut être interrompu et diffuser sans y revenir : le
 * client recevait alors un devis portant une rangée de cinq zéros sans
 * désignation. La retirer ne change aucun total, une ligne à zéro n'apportant
 * rien à la somme ; elle reste bien visible dans l'outil, où elle attend d'être
 * remplie, et c'est le document qui ne l'imprime pas.
 *
 * Le montant compte autant que le nom : « Livraison offerte » à zéro franc dit
 * quelque chose, et s'imprime.
 */
function neDitRien(ligne: Totaux['lignes'][number]): boolean {
  return ligne.designation.trim() === '' && ligne.montantTTC === 0
}

export function TableauLignes(props: { readonly totaux: Totaux }): JSX.Element {
  const lignes = props.totaux.lignes.filter((l) => !neDitRien(l))
  if (lignes.length === 0) {
    return <div class="a4-vide">Aucune ligne pour l’instant.</div>
  }
  return (
    <table class="a4-tableau">
      <thead>
        <tr>
          <th>Désignation</th>
          <th class="nombre">Qté</th>
          <th class="nombre">P.U. HT</th>
          <th class="nombre">Montant HT</th>
          <th class="nombre">{LIBELLE_TVA_CM}</th>
          <th class="nombre">Montant TTC</th>
        </tr>
      </thead>
      <tbody>
        {lignes.map((l, i) => (
          <tr key={`${i}-${l.designation}`}>
            <td>{l.designation}</td>
            <td class="nombre">{nf(l.quantite)}</td>
            <td class="nombre">{nf(l.prixUnitaire)}</td>
            <td class="nombre">{nf(l.montantHT)}</td>
            <td class="nombre">{nf(l.tva)}</td>
            <td class="nombre">{nf(l.montantTTC)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export interface LigneTotal {
  readonly libelle: string
  readonly montant: XAF
  /** La ligne mise en avant : le total qui engage. Une seule par bloc. */
  readonly fort?: boolean
}

/** Le bloc HT / TVA / TTC, plus ce que le document ajoute au-dessous. */
export function BlocTotaux(props: { readonly lignes: readonly LigneTotal[] }): JSX.Element {
  return (
    <section class="a4-totaux">
      {props.lignes.map((l) => (
        <div class={l.fort === true ? 'ligne fort' : 'ligne'} key={l.libelle}>
          <span>{l.libelle}</span>
          <span>{montantF(l.montant)}</span>
        </div>
      ))}
    </section>
  )
}
