import type { EtatNjangi, MembreNjangi, Periode, RenderContext, ShareSpec } from '@a237/engine'
import {
  ajouterMembre, basculerVersement, beneficiaireDuTour, classementFiabilite,
  collecte, estFiable, fiabilite, montantF, njangi, prochainTour, retirerMembre,
} from '@a237/engine'
import type { JSX } from 'preact'
import { useState } from 'preact/hooks'
import {
  Action, Actions, Badge, Barre, CoquilleOutil, Identite, Montant, Rangee, Rangees,
  Surtitre, Vide,
} from './chrome.js'
import { Histogramme } from './graphique.js'

/**
 * Le carnet de njangi, l'écran que le trésorier ouvre chaque semaine.
 *
 * Le composant ne calcule rien et ne décide rien : chaque geste appelle une
 * transition du moteur, déjà testée sans DOM, et remonte le nouvel état par
 * `onChange`. C'est ce qui permet de remplacer cet écran sans toucher à ce que
 * le trésorier considère comme son cahier.
 *
 * La diffusion remonte la `ShareSpec` du squelette : c'est l'app qui décide
 * quoi en faire — dessiner la carte, ouvrir le partage natif, publier. Les
 * relances, elles, partent du pouce du trésorier (invariant § 2.4).
 */

export type OngletNjangi = 'Cagnotte' | 'Membres' | 'Historique'

const ONGLETS: readonly OngletNjangi[] = ['Cagnotte', 'Membres', 'Historique']

const NOM_PERIODE: Readonly<Record<Periode, string>> = {
  semaine: 'semaine',
  quinzaine: 'quinzaine',
  mois: 'mois',
}

const TOUR_SUIVANT: Readonly<Record<Periode, string>> = {
  semaine: 'Semaine suivante',
  quinzaine: 'Quinzaine suivante',
  mois: 'Mois suivant',
}

function etatMembre(m: MembreNjangi): string {
  if (m.estAuTour) return 'reçoit ce tour'
  if (m.aRecu) return 'a déjà reçu'
  return 'pas encore servi'
}

function detailFiabilite(m: MembreNjangi): string {
  if (m.tours === 0) return 'nouveau — pas encore de tour vécu'
  return `${m.versements} versements sur ${m.tours} tours`
}

