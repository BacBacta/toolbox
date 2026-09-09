import type { BatirPartage, DetteVue, EtatArdoise, RenderContext } from '@a237/engine'
import {
  ajouterDette, ardoise, basculerReglee, chercher, montantF, ordonner, retirerDette,
  totaux, vieillissement, vueDettes,
} from '@a237/engine'
import type { JSX } from 'preact'
import { useState } from 'preact/hooks'
import {
  Action, Actions, Barre, CoquilleOutil, Identite, Montant, Rangee, Rangees,
  Surtitre, Vide,
} from './chrome.js'
import { Histogramme } from './graphique.js'

/**
 * L'ardoise, l'écran qu'on ouvre pour savoir qui relancer.
 *
 * Comme le carnet de njangi, il ne calcule rien : chaque geste appelle une
 * transition du moteur et remonte le nouvel état. L'ancienneté vient de
 * `ctx.maintenant`, jamais d'une horloge lue ici.
 */

export type OngletArdoise = 'Encours' | 'Analyse'

const ONGLETS: readonly OngletArdoise[] = ['Encours', 'Analyse']

/** L'état d'une dette, en toutes lettres, sous le nom du client. */
function etatDette(v: DetteVue): string {
  if (v.regle) return 'réglé'
  if (v.enRetard) return `retard de ${v.jours} jours`
  if (v.jours === 0) return 'ouverte aujourd’hui'
  return `depuis ${v.jours} jour${v.jours > 1 ? 's' : ''}`
}

