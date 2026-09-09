import { initiales } from '@a237/engine'
import type { ComponentChildren, JSX } from 'preact'

/**
 * Les pièces communes aux registres interactifs.
 *
 * Cibles : Android d'entrée de gamme, Chrome, doigt. Les zones tactiles font
 * 44 px de côté minimum et rien ne dépend du survol — sur un téléphone il
 * n'existe pas.
 */

export interface Kpi {
  readonly libelle: string
  readonly valeur: string
}

export function CoquilleOutil<O extends string>(props: {
  readonly titre: string
  /**
   * Le signe du catalogue. Il vient de la coquille, qui a déjà le catalogue en
   * mémoire, et non des initiales du nom : l'utilisateur baptise ses outils
   * comme il veut, et « Boutique Douala » comme « Boulangerie Deido » donnent
   * « BD ». Le glyphe, lui, reste le même repère d'un écran à l'autre.
   */
  readonly glyphe: string
  readonly sousTitre: string
  readonly kpis: readonly Kpi[]
  readonly onglets: readonly O[]
  readonly ongletCourant: O
  readonly onOnglet: (onglet: O) => void
  readonly children: ComponentChildren
}): JSX.Element {
  return (
    <section class="outil">
      <header class="outil-entete">
        <div class="outil-identite">
          <div class="outil-pastille" aria-hidden="true">
            {props.glyphe}
          </div>
          <div class="outil-titre">
            <b>{props.titre}</b>
            {/*
              * Un outil qu'on vient de créer porte le nom de son type : afficher
              * « Frais scolaires » sous « Frais scolaires » n'apprend rien.
              */}
            {props.sousTitre !== '' && props.sousTitre !== props.titre && (
              <span>{props.sousTitre}</span>
            )}
          </div>
        </div>

        {props.kpis.length > 0 && (
          <div class="outil-kpis">
            {props.kpis.map((k) => (
              <div class="outil-kpi" key={k.libelle}>
                <span class="k">{k.libelle}</span>
                <span class="v">{k.valeur}</span>
              </div>
            ))}
          </div>
        )}

        {/*
          * Un seul onglet, ce n'est pas une barre d'onglets : c'est un titre
          * redondant qui prend une ligne et un tour de lecture pour rien.
          */}
        {props.onglets.length > 1 && (
        <div class="outil-onglets" role="tablist">
          {props.onglets.map((o) => (
            <button
              type="button"
              role="tab"
              key={o}
              aria-selected={o === props.ongletCourant}
              onClick={() => props.onOnglet(o)}
            >
              {o}
            </button>
          ))}
        </div>
        )}
      </header>

      <div class="outil-corps" role="tabpanel">
        {props.children}
      </div>
    </section>
  )
}

/**
 * Barre d'avancement. `part` est bornée à 0–1 : une collecte ne dépasse pas.
 *
 * `montrerPourcent` existe parce que certaines légendes portent déjà le
 * pourcentage — « 40 % réglé » — et « 40 % · 40 % réglé » était du bégaiement.
 */
export function Barre(props: {
  readonly part: number
  readonly legende: string
  readonly montrerPourcent?: boolean
}): JSX.Element {
  const pourcent = Math.round(Math.max(0, Math.min(1, props.part)) * 100)
  const montrerPourcent = props.montrerPourcent ?? true
  return (
    <div>
      <div
        class="outil-barre"
        role="progressbar"
        aria-valuenow={pourcent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <i style={{ width: `${pourcent}%` }} />
      </div>
      <div class="outil-legende">
        {montrerPourcent && `${pourcent} %`}
        {montrerPourcent && props.legende !== '' && ' · '}
        {props.legende}
      </div>
    </div>
  )
}

export function Rangees(props: { readonly children: ComponentChildren }): JSX.Element {
  return <div class="outil-rangees">{props.children}</div>
}

export function Rangee(props: { readonly children: ComponentChildren }): JSX.Element {
  return <div class="outil-rangee">{props.children}</div>
}

/**
 * Nom, ligne de détail au-dessous, et la pastille d'initiales quand la ligne
 * nomme quelqu'un.
 *
 * `avatar` est faux pour un article ou une écriture de caisse : trente-six
 * pixels plus une gouttière, c'est un huitième de la largeur d'un téléphone
 * d'entrée de gamme, pris au nom qui, lui, doit se lire en entier.
 */
export function Identite(props: {
  readonly nom: string
  readonly detail: string
  readonly avatar?: boolean
}): JSX.Element {
  return (
    <div class="identite">
      {props.avatar !== false && (
        <span class="ini" aria-hidden="true">
          {initiales(props.nom)}
        </span>
      )}
      <span class="nom">
        <span class="n1">{props.nom}</span>
        {props.detail !== '' && <span class="n2">{props.detail}</span>}
      </span>
    </div>
  )
}

export type TonBadge = 'oui' | 'non' | 'tour' | 'neutre'

export function Badge(props: {
  readonly ton: TonBadge
  readonly children: ComponentChildren
}): JSX.Element {
  return <span class={`outil-badge ${props.ton}`}>{props.children}</span>
}

export function Montant(props: {
  readonly ton: 'regle' | 'retard' | 'neutre'
  readonly children: ComponentChildren
}): JSX.Element {
  return <span class={`outil-montant ${props.ton}`}>{props.children}</span>
}

export function Actions(props: { readonly children: ComponentChildren }): JSX.Element {
  return <div class="outil-actions">{props.children}</div>
}

export function Action(props: {
  readonly principale?: boolean
  readonly onClick: () => void
  readonly children: ComponentChildren
}): JSX.Element {
  return (
    <button
      type="button"
      class={props.principale === true ? 'outil-action principale' : 'outil-action'}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  )
}

export function Vide(props: { readonly children: ComponentChildren }): JSX.Element {
  return <div class="outil-vide">{props.children}</div>
}

export function Surtitre(props: { readonly children: ComponentChildren }): JSX.Element {
  return <div class="outil-surtitre">{props.children}</div>
}