export function RegistreNjangi(props: {
  readonly etat: EtatNjangi
  readonly ctx: RenderContext
  readonly onChange: (etat: EtatNjangi) => void
  readonly onDiffuser: (partage: ShareSpec) => void
  readonly ongletInitial?: OngletNjangi
}): JSX.Element {
  const [onglet, setOnglet] = useState<OngletNjangi>(props.ongletInitial ?? 'Cagnotte')
  const [nouveauNom, setNouveauNom] = useState('')
  const [nouveauTel, setNouveauTel] = useState('')

  const etat = props.etat
  const c = collecte(etat)
  const tour = beneficiaireDuTour(etat)

  function ajouter(): void {
    if (nouveauNom.trim() === '') return
    props.onChange(ajouterMembre(etat, nouveauNom, nouveauTel))
    setNouveauNom('')
    setNouveauTel('')
  }

  return (
    <CoquilleOutil
      titre={etat.nom}
      sousTitre={`${NOM_PERIODE[etat.periode]} ${etat.tour} · cotisation ${montantF(etat.cotisation)}`}
      kpis={[
        { libelle: 'Collecté', valeur: montantF(c.collecte) },
        { libelle: 'Attendu', valeur: montantF(c.attendu) },
        { libelle: 'En retard', valeur: String(c.retardataires.length) },
      ]}
      onglets={ONGLETS}
      ongletCourant={onglet}
      onOnglet={setOnglet}
    >
      {onglet === 'Cagnotte' && (
        <>
          <Barre part={c.taux} legende={`reste ${montantF(c.reste)}`} />

          {etat.membres.length === 0 ? (
            <Vide>Aucun membre pour l’instant. Ajoute-les dans l’onglet Membres.</Vide>
          ) : (
            <Rangees>
              {etat.membres.map((m, i) => (
                <Rangee key={`${i}-${m.nom}`}>
                  <Identite nom={m.nom} detail={etatMembre(m)} />
                  {m.estAuTour ? (
                    <Badge ton="tour">tour</Badge>
                  ) : (
                    <Montant ton={m.aVerse ? 'regle' : 'retard'}>
                      {m.aVerse ? montantF(etat.cotisation) : '—'}
                    </Montant>
                  )}
                  <button
                    type="button"
                    class="outil-bascule"
                    aria-pressed={m.aVerse}
                    aria-label={`${m.nom} : ${m.aVerse ? 'a versé' : 'doit sa part'}`}
                    onClick={() => props.onChange(basculerVersement(etat, i))}
                  >
                    {m.aVerse ? 'payé' : 'doit'}
                  </button>
                </Rangee>
              ))}
            </Rangees>
          )}

          <Actions>
            <Action principale onClick={() => props.onDiffuser(njangi.share(etat, props.ctx))}>
              Diffuser
            </Action>
            <Action onClick={() => props.onChange(prochainTour(etat))}>
              {TOUR_SUIVANT[etat.periode]}
            </Action>
          </Actions>

          {tour !== null && (
            <div class="outil-legende">
              {tour.nom} reçoit {montantF(c.collecte)} ce tour-ci.
            </div>
          )}
        </>
      )}

      {onglet === 'Membres' && (
        <>
          <Surtitre>Fiabilité du cycle</Surtitre>

          {etat.membres.length === 0 ? (
            <Vide>Le carnet est vide.</Vide>
          ) : (
            <Rangees>
              {classementFiabilite(etat).map((m) => {
                const taux = fiabilite(m)
                const fiable = estFiable(m)
                return (
                  <Rangee key={m.nom}>
                    <Identite nom={m.nom} detail={detailFiabilite(m)} />
                    <Montant ton={fiable === false ? 'retard' : 'neutre'}>
                      {taux === null ? '—' : `${Math.round(taux * 100)} %`}
                    </Montant>
                    {fiable === null ? (
                      <Badge ton="neutre">nouveau</Badge>
                    ) : (
                      <Badge ton={fiable ? 'oui' : 'non'}>{fiable ? 'fiable' : 'fragile'}</Badge>
                    )}
                    <button
                      type="button"
                      class="outil-retirer"
                      aria-label={`Retirer ${m.nom}`}
                      onClick={() =>
                        props.onChange(retirerMembre(etat, etat.membres.indexOf(m)))
                      }
                    >
                      ×
                    </button>
                  </Rangee>
                )
              })}
            </Rangees>
          )}

          <div class="outil-formulaire">
            <input
              type="text"
              value={nouveauNom}
              placeholder="Nom du membre"
              aria-label="Nom du membre"
              onInput={(e) => setNouveauNom((e.target as HTMLInputElement).value)}
            />
            <input
              type="tel"
              value={nouveauTel}
              placeholder="Téléphone (facultatif)"
              aria-label="Téléphone du membre, facultatif"
              onInput={(e) => setNouveauTel((e.target as HTMLInputElement).value)}
            />
          </div>
          <Actions>
            <Action principale onClick={ajouter}>
              Ajouter au carnet
            </Action>
          </Actions>
        </>
      )}

      {onglet === 'Historique' && (
        <>
          <Surtitre>Collecté par {NOM_PERIODE[etat.periode]}</Surtitre>
          <Histogramme
            titre={`Collecte par ${NOM_PERIODE[etat.periode]}`}
            donnees={[
              ...etat.historique.map((h) => ({
                etiquette: `t${h.tour}`,
                valeur: h.collecte,
              })),
              { etiquette: `t${etat.tour}`, valeur: c.collecte },
            ]}
          />
        </>
      )}
    </CoquilleOutil>
  )
}
