import type { EtatPresence, RenderContext, ShareSpec } from '@a237/engine'
import {
  ajouterNom, appel, assiduites, basculerPresence, decroche, nomSeance, nouvelleSeance,
  presenceShare, retirerNom,
} from '@a237/engine'
import type { JSX } from 'preact'
import { useState } from 'preact/hooks'
import {
  Action, Actions, Badge, Barre, CoquilleOutil, Identite, Montant, Rangee, Rangees,
  Surtitre, Vide,
} from './chrome.js'

/**
 * La feuille de présence, l'écran de l'appel.
 *
 * Une seule séance à l'écran à la fois : l'appel se fait en regardant les gens,
 * pas en lisant une grille de douze colonnes sur un téléphone. Le tableau
 * complet vit dans l'onglet Assiduité, sous la forme qui compte — un taux par
 * personne.
 */

export type OngletPresence = 'Appel' | 'Assiduité'

const ONGLETS: readonly OngletPresence[] = ['Appel', 'Assiduité']

export function RegistrePresence(props: {
  readonly glyphe: string
  readonly etat: EtatPresence
  readonly ctx: RenderContext
  readonly onChange: (etat: EtatPresence) => void
  readonly onDiffuser: (partage: ShareSpec) => void
  readonly ongletInitial?: OngletPresence
  readonly seanceInitiale?: number
}): JSX.Element {
  const [onglet, setOnglet] = useState<OngletPresence>(props.ongletInitial ?? 'Appel')
  const [nouveau, setNouveau] = useState('')

  const etat = props.etat
  const derniere = Math.max(0, etat.seances.length - 1)
  const [seance, setSeance] = useState(props.seanceInitiale ?? derniere)
  // Une séance retirée ou une feuille rechargée peut laisser l'index au-delà.
  const courante = Math.min(seance, derniere)
  const a = appel(etat, courante)

  function ouvrirSeance(): void {
    props.onChange(nouvelleSeance(etat))
    setSeance(etat.seances.length)
  }

  function ajouter(): void {
    if (nouveau.trim() === '') return
    props.onChange(ajouterNom(etat, nouveau))
    setNouveau('')
  }

  return (
    <CoquilleOutil
      titre={etat.nom}
      glyphe={props.glyphe}
      sousTitre={
        etat.seances.length === 0
          ? 'aucune séance'
          : `${etat.seances.length} séance${etat.seances.length > 1 ? 's' : ''}`
      }
      /*
       * Tant qu'aucune séance n'est ouverte, il n'y a pas de « 0 présents sur
       * 3 » : il n'y a rien à quoi être présent. Un zéro se lit comme une
       * assemblée déserte, un tiret se lit comme une feuille qui n'a pas
       * commencé.
       */
      kpis={[
        {
          libelle: 'Présents',
          valeur: etat.seances.length === 0 ? '—' : `${a.presents} / ${a.total}`,
        },
        {
          libelle: 'Taux',
          valeur: etat.seances.length === 0 ? '—' : `${Math.round(a.taux * 100)} %`,
        },
      ]}
      onglets={ONGLETS}
      ongletCourant={onglet}
      onOnglet={setOnglet}
    >
      {onglet === 'Appel' && (
        <>
          {etat.seances.length > 1 && (
            <div class="presence-seances" role="group" aria-label="Séance">
              {etat.seances.map((_, i) => (
                <button
                  key={`s${i}`}
                  type="button"
                  class="outil-bascule"
                  aria-pressed={i === courante}
                  onClick={() => setSeance(i)}
                >
                  {nomSeance(etat, i)}
                </button>
              ))}
            </div>
          )}

          {etat.noms.length === 0 ? (
            <Vide>Personne sur la feuille. Ajoute les noms ci-dessous.</Vide>
          ) : etat.seances.length === 0 ? (
            <Vide>Aucune séance ouverte. Ouvre la première pour faire l’appel.</Vide>
          ) : (
            <Rangees>
              {etat.noms.map((nom, i) => {
                const present = etat.seances[courante]?.presents[i] === true
                return (
                  <Rangee key={`${i}-${nom}`}>
                    <Identite nom={nom} detail="" />
                    <button
                      type="button"
                      class="outil-bascule"
                      aria-pressed={present}
                      aria-label={`${nom} : ${present ? 'présent' : 'absent'}`}
                      onClick={() => props.onChange(basculerPresence(etat, courante, i))}
                    >
                      {present ? 'présent' : 'absent'}
                    </button>
                  </Rangee>
                )
              })}
            </Rangees>
          )}

          <Actions>
            <Action
              principale
              onClick={() => props.onDiffuser(presenceShare(etat, props.ctx, courante))}
            >
              Diffuser
            </Action>
            <Action onClick={ouvrirSeance}>Nouvelle séance</Action>
          </Actions>

          {etat.seances.length > 0 && a.absents.length > 0 && (
            <div class="outil-legende">
              {a.absents.length} absent{a.absents.length > 1 ? 's' : ''} : {a.absents.join(', ')}.
            </div>
          )}
        </>
      )}

      {onglet === 'Assiduité' && (
        <>
          {etat.seances.length > 0 && (
            <Barre
              part={a.taux}
              legende={`${a.presents} sur ${a.total} à ${nomSeance(etat, courante)}`}
            />
          )}

          <Surtitre>Présence sur toutes les séances</Surtitre>

          {etat.noms.length === 0 ? (
            <Vide>La feuille est vide.</Vide>
          ) : (
            <Rangees>
              {assiduites(etat).map((x) => (
                <Rangee key={`${x.index}-${x.nom}`}>
                  <Identite
                    nom={x.nom}
                    detail={
                      x.seances === 0
                        ? ''
                        : `${x.presences} sur ${x.seances} séance${x.seances > 1 ? 's' : ''}`
                    }
                  />
                  {x.taux !== null && (
                    <Montant ton={decroche(x) ? 'retard' : 'neutre'}>
                      {`${Math.round(x.taux * 100)} %`}
                    </Montant>
                  )}
                  {x.taux === null && <Badge ton="neutre">nouveau</Badge>}
                  <button
                    type="button"
                    class="outil-retirer"
                    aria-label={`Retirer ${x.nom}`}
                    onClick={() => props.onChange(retirerNom(etat, x.index))}
                  >
                    ×
                  </button>
                </Rangee>
              ))}
            </Rangees>
          )}

          <div class="outil-formulaire">
            <input
              type="text"
              value={nouveau}
              placeholder="Nom de la personne"
              aria-label="Nom de la personne"
              onInput={(e) => setNouveau((e.target as HTMLInputElement).value)}
            />
          </div>
          <Actions>
            <Action principale onClick={ajouter}>
              Ajouter à la feuille
            </Action>
          </Actions>
        </>
      )}
    </CoquilleOutil>
  )
}
