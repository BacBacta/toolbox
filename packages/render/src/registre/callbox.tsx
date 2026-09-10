import type { BatirPartage, EtatCallbox, RenderContext } from '@a237/engine'
import {
  callboxShare, commissionDe, enregistrerOperation, fixerCommission, heureCourte,
  jourWAT, journees, montantF, nf, operationsDuJour, resteAuClient, retirerOperation,
  totauxCallbox,
} from '@a237/engine'
import type { JSX } from 'preact'
import { useState } from 'preact/hooks'
import {
  Action, Actions, CoquilleOutil, Identite, Montant, Rangee, Rangees, Surtitre, Vide,
} from './chrome.js'
import { Histogramme } from './graphique.js'

/**
 * Le call-box, l'écran d'une cabine de transfert.
 *
 * Le calcul est devant : on tape le montant remis, on lit ce qu'on garde, on
 * enregistre. La grille de commission est juste en dessous, modifiable, parce
 * que chaque opérateur a la sienne et qu'elle change.
 */

export type OngletCallbox = 'Caisse' | 'Registre' | 'Semaine'

const ONGLETS: readonly OngletCallbox[] = ['Caisse', 'Registre', 'Semaine']

/** Le libellé d'une tranche : « jusqu'à 25 000 F » ou « au-delà ». */
function libelleTranche(plafond: number): string {
  return plafond === 0 ? 'au-delà' : `jusqu’à ${montantF(plafond)}`
}

/** Le jour, tel qu'on le lit sur un histogramme : `09/09`. */
function jourCourt(jour: string): string {
  const [, mois, quantieme] = jour.split('-')
  return quantieme === undefined ? jour : `${quantieme}/${mois ?? ''}`
}

export function RegistreCallbox(props: {
  readonly glyphe: string
  readonly etat: EtatCallbox
  readonly ctx: RenderContext
  readonly onChange: (etat: EtatCallbox) => void
  readonly onDiffuser: (batir: BatirPartage) => void
  readonly ongletInitial?: OngletCallbox
}): JSX.Element {
  const [onglet, setOnglet] = useState<OngletCallbox>(props.ongletInitial ?? 'Caisse')
  const [saisi, setSaisi] = useState('10000')

  const etat = props.etat
  const jour = jourWAT(props.ctx.maintenant)
  const duJour = operationsDuJour(etat.operations, jour)
  const t = totauxCallbox(duJour)

  const montant = Number.parseInt(saisi.replace(/\s/g, ''), 10)
  const valide = Number.isFinite(montant) && montant > 0
  const garde = valide ? commissionDe(etat.tranches, montant) : 0
  const rend = valide ? resteAuClient(etat.tranches, montant) : 0

  function enregistrer(): void {
    if (!valide) return
    props.onChange(
      enregistrerOperation(etat, montant, heureCourte(props.ctx.maintenant), jour),
    )
  }

  return (
    <CoquilleOutil
      titre={etat.nom}
      glyphe={props.glyphe}
      sousTitre={`${t.nombre} opération${t.nombre > 1 ? 's' : ''} aujourd’hui`}
      kpis={[
        { libelle: 'Gagné', valeur: montantF(t.gagne) },
        { libelle: 'Volume', valeur: montantF(t.volume) },
      ]}
      onglets={ONGLETS}
      ongletCourant={onglet}
      onOnglet={setOnglet}
    >
      {onglet === 'Caisse' && (
        <>
          <label class="champ" for="callbox-montant">
            <span class="champ-libelle">Montant remis</span>
            <input
              id="callbox-montant"
              type="text"
              inputMode="numeric"
              value={saisi}
              onInput={(e) => setSaisi((e.target as HTMLInputElement).value)}
            />
          </label>

          <div class="calc-resultat">
            <span class="calc-libelle">Tu gardes</span>
            <span class="calc-valeur">{valide ? montantF(garde) : '—'}</span>
          </div>

          <div class="outil-legende">
            {valide
              ? `Le client reçoit ${montantF(rend)}.`
              : 'Entre un montant pour connaître la commission.'}
          </div>

          <Actions>
            <Action principale onClick={enregistrer}>
              Enregistrer
            </Action>
            <Action onClick={() => props.onDiffuser((c) => callboxShare(etat, c))}>
              Diffuser
            </Action>
          </Actions>

          <Surtitre>Grille de commission</Surtitre>
          {/*
            * La grille se corrige ici, pas dans un formulaire à part : c'est en
            * voyant « tu gardes 200 F » qu'on se rappelle qu'on est passé à 250.
            */}
          <Rangees>
            {etat.tranches.map((tr, i) => (
              <Rangee key={`${i}-${tr.plafond}`}>
                <Identite nom={libelleTranche(tr.plafond)} detail="" avatar={false} />
                <label class="callbox-tarif">
                  <span class="visuellement-cache">
                    Commission {libelleTranche(tr.plafond)}
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={String(tr.commission)}
                    onInput={(e) => {
                      const v = Number.parseInt(
                        (e.target as HTMLInputElement).value.replace(/\s/g, ''), 10,
                      )
                      props.onChange(fixerCommission(etat, i, Number.isFinite(v) ? v : 0))
                    }}
                  />
                  {/* Le champ porte un nombre nu ; sans unité, la rangée disait
                    * « jusqu'à 100 000 F » à gauche et « 1000 » à droite. */}
                  <span class="unite" aria-hidden="true">F</span>
                </label>
              </Rangee>
            ))}
          </Rangees>
        </>
      )}

      {onglet === 'Registre' && (
        <>
          {duJour.length === 0 ? (
            <Vide>Aucune opération aujourd’hui.</Vide>
          ) : (
            <Rangees>
              {[...etat.operations]
                .map((o, index) => ({ o, index }))
                .filter((x) => x.o.jour === jour)
                .reverse()
                .map((x) => (
                  <Rangee key={`${x.index}-${x.o.heure}`}>
                    <Identite nom={montantF(x.o.montant)} detail={x.o.heure} avatar={false} />
                    <Montant ton="regle">{`+${montantF(x.o.commission)}`}</Montant>
                    <button
                      type="button"
                      class="outil-retirer"
                      aria-label={`Retirer l’opération de ${x.o.heure}`}
                      onClick={() => props.onChange(retirerOperation(etat, x.index))}
                    >
                      ×
                    </button>
                  </Rangee>
                ))}
            </Rangees>
          )}
          <div class="outil-legende">
            Gain du jour <strong>{montantF(t.gagne)}</strong> sur {nf(t.volume)} F de volume.
          </div>
        </>
      )}

      {onglet === 'Semaine' && (
        <>
          <Surtitre>Commission par jour</Surtitre>
          {etat.operations.length === 0 ? (
            <Vide>Rien d’enregistré pour l’instant.</Vide>
          ) : (
            <>
              <Histogramme
                titre="Commission par jour"
                donnees={journees(etat.operations).slice(-7).map((j) => ({
                  etiquette: jourCourt(j.jour),
                  valeur: j.gagne,
                }))}
              />
              <Rangees>
                {[...journees(etat.operations)].reverse().slice(0, 7).map((j) => (
                  <Rangee key={j.jour}>
                    <Identite
                      nom={jourCourt(j.jour)}
                      detail={`${j.nombre} opération${j.nombre > 1 ? 's' : ''}`}
                      avatar={false}
                    />
                    <Montant ton="regle">{montantF(j.gagne)}</Montant>
                  </Rangee>
                ))}
              </Rangees>
            </>
          )}
        </>
      )}
    </CoquilleOutil>
  )
}
