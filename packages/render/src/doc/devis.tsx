import type { EtatDevis } from '@a237/engine'
import { chiffrer, dateEmission, dateLongue, montantEnLettres } from '@a237/engine'
import { LIBELLE_TVA_CM } from '@a237/legal-cm'
import type { JSX } from 'preact'
import { BlocClient, Entete, NumeroPage, PageA4, PiedLegal, TitreDocument, ZonesSignature } from './chrome.js'
import { BlocTotaux, TableauLignes } from './tableau.js'
import type { LigneTotal } from './tableau.js'

/**
 * Le devis, sur A4.
 *
 * Il propose : il porte une validité et un acompte demandé à la commande. Ce
 * qui engage fiscalement, c'est la facture — voir `facture.tsx`, qui partage
 * tout l'appareillage légal avec celui-ci.
 */
export function DocumentDevis(props: { readonly etat: EtatDevis }): JSX.Element {
  const etat = props.etat
  const c = chiffrer(etat)

  const totaux: LigneTotal[] = [
    { libelle: 'Sous-total HT', montant: c.totalHT },
    { libelle: LIBELLE_TVA_CM, montant: c.totalTVA },
    { libelle: 'Total TTC', montant: c.totalTTC, fort: true },
  ]
  if (etat.acompte > 0) {
    totaux.push({ libelle: `Acompte à la commande (${etat.acompte} %)`, montant: c.acompteDu })
    totaux.push({ libelle: 'Solde à la livraison', montant: c.soldeDu })
  }

  return (
    <PageA4 encre={etat.encre}>
      <Entete emetteur={etat.emetteur} />

      <TitreDocument
        titre="Devis"
        sousTitre={`N° ${etat.numero} · émis le ${dateLongue(dateEmission(etat))}`}
      />

      <BlocClient
        nom={etat.client.nom}
        niu={etat.client.niu}
        complement={etat.objet === undefined ? null : `Objet : ${etat.objet}`}
      />

      <TableauLignes totaux={c} />
      <BlocTotaux lignes={totaux} />

      <div class="a4-en-lettres">
        Soit {montantEnLettres(c.totalTTC)}, toutes taxes comprises.
      </div>

      <section class="a4-mentions">
        <p>Validité de la présente offre : {etat.validite} à compter de la date d’émission.</p>
        {etat.acompte > 0 && (
          <p>
            Acompte de {etat.acompte} % à la commande, solde à la livraison.
          </p>
        )}
      </section>

      <ZonesSignature
        zones={[
          { libelle: 'Le fournisseur', mention: 'Cachet et signature' },
          { libelle: 'Bon pour accord — le client', mention: 'Date, signature et cachet' },
        ]}
      />

      <PiedLegal
        emetteur={etat.emetteur}
        complement="Devis établi en francs CFA. Numérotation unique, continue et chronologique."
      />
      <NumeroPage page={1} total={1} />
    </PageA4>
  )
}
