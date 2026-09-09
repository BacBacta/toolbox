import type { Comprehension, Extrait, FicheSquelette } from '@a237/engine'
import { comprendre, montantF } from '@a237/engine'
import type { JSX } from 'preact'
import { useState } from 'preact/hooks'

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
  readonly onCreer: (skeleton: string, extrait: Extrait) => void
}

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

  function repondre(texte: string): void {
    setDemande(texte)
    setReponse(texte.trim() === '' ? null : comprendre(texte, props.fiches))
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

      {reponse?.sorte === 'hors-portee' && (
        <div class="atelier-reponse">
          <p class="atelier-dit">
            Je ne sais pas encore faire ça. Voilà ce que je sais faire — ou décris-le
            autrement.
          </p>
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
