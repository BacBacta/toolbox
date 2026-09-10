import type { Comprehension, Etage, Extrait, FicheSquelette } from '@a237/engine'
import { CE_QUE_COUTE, comprendre, etageDe, montantF } from '@a237/engine'
import type { JSX } from 'preact'
import { useRef, useState } from 'preact/hooks'

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
  /**
   * Ouvrir la conversation avec l'agent, la phrase déjà tapée en main.
   *
   * L'atelier ne compose plus lui-même. Un bouton qui lançait une génération
   * et rendait un outil marchait, mais il ne laissait aucune place à la
   * deuxième phrase — et personne ne décrit du premier coup l'outil qu'il
   * veut.
   */
  readonly onDiscuter: (demande: string) => void
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
  const champ = useRef<HTMLInputElement | null>(null)

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
            ref={champ}
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

      {/*
        * Ce que l'atelier sait faire quand la grille ne suffit pas, dit avant
        * qu'on ait tapé quoi que ce soit.
        *
        * L'agent n'apparaissait qu'**après** une saisie : il fallait deviner
        * qu'il existe pour le trouver. Une capture d'un vrai téléphone l'a
        * montré — la personne qui l'avait commandé ne le voyait pas sur son
        * écran d'accueil, et concluait que rien n'avait changé. Elle avait
        * raison de le conclure : sur cet écran-là, rien n'avait changé.
        *
        * Il mène au champ plutôt que d'ouvrir la conversation : un tour se
        * paie, et une conversation ouverte sans demande n'aurait rien à
        * répondre. Le bouton conduit là où l'on décrit, et c'est la description
        * qui déclenche.
        */}
      {reponse === null && (
        <button
          type="button"
          class="atelier-sur-mesure"
          onClick={() => champ.current?.focus()}
        >
          <span class="marque" aria-hidden="true">✳</span>
          <span class="texte">
            <b>Ton outil n’est pas dans la liste ?</b>
            <span>Décris-le en français : l’atelier le fabrique sur mesure, en discutant.</span>
          </span>
        </button>
      )}

      {reponse?.sorte === 'sur' && (
        <>
          <Proposition fiche={reponse.fiche} extrait={reponse.extrait} onOuvrir={ouvrir} />
          <EnParler demande={demande} fiches={props.fiches} onDiscuter={props.onDiscuter} />
        </>
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
          <EnParler demande={demande} fiches={props.fiches} onDiscuter={props.onDiscuter} />
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
            Aucun de mes outils ne correspond. On en fabrique un ensemble — un registre,
            une calculatrice, une page à envoyer sur WhatsApp, ou un formulaire qui
            ramasse les réponses.
          </p>

          <EnParler
            demande={demande}
            fiches={props.fiches}
            onDiscuter={props.onDiscuter}
            principale
          />
        </div>
      )}

    </section>
  )
}

/**
 * La porte de l'atelier, et elle reste ouverte partout.
 *
 * Elle n'apparaissait que quand aucun outil ne correspondait. « Un menu pour
 * mon restaurant » tombe sur « liste de prix » — un bon rapprochement, gratuit
 * et immédiat, qui garde donc la première place. Mais quelqu'un qui voulait
 * une vraie page de menu, avec ses rubriques, n'avait aucun moyen de le dire :
 * il n'y avait qu'un bouton, et il menait ailleurs.
 *
 * L'outil qui correspond reste en tête, parce qu'il ne coûte rien et qu'il
 * s'ouvre tout de suite. La conversation est en dessous, et se paie — d'où le
 * prix, dit avant le clic.
 */
/**
 * Ce que coûte la conversation, et jamais moins que ce qu'elle coûte.
 *
 * `etageDe` rend l'étage 1 — « gratuit, et ça marche hors ligne » — dès qu'un
 * squelette se détache de la demande, et c'est exact : ce squelette-là est
 * gratuit. Ça ne l'est pas de ce bouton-ci, qui appelle le modèle et prend un
 * crédit. Tant que la conversation n'apparaissait qu'à défaut d'outil, la
 * question ne se posait pas ; elle apparaît maintenant à côté d'eux.
 */
function prixDeLaConversation(
  demande: string,
  fiches: readonly FicheSquelette[],
): Exclude<Etage, 1> {
  const etage = etageDe(demande, fiches)
  return etage === 1 ? 2 : etage
}

function EnParler(props: {
  readonly demande: string
  readonly fiches: readonly FicheSquelette[]
  readonly onDiscuter: (demande: string) => void
  readonly principale?: boolean
}): JSX.Element {
  return (
    <button
      type="button"
      class={props.principale === true ? 'atelier-option principale' : 'atelier-option'}
      onClick={() => props.onDiscuter(props.demande)}
    >
      <span class="marque" aria-hidden="true">✳</span>
      <span class="texte">
        <b>En parler à l’atelier</b>
        {/*
          * Le prix se dit avant le clic, pas après.
          *
          * L'étage se calcule ici, gratuitement et sans réseau : c'est ce qui
          * permet d'annoncer un prix plutôt qu'une facture. Le serveur le
          * recalcule et tranche — un prix qu'on peut contourner depuis le
          * navigateur n'est pas un prix.
          */}
        <span>{CE_QUE_COUTE[prixDeLaConversation(props.demande, props.fiches)]}</span>
      </span>
    </button>
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
