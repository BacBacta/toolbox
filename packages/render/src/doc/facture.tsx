import type { EtatFacture } from '@a237/engine'
import {
  chiffrerFacture, dateEcheance, dateLongue, joursDeRetard, LIBELLE_MOYEN,
  montantEnLettres, montantF,
} from '@a237/engine'
import { dateEmission } from '@a237/engine'
import { LIBELLE_TVA_CM } from '@a237/legal-cm'
import type { JSX } from 'preact'
import { BlocClient, Entete, NumeroPage, PageA4, PiedLegal, TitreDocument, ZonesSignature } from './chrome.js'
import { BlocTotaux, TableauLignes } from './tableau.js'
import type { LigneTotal } from './tableau.js'

/**
 * La facture, sur A4.
 *
 * C'est le document que la DGI contrôle : entête complet, NIU de l'émetteur et
 * du client, TVA ligne par ligne puis en bloc, numérotation continue, pied
 * légal. Une facture envoyée par WhatsApp est valable si le PDF est complet
 * (BRIEF.md § 5) — d'où l'exigence que tout ce qui compte s'imprime ici.
 *
 * La date de rendu est passée en argument et non lue à l'horloge : le même
 * document doit sortir pareil sur le téléphone qui l'édite et sur le serveur
 * qui le rend.
 */
export function DocumentFacture(props: {
  readonly etat: EtatFacture
  readonly maintenant: Date
}): JSX.Element {
  const etat = props.etat
  const c = chiffrerFacture(etat)
  const retard = joursDeRetard(etat, props.maintenant)
  const echeance = dateLongue(dateEcheance(etat))

  const complementClient =
    [
      etat.objet === undefined ? null : `Objet : ${etat.objet}`,
      etat.devisNumero === undefined ? null : `En référence au devis N° ${etat.devisNumero}`,
    ]
      .filter((x): x is string => x !== null)
      .join(' — ') || null

  const totaux: LigneTotal[] = [
    { libelle: 'Sous-total HT', montant: c.totalHT },
    { libelle: LIBELLE_TVA_CM, montant: c.totalTVA },
    { libelle: 'Total TTC', montant: c.totalTTC, fort: true },
  ]
  if (c.verse > 0) {
    totaux.push({ libelle: 'Déjà réglé', montant: c.verse })
    totaux.push({ libelle: 'Reste à payer', montant: c.reste })
  }
  if (c.tropPercu > 0) {
    totaux.push({ libelle: 'Trop-perçu à restituer', montant: c.tropPercu })
  }

  return (
    <PageA4 encre={etat.encre}>
      <Entete emetteur={etat.emetteur} />

      <TitreDocument
        titre="Facture"
        sousTitre={`N° ${etat.numero} · émise le ${dateLongue(dateEmission(etat))} · échéance le ${echeance}`}
      />

      <BlocClient nom={etat.client.nom} niu={etat.client.niu} complement={complementClient} />

      <TableauLignes totaux={c} />
      <BlocTotaux lignes={totaux} />

      {/*
        Formule d'usage sur une facture en français ; ce n'est pas une mention
        que le brief documente comme obligatoire au Cameroun, mais elle lève
        toute ambiguïté sur le montant, ce qui est précisément son rôle.
      */}
      <div class="a4-en-lettres">
        Arrêtée la présente facture à la somme de {montantEnLettres(c.totalTTC)},
        toutes taxes comprises.
      </div>

      <section class="a4-mentions">
        {c.estSoldee ? (
          <p>Facture soldée. Reçu vaut quittance.</p>
        ) : (
          <p>
            Montant à régler : {montantF(c.reste)}, au plus tard le {echeance}.
            {retard > 0 && ` Échéance dépassée de ${retard} jour${retard > 1 ? 's' : ''}.`}
          </p>
        )}
        {etat.conditionsReglement !== '' && <p>{etat.conditionsReglement}</p>}
        {etat.reglements.length > 0 && (
          <p>
            Règlements reçus :{' '}
            {etat.reglements
              .map(
                (r) =>
                  `${montantF(r.montant)} le ${dateLongue(new Date(r.date))} (${LIBELLE_MOYEN[r.moyen]}${
                    r.reference !== undefined ? `, réf. ${r.reference}` : ''
                  })`,
              )
              .join(' · ')}
            .
          </p>
        )}
      </section>

      <ZonesSignature zones={[{ libelle: 'Cachet et signature', mention: 'Pour l’entreprise' }]} />

      <PiedLegal
        emetteur={etat.emetteur}
        complement="Facture établie en francs CFA. Numérotation unique, continue et chronologique."
      />
      <NumeroPage page={1} total={1} />
    </PageA4>
  )
}
