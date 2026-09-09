import type { EtatAttestation, EtatDette, EtatMotivation, EtatRecu } from '@a237/engine'
import { dateEmission, dateLongue, montantEnLettres, montantF, nf, totauxRecu } from '@a237/engine'
import type { JSX } from 'preact'
import {
  Entete, NumeroPage, PageA4, Paragraphes, PiedLegal, TitreDocument, ZonesSignature,
} from './chrome.js'
import { BlocTotaux } from './tableau.js'

/**
 * Les quatre actes et lettres, sur A4.
 *
 * Rien n'est redessiné : tout se monte sur les pièces de `chrome.tsx`, déjà
 * testées et déjà stylées par `a4.css`. Ce qui change d'un document à l'autre,
 * c'est l'ordre des pièces et ce qu'on met dedans — pas le papier.
 *
 * Deux d'entre eux portent l'entête légal de l'entreprise, deux ne le portent
 * pas. Ce n'est pas un oubli : un RCCM au-dessus d'une lettre de motivation
 * serait une faute de registre, et un juge qui lit une reconnaissance de dette
 * cherche deux personnes, pas une société.
 */

export function DocumentAttestation(props: { readonly etat: EtatAttestation }): JSX.Element {
  const etat = props.etat
  return (
    <PageA4 encre={etat.encre}>
      <Entete emetteur={etat.emetteur} />

      <TitreDocument
        titre={etat.objet === '' ? 'Attestation' : etat.objet}
        sousTitre={`N° ${etat.numero}`}
      />

      <section class="a4-mentions a4-corps">
        {etat.texte.trim() === '' ? (
          <div class="a4-vide">Le corps de l’attestation reste à écrire.</div>
        ) : (
          <Paragraphes texte={etat.texte} />
        )}
      </section>

      <ZonesSignature
        zones={[
          {
            libelle: `${etat.emetteur.adresse === '' ? 'Fait' : 'Fait à ' + villeDe(etat.emetteur.adresse)}, le ${dateLongue(dateEmission(etat))}`,
            mention: 'Le responsable — cachet et signature',
          },
        ]}
      />

      <PiedLegal emetteur={etat.emetteur} />
      <NumeroPage page={1} total={1} />
    </PageA4>
  )
}

/**
 * La ville, tirée de l'adresse.
 *
 * Approximatif et assumé : on prend le dernier mot, qui est la ville dans
 * « Rue Bépanda-Omnisport, BP 4127 Douala ». Se tromper met un mot de travers
 * sur une ligne de date ; demander une ville de plus dans le formulaire coûte
 * un champ à tout le monde pour une ligne que personne ne relit.
 */
function villeDe(adresse: string): string {
  const mots = adresse.trim().split(/[\s,]+/).filter((m) => m !== '')
  return mots[mots.length - 1] ?? ''
}