export function RegistreArdoise(props: {
  readonly glyphe: string
  readonly etat: EtatArdoise
  readonly ctx: RenderContext
  readonly onChange: (etat: EtatArdoise) => void
  readonly onDiffuser: (batir: BatirPartage) => void
  readonly ongletInitial?: OngletArdoise
}): JSX.Element {
  const [onglet, setOnglet] = useState<OngletArdoise>(props.ongletInitial ?? 'Encours')
  const [question, setQuestion] = useState('')
  const [nouveauNom, setNouveauNom] = useState('')
  const [nouveauMontant, setNouveauMontant] = useState('')
  const [nouveauTel, setNouveauTel] = useState('')

  const etat = props.etat
  const vues = vueDettes(etat, props.ctx.maintenant)
  const t = totaux(vues)
  const affichees = ordonner(chercher(vues, question))

  function ajouter(): void {
    const montant = Number.parseInt(nouveauMontant.replace(/\s/g, ''), 10)
    if (nouveauNom.trim() === '' || !Number.isFinite(montant)) return
    props.onChange(ajouterDette(etat, nouveauNom, montant, props.ctx.maintenant, nouveauTel))
    setNouveauNom('')
    setNouveauMontant('')
    setNouveauTel('')
  }

  return (
    <CoquilleOutil
      titre={etat.nom}
      glyphe={props.glyphe}
      sousTitre={etat.boutique}
      kpis={[
        { libelle: 'Encours', valeur: montantF(t.encours) },
        { libelle: 'Recouvré', valeur: montantF(t.recouvre) },
        { libelle: 'Clients', valeur: String(t.ouverts) },
      ]}
      onglets={ONGLETS}
      ongletCourant={onglet}
      onOnglet={setOnglet}
    >
      {onglet === 'Encours' && (
        <>
          {/*
            * La recherche n'apparaît qu'à partir du moment où la liste ne tient
            * plus d'un coup d'œil. Sur cinq lignes, un champ de recherche est
            * un obstacle de plus entre le pouce et le bouton « doit ».
            */}
          {etat.dettes.length > 8 && (
            <div class="outil-formulaire">
              <input
                type="search"
                value={question}
                placeholder="Chercher un client"
                aria-label="Chercher un client"
                onInput={(e) => setQuestion((e.target as HTMLInputElement).value)}
              />
            </div>
          )}

          {etat.dettes.length === 0 ? (
            <Vide>Aucune dette pour l’instant. Ajoute la première ci-dessous.</Vide>
          ) : affichees.length === 0 ? (
            <Vide>Aucun client ne porte ce nom.</Vide>
          ) : (
            <Rangees>
              {affichees.map((v) => (
                <Rangee key={`${v.index}-${v.client}`}>
                  {/*
                    * Pas d'avatar, et le montant ne partage pas la rangée avec
                    * un bouton de retrait. Sur 390 px, une ardoise portait
                    * « Adèle… » et « Rosal… » : un cahier de dettes où on ne
                    * lit pas le nom du client ne sert à rien. Les initiales
                    * répètent le nom, et le retrait n'est pas un geste
                    * quotidien — il attend que la ligne soit soldée.
                    */}
                  <Identite nom={v.client} detail={etatDette(v)} avatar={false} />
                  <Montant ton={v.regle ? 'regle' : v.enRetard ? 'retard' : 'neutre'}>
                    {montantF(v.montant)}
                  </Montant>
                  {v.regle ? (
                    <button
                      type="button"
                      class="outil-retirer"
                      aria-label={`Retirer ${v.client} de l’ardoise`}
                      onClick={() => props.onChange(retirerDette(etat, v.index))}
                    >
                      ×
                    </button>
                  ) : null}
                  <button
                    type="button"
                    class="outil-bascule"
                    aria-pressed={v.regle}
                    aria-label={`${v.client} : ${v.regle ? 'a réglé' : 'doit encore'}`}
                    onClick={() =>
                      props.onChange(basculerReglee(etat, v.index, props.ctx.maintenant))
                    }
                  >
                    {v.regle ? 'réglé' : 'doit'}
                  </button>
                </Rangee>
              ))}
            </Rangees>
          )}

          <div class="outil-formulaire">
            <input
              type="text"
              value={nouveauNom}
              placeholder="Nom du client"
              aria-label="Nom du client"
              onInput={(e) => setNouveauNom((e.target as HTMLInputElement).value)}
            />
            <input
              type="text"
              inputMode="numeric"
              value={nouveauMontant}
              placeholder="Montant dû"
              aria-label="Montant dû"
              onInput={(e) => setNouveauMontant((e.target as HTMLInputElement).value)}
            />
            <input
              type="tel"
              value={nouveauTel}
              placeholder="Téléphone (facultatif)"
              aria-label="Téléphone du client"
              onInput={(e) => setNouveauTel((e.target as HTMLInputElement).value)}
            />
          </div>

          <Actions>
            <Action principale onClick={() => props.onDiffuser((c) => ardoise.share(etat, c))}>
              Diffuser
            </Action>
            <Action onClick={ajouter}>Ajouter</Action>
          </Actions>

          <div class="outil-legende">
            Total encours <strong>{montantF(t.encours)}</strong>
            {t.enRetard > 0 &&
              ` · ${t.enRetard} client${t.enRetard > 1 ? 's' : ''} au-delà de 30 jours`}
          </div>
        </>
      )}

      {onglet === 'Analyse' && (
        <>
          <Barre part={t.part} legende={`${montantF(t.recouvre)} recouvrés`} />

          <Surtitre>Encours par ancienneté</Surtitre>
          <Histogramme
            titre="Encours par ancienneté"
            donnees={vieillissement(vues).map((tr) => ({
              etiquette: tr.libelle,
              valeur: tr.montant,
            }))}
          />

          <Rangees>
            {vieillissement(vues).map((tr) => (
              <Rangee key={tr.libelle}>
                {/* Une tranche d'ancienneté n'est pas quelqu'un : « 0–15 j »
                  * donnait un jeton d'initiales « 0J ». */}
                <Identite
                  nom={tr.libelle}
                  detail={`${tr.clients} client${tr.clients > 1 ? 's' : ''}`}
                  avatar={false}
                />
                <Montant ton={tr.libelle === '+30 j' && tr.montant > 0 ? 'retard' : 'neutre'}>
                  {montantF(tr.montant)}
                </Montant>
              </Rangee>
            ))}
          </Rangees>

          {/*
            * La part critique se dit en pourcentage : « 240 000 F au-delà de
            * trente jours » ne se compare à rien, « 62 % de l'encours » se
            * compare à la semaine dernière.
            */}
          <div class="outil-legende">
            {t.encours === 0
              ? 'Rien d’ouvert : il n’y a rien à vieillir.'
              : `${Math.round((vieillissement(vues)[2]?.montant ?? 0) / t.encours * 100)} % de l’encours a plus de trente jours.`}
          </div>
        </>
      )}
    </CoquilleOutil>
  )
}
