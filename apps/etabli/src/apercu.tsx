import type { EnvoiPython, Langue, ManifestePython, MessageApercu, Projet, Textes } from '@a237/etabli'
import {
  BAC_A_SABLE, enMegaoctets, estProjetPython, expliquer, lireMessageDApercu,
  pourApercu, pourApercuPython,
} from '@a237/etabli'
import type { JSX } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import type { Avancement } from './python-moteur.js'
import { dejaDescendu, manifestePython, moteurPython, posterMoteur } from './python-moteur.js'

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
  readonly langue: Langue
  readonly t: Textes
}): JSX.Element {
  const cadre = useRef<HTMLIFrameElement | null>(null)
  const [journal, setJournal] = useState<readonly MessageApercu[]>([])
  const [ouverte, setOuverte] = useState(false)
  const python = estProjetPython(props.projet)
  const moteur = useMoteurPython(python)

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

  /*
   * Un projet Python n'affiche rien tant que le moteur n'est pas là.
   *
   * Le proposer avant de l'avoir serait un bouton qui échoue ; le télécharger
   * sans demander serait dépenser le forfait de quelqu'un à sa place. Entre les
   * deux, il n'y a qu'une chose honnête à faire : dire le prix.
   */
  if (python && moteur.envoi === null) {
    return (
      <div class="apercu">
        <Python moteur={moteur} langue={props.langue} t={props.t} />
      </div>
    )
  }

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
        title={props.t.cadreTitre}
        sandbox={BAC_A_SABLE}
        srcdoc={python
          ? pourApercuPython(props.projet, props.langue)
          : pourApercu(props.projet, props.langue)}
        onLoad={() => {
          /*
           * Le moteur part **après** que le cadre est là, jamais avant.
           *
           * Poster dans un cadre qui n'a pas fini de charger fait disparaître le
           * message sans erreur : l'écouteur n'existe pas encore. C'est le genre
           * de panne qui ne se reproduit que sur un téléphone lent.
           */
          if (moteur.envoi === null || cadre.current === null) return
          const fenetre = cadre.current.contentWindow
          if (fenetre !== null) posterMoteur(fenetre, moteur.envoi)
        }}
      />

      <button
        type="button"
        class={erreurs > 0 ? 'console-titre a-des-erreurs' : 'console-titre'}
        onClick={() => setOuverte((o) => !o)}
      >
        <span>{ouverte ? '▾' : '▸'} {props.t.console}</span>
        <span class="console-compte">
          {erreurs > 0 ? props.t.erreurs(erreurs) : `${journal.length}`}
        </span>
      </button>

      {ouverte && (
        <div class="console" role="log">
          {journal.length === 0 ? (
            <p class="console-vide">
              {props.t.consoleVide}{' '}
              <code>{python ? 'print("hello")' : 'console.log("hello")'}</code>{' '}
              {props.t.consoleVideExemple}
            </p>
          ) : (
            journal.map((m, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <Ligne key={i} message={m} langue={props.langue} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Une ligne de console, et sa traduction quand on la connaît.
 *
 * C'est la pièce qui change l'outil de nature. `Uncaught SyntaxError:
 * Unexpected token '{'` ne dit rien à quelqu'un qui apprend — et rien du tout
 * s'il ne lit pas l'anglais. Or c'est précisément le moment où il conclut qu'il
 * n'y arrive pas, alors qu'il lui manquait une virgule.
 *
 * Le message d'origine reste affiché au-dessus : il faudra bien le reconnaître
 * le jour où on cherchera dans un moteur de recherche, et le cacher
 * apprendrait à dépendre de l'Établi.
 */
function Ligne(props: {
  readonly message: MessageApercu
  readonly langue: Langue
}): JSX.Element {
  const brut = props.message.sorte === 'erreur' ? expliquer(props.message.texte, props.langue) : null
  return (
    <div class={props.message.sorte === 'erreur' ? 'console-ligne erreur' : 'console-ligne'}>
      <p class="console-brut">{props.message.texte}</p>
      {brut !== null && (
        <div class="console-explication">
          <p class="quoi">{brut.quoi}</p>
          <p class="faire">{brut.faire}</p>
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

/** Ce que l'écran sait de Python à un instant donné. */
interface EtatPython {
  readonly manifeste: ManifestePython | null | undefined
  readonly envoi: EnvoiPython | null
  readonly avancement: Avancement | null
  readonly echoue: boolean
  readonly descendre: () => void
}

/**
 * Python, cherché puis descendu — jamais sans qu'on l'ait demandé.
 *
 * `manifeste` vaut `undefined` tant qu'on cherche, `null` quand cette
 * installation n'a pas Python du tout. Les deux ne se confondent pas : le
 * premier est passager, le second est définitif, et afficher « indisponible »
 * pendant qu'on cherche encore ferait renoncer quelqu'un pour rien.
 */
function useMoteurPython(actif: boolean): EtatPython {
  const [manifeste, setManifeste] = useState<ManifestePython | null | undefined>(undefined)
  const [envoi, setEnvoi] = useState<EnvoiPython | null>(null)
  const [avancement, setAvancement] = useState<Avancement | null>(null)
  const [echoue, setEchoue] = useState(false)
  const [demande, setDemande] = useState(0)

  useEffect(() => {
    if (!actif) return
    let vivant = true
    void (async () => {
      const m = await manifestePython()
      if (!vivant) return
      setManifeste(m)
      // Déjà sur le téléphone : on le charge sans rien demander. Le prix a
      // été payé une fois, il n'y a plus de choix à poser.
      if (m !== null && (await dejaDescendu(m))) setDemande((d) => (d === 0 ? 1 : d))
    })()
    return () => { vivant = false }
  }, [actif])

  useEffect(() => {
    if (demande === 0 || manifeste === null || manifeste === undefined) return
    let vivant = true
    setEchoue(false)
    void (async () => {
      try {
        const e = await moteurPython(manifeste, (a) => { if (vivant) setAvancement(a) })
        if (vivant) setEnvoi(e)
      } catch {
        // Le réseau a coupé, ou un fichier est arrivé tronqué. Ce qui est déjà
        // gardé l'est bien : reprendre ne repart pas de zéro.
        if (vivant) { setEchoue(true); setAvancement(null) }
      }
    })()
    return () => { vivant = false }
  }, [demande, manifeste])

  return { manifeste, envoi, avancement, echoue, descendre: () => setDemande((d) => d + 1) }
}

/**
 * Le prix, puis le bouton.
 *
 * Cinq mégaoctets sur un forfait compté à l'octet, ce n'est pas un détail
 * technique : c'est de l'argent, et quelqu'un qui ne l'apprend qu'en voyant son
 * solde ne reviendra pas. Le chiffre est donc écrit avant, en gros, et il vient
 * du manifeste mesuré à la construction — pas d'une constante tapée à la main
 * qui mentirait à la version suivante.
 */
function Python(props: {
  readonly moteur: EtatPython
  readonly langue: Langue
  readonly t: Textes
}): JSX.Element {
  const { manifeste, avancement, echoue } = props.moteur

  if (manifeste === undefined) return <p class="vide">{props.t.unInstant}</p>
  if (manifeste === null) return <p class="vide">{props.t.pythonIndisponible}</p>

  const taille = enMegaoctets(manifeste.surLeFil, props.langue)

  if (avancement !== null && !echoue) {
    const fait = Math.min(100, Math.round((avancement.recus / avancement.total) * 100))
    return (
      <div class="python">
        <p class="python-etat">{props.t.pythonEnCours(fait)}</p>
        {/*
          * Une aiguille, pas un tourniquet.
          *
          * Sur une connexion lente, cinq mégaoctets prennent des minutes. Un
          * tourniquet qui tourne ne dit pas si on en est au début ou à la fin,
          * et au bout de deux minutes on coupe en croyant que c'est bloqué.
          */}
        <div class="python-jauge" role="progressbar" aria-valuenow={fait}
          aria-valuemin={0} aria-valuemax={100} aria-label={props.t.pythonEnCours(fait)}>
          <div class="python-jauge-faite" style={`width: ${fait}%`} />
        </div>
      </div>
    )
  }

  return (
    <div class="python">
      <h2 class="python-titre">{props.t.pythonTitre}</h2>
      <p class="python-pourquoi">{props.t.pythonPourquoi(taille)}</p>
      <p class="python-fois">{props.t.pythonUneSeuleFois}</p>
      {echoue && <p class="python-echoue">{props.t.pythonEchoue}</p>}
      <button type="button" class="python-oui" onClick={props.moteur.descendre}>
        {echoue ? props.t.pythonReessayer : props.t.pythonTelecharger(taille)}
      </button>
    </div>
  )
}
