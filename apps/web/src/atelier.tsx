import type { Comprehension, Extrait, FicheSquelette } from '@a237/engine'
import {
  CE_QUE_COUTE, EXTRAIT_VIDE, ID_COMPOSE, ID_COMPOSE_CALCUL, comprendre, etageDe, montantF,
} from '@a237/engine'
import type { JSX } from 'preact'
import { useState } from 'preact/hooks'
import { composer } from './composer.js'
import type { Compose } from './outils.js'

/**
 * L'atelier : on dit ce dont on a besoin, l'outil s'ouvre.
 *
 * C'est l'étage 1 du brief rendu conversationnel (§ 4) — **zéro jeton, hors
 * ligne, instantané**. Une boîte de recherche filtrait une grille ; ici la
 * demande est lue, l'outil est ouvert, et ce que la phrase disait déjà y est
 * déjà écrit.
 *
 * Trois réponses possibles, et la troisième compte autant que les deux
 * premières :
 *
 * - **Sûr** — un squelette se détache, on l'ouvre.
 * - **Ambigu** — plusieurs répondent, on demande. Ouvrir d'autorité le mauvais
 *   outil fait perdre plus de temps qu'une question : il faut comprendre ce
 *   qui s'est passé, revenir, recommencer. Une question coûte un tapotement.
 * - **Hors de portée** — aucun mot ne mord. On le dit franchement au lieu de
 *   renvoyer une grille vide, et on nomme ce qu'on sait faire. Les étages 2 et
 *   3, qui feraient composer un outil par le modèle, passent par le proxy du
 *   Worker (§ 3.1) : tant qu'il n'existe pas, promettre serait mentir.
 */

export interface ProprietesAtelier {
  readonly fiches: readonly FicheSquelette[]
  /**
   * `fcfa` est ce que la composition a coûté. Il ne sert pas à décorer : la
   * consommation se paie à l'appel, et une dépense qu'on ne voit pas est une
   * dépense qu'on découvre à la fin du mois.
   */
  readonly onCreer: (
    skeleton: string,
    extrait: Extrait,
    compose?: Compose,
    fcfa?: number,
  ) => void
}

type Composition =
  | 'repos'
  | 'en-cours'
  | 'pas-ouvert'
  | 'sans-credit'
  | { readonly abonnement: string }
  | { readonly echoue: string }
  | { readonly horsSujet: string }

/**
 * Des exemples qui montrent ce qu'une phrase peut porter, pas seulement le nom
 * d'un outil : le premier prouve qu'un montant et une période sont entendus.
 *
 * Courts exprès. Sur 390 px, quatre exemples longs font quatre lignes et
 * repoussent la grille sous le pli — on cacherait les outils pour montrer
 * comment les demander.
 */
const EXEMPLES: readonly string[] = [
  'njangi de 20 000 F par mois',
  'une facture',
  'liste de prix',
  'partager une course',
]

