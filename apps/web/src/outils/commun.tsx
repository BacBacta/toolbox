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

/**
 * Ce qui manque au document pour passer un contrôle.
 *
 * Les mentions manquantes s'énumèrent au lieu de se lire en prose : sept
 * mentions dans une phrase font cinq lignes de rouge dont on ne retient rien,
 * alors qu'une liste se pointe du doigt et se coche des yeux.
 *
 * Et l'encart porte le geste qui le fait disparaître. Un écran qui dit « il
 * manque ton NIU » sans emmener là où on le saisit laisse l'utilisateur
 * chercher l'onglet lui-même.
 *
 * `consequence` n'a pas de valeur par défaut, et c'est délibéré : ce qu'on
 * risque à laisser une mention vide n'est pas le même sur une facture, sur une
 * attestation et sur un acte entre deux personnes. Une phrase par défaut a
 * déjà fait dire à une reconnaissance de dette qu'« un client qui veut
 * déduire » ne pourrait pas s'en servir, alors qu'il n'y a ni client ni TVA.
 */
export function Manquements(props: {
  readonly manquements: readonly Manquement[]
  readonly consequence: string
  readonly onCompleter?: () => void
}): JSX.Element | null {
  const bloquants = props.manquements.filter((m) => m.gravite === 'bloquant')
  const avertissements = props.manquements.filter((m) => m.gravite === 'avertissement')
  if (bloquants.length === 0 && avertissements.length === 0) return null

  return (
    <div class={bloquants.length > 0 ? 'alerte' : 'note'}>
      {bloquants.length > 0 && (
        <>
          <p>
            Il manque {bloquants.length === 1 ? 'une mention' : `${bloquants.length} mentions`}.{' '}
            {props.consequence}
          </p>
          <ul>
            {bloquants.map((m) => (
              <li key={m.libelle}>{m.libelle}</li>
            ))}
          </ul>
        </>
      )}
      {avertissements.length > 0 && (
        <p>À vérifier : {avertissements.map((m) => m.libelle).join(', ')}.</p>
      )}
      {props.onCompleter !== undefined && (
        <button type="button" class="alerte-action" onClick={props.onCompleter}>
          Compléter le document
        </button>
      )}
    </div>
  )
}

export type OngletDocument = 'Document' | 'Modifier'

/**
 * L'onglet d'ouverture d'un document.
 *
 * Un document qu'on vient de créer s'ouvre sur le formulaire : l'onglet
 * Document lui montrerait une page blanche surmontée de la liste des sept
 * mentions qui manquent — un reproche avant le premier geste. Une fois
 * l'entreprise saisie, il y a quelque chose à regarder, et c'est le document
 * qui prend la main.
 *
 * L'état arrive brut, avant validation : ce choix se fait au premier rendu,
 * donc avant qu'on sache s'il est conforme.
 */
export function ongletDOuverture(etat: unknown): OngletDocument {
  const doc = etat as { emetteur?: { nom?: unknown } } | null
  const nom = doc?.emetteur?.nom
  return typeof nom === 'string' && nom.trim() !== '' ? 'Document' : 'Modifier'
}

export function CadreDocument(props: {
  readonly titre: string
  readonly glyphe: string
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
          <div class="outil-pastille" aria-hidden="true">
            {props.glyphe}
          </div>
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
