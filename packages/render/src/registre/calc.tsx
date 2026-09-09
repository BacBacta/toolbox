import type { ConfigCalc, EtatCalc, RenderContext, ShareSpec } from '@a237/engine'
import {
  changerValeur, montantF, nf, partCalc, precisionCalc, resultatCalc, valeurDe,
} from '@a237/engine'
import type { JSX } from 'preact'
import { Action, Actions, Barre, CoquilleOutil } from './chrome.js'

/**
 * L'écran d'une calculatrice.
 *
 * Pas d'onglet, pas de liste : on ouvre, on tape, on lit. Ces outils se sortent
 * au comptoir entre deux clients — tout ce qui s'interpose entre la saisie et
 * le résultat est de trop.
 */

function afficher(valeur: number, unite: 'F' | ''): string {
  return unite === 'F' ? montantF(valeur) : nf(valeur)
}

export function Calculatrice(props: {
  readonly config: ConfigCalc
  readonly titre: string
  readonly etat: EtatCalc
  readonly ctx: RenderContext
  readonly onChange: (etat: EtatCalc) => void
  readonly onDiffuser: (partage: ShareSpec) => void
  readonly partage: (etat: EtatCalc, ctx: RenderContext) => ShareSpec
}): JSX.Element {
  const { config, etat } = props
  const resultat = resultatCalc(config, etat)
  const precision = precisionCalc(config, etat)
  const part = partCalc(config, etat)

  function changer(clef: string, brut: string): void {
    const nombre = Number(brut.replace(/\s/g, '').replace(',', '.'))
    // Une saisie illisible ramène à zéro plutôt que de figer l'écran sur NaN.
    props.onChange(changerValeur(etat, clef, Number.isFinite(nombre) && nombre >= 0 ? nombre : 0))
  }

  return (
    <CoquilleOutil
      titre={etat.nom}
      sousTitre={props.titre}
      kpis={[{ libelle: config.sortie.libelle, valeur: afficher(resultat, config.sortie.unite) }]}
      onglets={['Calcul'] as const}
      ongletCourant="Calcul"
      onOnglet={() => undefined}
    >
      <div class="calc-resultat" role="status" aria-live="polite">
        <span class="calc-libelle">{config.sortie.libelle}</span>
        <span class="calc-valeur">{afficher(resultat, config.sortie.unite)}</span>
      </div>

      {part !== null && <Barre part={part} legende={precision ?? ''} />}
      {part === null && precision !== null && <p class="outil-legende">{precision}</p>}

      {config.entrees.map((e) => (
        <label class="champ" key={e.clef} for={`calc-${e.clef}`}>
          <span class="champ-libelle">
            {e.titre}
            {e.unite === 'F' ? ' (F CFA)' : ''}
          </span>
          <input
            id={`calc-${e.clef}`}
            type="text"
            inputMode="decimal"
            value={String(valeurDe(etat, e.clef))}
            onInput={(evt) => changer(e.clef, (evt.target as HTMLInputElement).value)}
          />
        </label>
      ))}

      <Actions>
        <Action principale onClick={() => props.onDiffuser(props.partage(etat, props.ctx))}>
          Diffuser
        </Action>
      </Actions>
    </CoquilleOutil>
  )
}