export function Atelier(props: ProprietesAtelier): JSX.Element {
  const [demande, setDemande] = useState('')
  const [reponse, setReponse] = useState<Comprehension | null>(null)
  const [composition, setComposition] = useState<Composition>('repos')

  function repondre(texte: string): void {
    setDemande(texte)
    setComposition('repos')
    setReponse(texte.trim() === '' ? null : comprendre(texte, props.fiches))
  }

  /**
   * L'étage 2 : le modèle compose un registre que l'étage 1 ne connaissait pas.
   *
   * Il ne part que sur un geste — jamais en tapant. Chaque appel coûte de
   * l'argent (§ 8, moins d'un franc la génération), et lancer une génération à
   * chaque frappe brûlerait un budget pour des phrases inachevées.
   */
  function reussi(): void {
    setComposition('repos')
    setDemande('')
    setReponse(null)
  }

  function faireComposer(): void {
    setComposition('en-cours')
    void composer(demande).then((r) => {
      if (r.sorte === 'compose') {
        reussi()
        props.onCreer(ID_COMPOSE, EXTRAIT_VIDE, { registre: r.registre }, r.fcfa)
      } else if (r.sorte === 'calcule') {
        reussi()
        props.onCreer(ID_COMPOSE_CALCUL, EXTRAIT_VIDE, { calcul: r.calcul }, r.fcfa)
      } else if (r.sorte === 'pas-ouvert') {
        setComposition('pas-ouvert')
      } else if (r.sorte === 'sans-credit') {
        setComposition('sans-credit')
      } else if (r.sorte === 'abonnement-requis') {
        setComposition({ abonnement: r.pourquoi })
      } else if (r.sorte === 'hors-sujet') {
        setComposition({ horsSujet: r.pourquoi })
      } else {
        setComposition({ echoue: r.pourquoi })
      }
    })
  }

  function ouvrir(fiche: FicheSquelette, extrait: Extrait): void {
    setDemande('')
    setReponse(null)
    props.onCreer(fiche.id, extrait)
  }

  return (
    <section class="atelier">
      <form
        class="atelier-demande"
        onSubmit={(e) => {
          e.preventDefault()
          const r = reponse
          // Entrée ouvre directement quand il n'y a pas de doute : c'est le
          // chemin de quelqu'un qui sait ce qu'il veut et tape vite.
          if (r?.sorte === 'sur') ouvrir(r.fiche, r.extrait)
        }}
      >
        <label class="champ" for="demande">
          <span class="champ-libelle">De quoi as-tu besoin ?</span>
          <input
            id="demande"
            type="text"
            enterkeyhint="go"
            autocomplete="off"
            value={demande}
            placeholder="njangi de 20 000 F par mois…"
            onInput={(e) => repondre((e.target as HTMLInputElement).value)}
          />
        </label>
      </form>

      {reponse === null && (
        <div class="atelier-exemples">
          {EXEMPLES.map((e) => (
            <button type="button" class="atelier-exemple" key={e} onClick={() => repondre(e)}>
              {e}
            </button>
          ))}
        </div>
      )}

      {reponse?.sorte === 'sur' && (
        <Proposition fiche={reponse.fiche} extrait={reponse.extrait} onOuvrir={ouvrir} />
      )}

      {reponse?.sorte === 'ambigu' && (
        <div class="atelier-reponse">
          <p class="atelier-dit">Lequel veux-tu ?</p>
          <div class="atelier-choix">
            {reponse.fiches.map((f) => (
              <button
                type="button"
                class="atelier-option"
                key={f.id}
                onClick={() => ouvrir(f, reponse.extrait)}
              >
                <span class="marque" aria-hidden="true">{f.glyphe}</span>
                <b>{f.title}</b>
              </button>
            ))}
          </div>
        </div>
      )}

      {reponse?.sorte === 'plusieurs' && (
        <div class="atelier-reponse">
          <p class="atelier-dit">
            Ça fait plusieurs outils d’un coup. Demande-les un par un — chacun coûte
            quelques centimes — ou prends un abonnement.
          </p>
        </div>
      )}

      {reponse?.sorte === 'hors-portee' && (
        <div class="atelier-reponse">
          <p class="atelier-dit">
            Aucun de mes outils ne correspond. Je peux en composer un — un registre
            avec tes colonnes, ou une calculatrice avec tes champs.
          </p>

          {composition === 'repos' && (
            <button type="button" class="atelier-option principale" onClick={faireComposer}>
              <span class="marque" aria-hidden="true">✳</span>
              <span class="texte">
                <b>Compose-le pour moi</b>
                {/*
                  * Le prix se dit avant le clic, pas après.
                  *
                  * L'étage se calcule ici, gratuitement et sans réseau : c'est
                  * ce qui permet d'annoncer un prix plutôt qu'une facture. Le
                  * serveur le recalcule et tranche — un prix qu'on peut
                  * contourner depuis le navigateur n'est pas un prix.
                  */}
                <span>{CE_QUE_COUTE[etageDe(demande, props.fiches)]}</span>
              </span>
            </button>
          )}

          {composition === 'en-cours' && <p class="note">Je compose…</p>}

          {typeof composition === 'object' && 'abonnement' in composition && (
            <p class="note">
              {composition.abonnement === ''
                ? 'Cette demande vaut plusieurs outils d’un coup.'
                : composition.abonnement}
            </p>
          )}

          {composition === 'sans-credit' && (
            <p class="note">
              Il n’y a plus de crédit pour composer. Les outils que tu as déjà continuent
              de marcher, et ceux de la liste ci-dessous s’ouvrent sans rien coûter.
            </p>
          )}

          {composition === 'pas-ouvert' && (
            <p class="note">
              La composition n’est pas encore ouverte. En attendant, prends l’outil le plus
              proche dans la liste ci-dessous.
            </p>
          )}

          {typeof composition === 'object' && 'horsSujet' in composition && (
            // Le modèle a dit non. On le rapporte tel quel plutôt que de
            // proposer de réessayer : la réponse ne changera pas, et chaque
            // essai coûte.
            <p class="note">{composition.horsSujet}</p>
          )}

          {typeof composition === 'object' && 'echoue' in composition && (
            <p class="note">Je n’ai pas pu composer — {composition.echoue}. Réessaie ?</p>
          )}
        </div>
      )}
    </section>
  )
}

/**
 * Ce qu'on a compris, dit avant d'ouvrir.
 *
 * Le résumé n'est pas décoratif : il montre que « 20 000 F » a bien été
 * entendu comme la cotisation. S'il se trompe, ça se voit avant le clic et non
 * après, quand il faudrait défaire.
 */
function Proposition(props: {
  readonly fiche: FicheSquelette
  readonly extrait: Extrait
  readonly onOuvrir: (fiche: FicheSquelette, extrait: Extrait) => void
}): JSX.Element {
  const retenu = resumer(props.extrait)
  return (
    <div class="atelier-reponse">
      <button
        type="button"
        class="atelier-option principale"
        onClick={() => props.onOuvrir(props.fiche, props.extrait)}
      >
        <span class="marque" aria-hidden="true">{props.fiche.glyphe}</span>
        <span class="texte">
          <b>Ouvrir {props.fiche.title.toLowerCase()}</b>
          {retenu !== '' && <span>{retenu}</span>}
        </span>
      </button>
    </div>
  )
}

/**
 * Ce que la phrase a donné, en français. Vide quand elle n'a rien donné.
 *
 * Le montant passe par `montantF`, comme partout ailleurs. `toLocaleString`
 * écrivait la même somme autrement — espace fine au lieu d'insécable, selon
 * l'ICU du téléphone — et la même valeur se serait lue de deux façons entre
 * cet écran et celui d'à côté.
 */
function resumer(extrait: Extrait): string {
  const bouts: string[] = []
  const somme = extrait.montants[0]
  if (somme !== undefined) bouts.push(montantF(somme))
  if (extrait.periode !== null) bouts.push(`par ${extrait.periode}`)
  if (extrait.compte !== null) bouts.push(`${extrait.compte} personnes`)
  if (extrait.pourcent !== null) bouts.push(`${extrait.pourcent} %`)
  return bouts.join(' · ')
}