export function DocumentRecu(props: { readonly etat: EtatRecu }): JSX.Element {
  const etat = props.etat
  const t = totauxRecu(etat)

  return (
    <PageA4 encre={etat.encre}>
      <Entete emetteur={etat.emetteur} />

      <TitreDocument
        titre="Reçu"
        sousTitre={`N° ${etat.numero} · ${dateLongue(dateEmission(etat))}`}
      />

      <section class="a4-bloc-client">
        <div class="etiquette">Reçu de</div>
        <div>
          <strong>{etat.recuDe}</strong>
        </div>
      </section>

      {etat.lignes.length === 0 ? (
        <div class="a4-vide">Aucune ligne pour l’instant.</div>
      ) : (
        <table class="a4-tableau">
          <thead>
            <tr>
              <th>Désignation</th>
              <th class="nombre">Montant</th>
            </tr>
          </thead>
          <tbody>
            {etat.lignes.map((l, i) => (
              <tr key={`${i}-${l.designation}`}>
                <td>{l.designation}</td>
                <td class="nombre">{nf(l.montant)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <BlocTotaux
        lignes={[
          { libelle: 'Total', montant: t.total },
          { libelle: 'Somme reçue ce jour', montant: t.avance },
          { libelle: 'Reste à payer', montant: t.reste, fort: true },
        ]}
      />

      {/*
        * Formulé en « somme reçue : X » et non « soit X reçus » : le participe
        * s'accorderait avec le nombre, et « zéro franc CFA reçus » comme « un
        * franc CFA reçus » sont fautifs. La tournure nominale ne s'accorde
        * avec rien et reprend l'intitulé de la ligne de totaux.
        */}
      <div class="a4-en-lettres">
        Somme reçue ce jour : {montantEnLettres(t.avance)}.
      </div>

      <ZonesSignature zones={[{ libelle: 'Cachet et signature', mention: '' }]} />

      <PiedLegal
        emetteur={etat.emetteur}
        complement="Reçu établi en francs CFA. Il atteste d’un paiement reçu, il ne remplace pas la facture."
      />
      <NumeroPage page={1} total={1} />
    </PageA4>
  )
}

export function DocumentDette(props: { readonly etat: EtatDette }): JSX.Element {
  const etat = props.etat

  return (
    <PageA4 encre={etat.encre}>
      {/* Pas d'entête d'entreprise : c'est un acte entre deux personnes. */}
      <TitreDocument
        titre="Reconnaissance de dette"
        sousTitre={`Acte sous seing privé · ${dateLongue(dateEmission(etat))}`}
      />

      <section class="a4-parties">
        <div>
          <span class="qui">L’emprunteur</span> {etat.emprunteur.nom}
          {etat.emprunteur.piece === '' ? '' : `, ${etat.emprunteur.piece}`}
        </div>
        <div>
          <span class="qui">Le prêteur</span> {etat.preteur.nom}
          {etat.preteur.piece === '' ? '' : `, ${etat.preteur.piece}`}
        </div>
      </section>

      <section class="a4-mentions a4-corps">
        <Paragraphes texte={etat.texte} />
      </section>

      <section class="a4-encadre">
        <div class="etiquette">Montant du prêt</div>
        <div class="chiffre">{montantF(etat.montant)}</div>
        {/*
          * Le montant en toutes lettres, exigé par le brief § 5. Il n'est pas
          * décoratif : un « 1 » devient « 100 000 » d'un trait de stylo après
          * signature, « cent mille francs » ne se rallonge pas.
          */}
        <div class="lettres">Soit {montantEnLettres(etat.montant)}.</div>
        {/*
          * Rien plutôt qu'un deux-points dans le vide : une échéance non
          * saisie s'annonce dans l'encart rouge de l'écran, pas sur le papier.
          * L'acte se signe tel qu'il s'imprime, et « Échéance : » suivi de
          * rien se remplit après signature.
          */}
        {etat.echeance === '' ? null : (
          <div class="echeance">
            Échéance de remboursement : <strong>{etat.echeance}</strong>
          </div>
        )}
      </section>

      <ZonesSignature
        zones={[
          // « Lu et approuvé » est la seconde exigence du brief § 5.
          { libelle: 'L’emprunteur', mention: '« Lu et approuvé », date et signature' },
          { libelle: 'Le prêteur', mention: 'Date et signature' },
        ]}
      />

      <footer class="a4-pied">
        <div>
          {etat.lieu === '' ? 'Fait' : `Fait à ${etat.lieu}`} le{' '}
          {dateLongue(dateEmission(etat))}, en deux exemplaires originaux, dont un remis
          à chaque partie.
        </div>
        <div>
          Acte sous seing privé. Pour un montant important, l’enregistrement auprès des
          impôts est conseillé.
        </div>
      </footer>
      <NumeroPage page={1} total={1} />
    </PageA4>
  )
}

export function DocumentMotivation(props: { readonly etat: EtatMotivation }): JSX.Element {
  const etat = props.etat
  const e = etat.expediteur

  return (
    <PageA4 encre={etat.encre}>
      {/* La disposition française : expéditeur à gauche, destinataire à droite. */}
      <section class="a4-lettre-tete">
        <div class="expediteur">
          <strong>{e.nom}</strong>
          {[e.tel, e.mail, e.ville].filter((s) => s !== '').map((s) => (
            <div key={s}>{s}</div>
          ))}
        </div>
        <div class="destinataire">
          {etat.destinataire.split('\n').filter((l) => l.trim() !== '').map((l, i) => (
            <div key={`${i}-${l}`}>{l}</div>
          ))}
        </div>
      </section>

      <div class="a4-lettre-date">
        {e.ville === '' ? '' : `${e.ville}, le `}
        {dateLongue(dateEmission(etat))}
      </div>

      <div class="a4-lettre-objet">{etat.objet}</div>

      <section class="a4-mentions a4-corps">
        {etat.corps.trim() === '' ? (
          <div class="a4-vide">Le corps de la lettre reste à écrire.</div>
        ) : (
          <Paragraphes texte={etat.corps} />
        )}
      </section>

      <div class="a4-lettre-signature">{e.nom}</div>
      <NumeroPage page={1} total={1} />
    </PageA4>
  )
}
