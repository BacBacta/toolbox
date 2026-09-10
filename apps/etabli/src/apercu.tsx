import type { Projet } from '@a237/etabli'
import { BAC_A_SABLE, lireMessageDApercu, pourApercu } from '@a237/etabli'
import type { JSX } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import type { MessageApercu } from '@a237/etabli'

/**
 * Ce que le code fait, et ce qu'il dit.
 *
 * Le cadre est isolé — voir `BAC_A_SABLE` : sans `allow-same-origin`, le code
 * exécuté ici n'atteint ni le stockage de l'Établi, ni ses cookies, ni son DOM.
 * C'est ce qui rend acceptable d'ouvrir un projet reçu de quelqu'un d'autre.
 *
 * La console en dessous n'est pas un ornement. Sur un ordinateur, une erreur
 * s'ouvre dans les outils du navigateur ; sur un Android d'entrée de gamme il
 * n'y a ni touche F12 ni outils, et une page blanche ressemble exactement à une
 * page qui charge. Sans cet écran-là, quelqu'un qui apprend conclut qu'il n'y
 * arrive pas, alors qu'il lui manquait une virgule.
 */

export function Apercu(props: {
  readonly projet: Projet
  /** Change à chaque « Lancer » : c'est ce qui force le cadre à repartir de zéro. */
  readonly tour: number
}): JSX.Element {
  const cadre = useRef<HTMLIFrameElement | null>(null)
  const [journal, setJournal] = useState<readonly MessageApercu[]>([])
  const [ouverte, setOuverte] = useState(false)

  // Chaque lancement repart d'une console vide : mélanger deux exécutions fait
  // chercher une erreur qu'on vient déjà de corriger.
  useEffect(() => setJournal([]), [props.tour])

  useEffect(() => {
    function recevoir(e: MessageEvent): void {
      /*
       * L'identité du cadre, et non l'origine du message.
       *
       * Le cadre n'a pas d'origine — c'est le prix de l'isolement, et son
       * message arrive donc avec « null ». Ce qui l'identifie est sa fenêtre :
       * n'importe quelle page, n'importe quelle extension peut poster dans
       * celle-ci, et sans cette ligne leur texte s'afficherait comme s'il
       * venait du code de la personne.
       */
      if (cadre.current === null || e.source !== cadre.current.contentWindow) return
      const message = lireMessageDApercu(e.data)
      if (message === null) return
      setJournal((j) => [...j, message].slice(-MAX_LIGNES))
    }
    addEventListener('message', recevoir)
    return () => removeEventListener('message', recevoir)
  }, [])

  const erreurs = journal.filter((m) => m.sorte === 'erreur').length

  return (
    <div class="apercu">
      <iframe
        /*
         * La clef porte le numéro du tour, et c'est elle qui fait repartir le
         * code.
         *
         * Sans elle, le cadre est réutilisé d'un rendu à l'autre : « Relancer »
         * sans avoir rien changé laissait exactement le même document en place,
         * et ne relançait rien. C'est pourtant le geste qu'on fait quand une
         * animation est finie, qu'un tirage au sort a donné le même résultat,
         * ou simplement pour réessayer. Une clef différente, et le navigateur
         * jette le cadre et en construit un neuf.
         */
        key={props.tour}
        ref={cadre}
        class="apercu-cadre"
        title="Ton code en train de tourner"
        sandbox={BAC_A_SABLE}
        srcdoc={pourApercu(props.projet)}
      />

      <button
        type="button"
        class={erreurs > 0 ? 'console-titre a-des-erreurs' : 'console-titre'}
        onClick={() => setOuverte((o) => !o)}
      >
        <span>{ouverte ? '▾' : '▸'} Console</span>
        <span class="console-compte">
          {erreurs > 0 ? `${erreurs} erreur${erreurs > 1 ? 's' : ''}` : `${journal.length}`}
        </span>
      </button>

      {ouverte && (
        <div class="console" role="log">
          {journal.length === 0 ? (
            <p class="console-vide">
              Rien pour l’instant. Écris <code>console.log("salut")</code> pour voir.
            </p>
          ) : (
            journal.map((m, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <p key={i} class={m.sorte === 'erreur' ? 'console-ligne erreur' : 'console-ligne'}>
                {m.texte}
              </p>
            ))
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Deux cents lignes gardées, les plus récentes.
 *
 * Une boucle qui journalise en écrit des milliers en une seconde. Toutes les
 * garder ferait ramer l'écran de celui qui essaie justement de comprendre
 * pourquoi sa boucle s'emballe — et c'est la fin de la ligne qui l'intéresse.
 */
const MAX_LIGNES = 200
