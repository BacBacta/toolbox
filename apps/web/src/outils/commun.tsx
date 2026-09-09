import type { ErreurValidation, Manquement } from '@a237/engine'
import type { ComponentChildren, JSX } from 'preact'

/**
 * Ce que devis et facture partagent à l'écran. Ils ne diffèrent que par ce
 * qu'ils engagent ; leur cadre est le même.
 */

/**
 * Un état qui ne valide pas contre son schéma ne doit jamais atteindre le
 * rendu (invariant § 2.1). On le dit, on ne devine pas.
 */
export function EtatInvalide(props: { readonly erreurs: readonly ErreurValidation[] }): JSX.Element {
  // Classe à part : « ton état est cassé » et « ton document est incomplet »
  // sont deux problèmes différents, et l'un se répare, l'autre se remplit.
  return (
    <div class="alerte etat-invalide">
      <p>
        Cet outil ne correspond pas à ce que l’application sait dessiner. Rien n’a été perdu :
        l’état est toujours enregistré sur le téléphone.
      </p>
      <ul>
        {props.erreurs.slice(0, 5).map((e) => (
          <li key={e.chemin}>
            <code>{e.chemin}</code> — {e.message}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Ce qui manque au document pour passer un contrôle. */
export function Manquements(props: { readonly manquements: readonly Manquement[] }): JSX.Element | null {
  const bloquants = props.manquements.filter((m) => m.gravite === 'bloquant')
  const avertissements = props.manquements.filter((m) => m.gravite === 'avertissement')
  if (bloquants.length === 0 && avertissements.length === 0) return null

  return (
    <div class={bloquants.length > 0 ? 'alerte' : 'note'}>
      {bloquants.length > 0 && (
        <p>
          Il manque {bloquants.map((m) => m.libelle).join(', ')}. Sans ces mentions, un client qui
          veut déduire ne pourra pas s’en servir.
        </p>
      )}
      {avertissements.length > 0 && (
        <p>À vérifier : {avertissements.map((m) => m.libelle).join(', ')}.</p>
      )}
    </div>
  )
}

export type OngletDocument = 'Document' | 'Modifier'

export function CadreDocument(props: {
  readonly titre: string
  readonly sousTitre: string
  readonly onglet: OngletDocument
  readonly onOnglet: (o: OngletDocument) => void
  readonly onDiffuser: () => void
  readonly children: ComponentChildren
}): JSX.Element {
  return (
    <section class="outil">
      <header class="outil-entete">
        <div class="outil-identite">
          <div class="outil-titre">
            <b>{props.titre}</b>
            <span>{props.sousTitre}</span>
          </div>
        </div>
        <div class="outil-onglets" role="tablist">
          {(['Document', 'Modifier'] as const).map((o) => (
            <button
              type="button"
              role="tab"
              key={o}
              aria-selected={o === props.onglet}
              onClick={() => props.onOnglet(o)}
            >
              {o}
            </button>
          ))}
        </div>
      </header>
      <div class="outil-corps" role="tabpanel">
        {props.children}
        <div class="outil-actions">
          <button type="button" class="outil-action principale" onClick={props.onDiffuser}>
            Diffuser
          </button>
        </div>
      </div>
    </section>
  )
}
