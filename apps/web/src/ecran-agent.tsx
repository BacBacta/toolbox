import type { Ebauche, Extrait, FamilleOutil, LectureTour, RenderContext } from '@a237/engine'
import { EXTRAIT_VIDE, composeDe, coutF, ebaucheFinie, squeletteDe } from '@a237/engine'
import { PageFormulaire, PageVitrine } from '@a237/render/page'
import '@a237/render/styles/vitrine.css'
import type { JSX } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { parler } from './agent.js'
import type { Dit } from './agent.js'
import type { Compose } from './outils.js'

/**
 * L'atelier : on discute, et l'outil se dessine à côté.
 *
 * C'est l'étage 2 du brief rendu conversationnel. Un bouton qui lance une
 * génération et rend un outil marchait — mais il ne laissait aucune place à la
 * deuxième phrase, alors que personne ne décrit du premier coup l'outil qu'il
 * veut. « Non, ajoute une colonne pour le mode de paiement » est la vraie
 * façon dont un outil se fabrique.
 *
 * Deux moitiés d'écran, et la seconde est le sujet de tout ce fichier :
 *
 * - **la conversation**, où l'agent écrit lettre par lettre ;
 * - **la fenêtre**, où l'on voit ce qui est en train d'être fabriqué — le
 *   titre dès qu'il est écrit, puis les colonnes ou les sections qui
 *   s'ajoutent une à une.
 *
 * Cette fenêtre ne montre pas un outil : elle montre une **ébauche**, qui n'a
 * traversé aucun validateur et qui n'a le droit de rien créer. L'outil
 * n'existe qu'à la fin, quand la réponse complète est passée par le moteur.
 * La frontière du § 2.1 n'a pas bougé d'un pouce — c'est la même que celle du
 * bouton, à un écran de plus.
 */

export interface ProprietesAgent {
  /** La première phrase, celle qui a été tapée dans l'atelier. */
  readonly demande: string
  readonly onCreer: (
    skeleton: string,
    extrait: Extrait,
    compose?: Compose,
    fcfa?: number,
  ) => void
  readonly onFermer: () => void
}

type Etat = 'repos' | 'ecoute' | { readonly fini: string }

const NOM_FAMILLE: Readonly<Record<FamilleOutil, string>> = {
  registre: 'un registre',
  calcul: 'une calculatrice',
  page: 'une page',
  formulaire: 'un formulaire',
  refus: '',
}

export function EcranAgent(props: ProprietesAgent): JSX.Element {
  const [messages, setMessages] = useState<readonly Dit[]>([
    { qui: 'personne', texte: props.demande },
  ])
  const [ebauche, setEbauche] = useState<Ebauche | null>(null)
  /**
   * Le dernier tour, quel qu'il soit — et l'outil, seulement s'il s'ouvre.
   *
   * Deux états et non un, parce que ce ne sont pas les mêmes questions. La
   * fenêtre montre **ce que le dernier tour a donné**, y compris un refus ; le
   * bouton n'apparaît que s'il y a un écran derrière. Confondre les deux
   * laissait la fenêtre annoncer « ton outil apparaîtra ici » juste après un
   * « je ne sais pas faire ça » — ce qui est faux, et se lit comme une attente
   * qui n'aboutira jamais.
   */
  const [dernier, setDernier] = useState<LectureTour | null>(null)
  const [outil, setOutil] = useState<{ tour: LectureTour } | null>(null)
  const [conversation, setConversation] = useState<string | undefined>(undefined)
  const [etat, setEtat] = useState<Etat>('repos')
  const [saisie, setSaisie] = useState('')
  const [cout, setCout] = useState(0)

  /*
   * Le tour en cours, pour pouvoir l'abandonner.
   *
   * Quitter l'écran pendant que l'agent écrit doit couper le flux : sans ça, la
   * lecture continue dans le vide, et sur un téléphone qui compte ses
   * mégaoctets ça se paie.
   */
  const enCours = useRef<AbortController | null>(null)
  const filDeLaConversation = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    return () => enCours.current?.abort()
  }, [])

  // La conversation suit ce qui s'écrit, comme dans WhatsApp.
  useEffect(() => {
    const fil = filDeLaConversation.current
    if (fil !== null) fil.scrollTop = fil.scrollHeight
  }, [messages, ebauche])

  async function jouer(suite: readonly Dit[]): Promise<void> {
    enCours.current?.abort()
    const abandon = new AbortController()
    enCours.current = abandon

    setEtat('ecoute')
    setEbauche(null)

    for await (const signe of parler(
      {
        messages: suite,
        ...(outil === null ? {} : { outil: brutDe(outil.tour) }),
        ...(conversation === undefined ? {} : { conversation }),
      },
      abandon.signal,
    )) {
      if (signe.sorte === 'ebauche') {
        setEbauche(signe.ebauche)
        continue
      }

      if (signe.sorte === 'fin') {
        setConversation(signe.conversation)
        setCout((c) => c + signe.fcfa)
        setMessages([...suite, { qui: 'agent', texte: signe.tour.mot }])
        setEbauche(null)
        setDernier(signe.tour)
        /*
         * Un refus n'est pas un outil, même s'il en occupe la place.
         *
         * La condition était « ce n'est pas invalide », et un refus ne l'est
         * pas : le bouton « Ouvrir cet outil » s'affichait donc après un
         * « je ne sais pas faire ça », et ne faisait rien. Un bouton mort est
         * pire qu'un bouton absent — on clique deux fois avant de comprendre
         * que c'est l'application qui a un problème, et ce n'en est pas un.
         *
         * Ce qui décide est ce qui décidera à l'ouverture : y a-t-il un écran
         * derrière ?
         */
        if (signe.tour.sorte === 'outil' && squeletteDe(signe.tour.outil) !== null) {
          setOutil({ tour: signe.tour })
        }
        setEtat('repos')
        return
      }

      setEbauche(null)
      setEtat({ fini: motDePanne(signe) })
      return
    }
    setEtat('repos')
  }

  function envoyer(texte: string): void {
    const propre = texte.trim()
    if (propre === '' || etat === 'ecoute') return
    setSaisie('')
    const suite = [...messages, { qui: 'personne' as const, texte: propre }]
    setMessages(suite)
    void jouer(suite)
  }

  // Le premier tour part tout seul : la phrase a déjà été tapée dans l'atelier.
  useEffect(() => {
    void jouer(messages)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pret = outil !== null && outil.tour.sorte === 'outil'

  return (
    <section class="agent">
      <header class="agent-tete">
        <button type="button" class="retour" onClick={props.onFermer}>
          ← Mes outils
        </button>
        {cout > 0 && <span class="agent-cout">{coutF(cout)}</span>}
      </header>

      <div class="agent-fenetre">
        <Fenetre ebauche={ebauche} tour={dernier} ecoute={etat === 'ecoute'} />
      </div>

      <div class="agent-fil" ref={filDeLaConversation}>
        {messages.map((m, i) => (
          <p class={m.qui === 'agent' ? 'dit-agent' : 'dit-personne'} key={`${i}-${m.texte}`}>
            {m.texte}
          </p>
        ))}
        {ebauche !== null && ebauche.mot !== '' && <p class="dit-agent">{ebauche.mot}</p>}
        {etat === 'ecoute' && ebauche === null && <p class="dit-agent attente">…</p>}
        {typeof etat === 'object' && <p class="dit-panne">{etat.fini}</p>}
      </div>

      {pret && (
        <button type="button" class="agent-ouvrir" onClick={() => ouvrir(outil.tour, props.onCreer, cout)}>
          Ouvrir cet outil
        </button>
      )}

      <form
        class="agent-saisie"
        onSubmit={(e) => {
          e.preventDefault()
          envoyer(saisie)
        }}
      >
        <input
          type="text"
          enterkeyhint="send"
          autocomplete="off"
          value={saisie}
          placeholder={pret ? 'Change quelque chose…' : 'Dis-m’en plus…'}
          aria-label="Répondre à l’atelier"
          onInput={(e) => setSaisie((e.target as HTMLInputElement).value)}
        />
        <button type="submit" disabled={etat === 'ecoute' || saisie.trim() === ''}>
          Envoyer
        </button>
      </form>
    </section>
  )
}

/**
 * La fenêtre où l'on voit ce qui est en train d'être fabriqué.
 *
 * Trois états, et le premier compte autant que les autres : **avant** que le
 * modèle ait dit quoi que ce soit, elle dit ce qu'elle attend plutôt que de
 * rester blanche. Un rectangle vide pendant huit secondes se lit comme une
 * panne, et sur une connexion qui hoquette huit secondes deviennent trente.
 */
function Fenetre(props: {
  readonly ebauche: Ebauche | null
  readonly tour: LectureTour | null
  readonly ecoute: boolean
}): JSX.Element {
  /*
   * Une seule forme à dessiner, avant comme après.
   *
   * La fenêtre se vidait à l'instant précis où l'outil était prêt : l'ébauche
   * est effacée quand le flux se termine, et il n'y avait plus rien derrière.
   * On voyait donc l'outil s'écrire, puis disparaître au moment de le
   * regarder — c'est-à-dire au seul moment où on le regarde vraiment.
   */
  const termine = props.tour?.sorte === 'outil' && props.tour.outil.sorte !== 'invalide'
    ? ebaucheFinie(props.tour.mot, props.tour.outil)
    : null
  const e = props.ebauche ?? termine

  if (e === null) {
    return (
      <div class="fenetre vide">
        <p class="fenetre-attente">
          {props.ecoute ? 'Je regarde ce que tu demandes…' : 'Ton outil apparaîtra ici.'}
        </p>
      </div>
    )
  }

  const { famille, titre, pieces } = e

  if (famille === 'refus') {
    return (
      <div class="fenetre vide">
        <p class="fenetre-attente">Ce n’est pas un outil que je sais fabriquer.</p>
      </div>
    )
  }

  /*
   * Une fois fini, on montre **la chose elle-même** quand elle se dessine sans
   * état : une page et un formulaire se rendent à partir de leur seule
   * configuration, et c'est ce qu'un client verra. Un registre et une
   * calculatrice, eux, sont des écrans qu'on remplit — leur essence est la
   * liste de leurs colonnes, et c'est déjà ce qui est affiché.
   */
  const vraie = props.ebauche === null ? vraieVue(props.tour) : null
  if (vraie !== null) {
    return (
      <div class="fenetre montre">
        <p class="fenetre-famille">{famille === null ? '' : NOM_FAMILLE[famille]}</p>
        <div class="fenetre-vue">{vraie}</div>
      </div>
    )
  }

  return (
    <div class={props.ecoute ? 'fenetre ecrit' : 'fenetre'}>
      {famille !== null && <p class="fenetre-famille">{NOM_FAMILLE[famille]}</p>}
      <p class="fenetre-titre">{titre === '' ? '…' : titre}</p>
      {pieces.length > 0 && (
        <ul class="fenetre-pieces">
          {pieces.map((p, i) => (
            <li key={`${i}-${p}`}>{p}</li>
          ))}
        </ul>
      )}
      {props.ecoute && <p class="fenetre-encours">j’écris…</p>}
    </div>
  )
}

/**
 * Ce que le lecteur verra, quand ça se dessine sans état.
 *
 * Le formulaire est rendu **sans `action`** : ses champs sont inertes, et il ne
 * poste nulle part. Un aperçu qui envoie vraiment ajouterait la réponse de
 * celui qui fabrique le formulaire à celles qu'il attend.
 */
function vraieVue(tour: LectureTour | null): JSX.Element | null {
  if (tour === null || tour.sorte !== 'outil') return null
  const outil = tour.outil
  if (outil.sorte === 'page') {
    const ctx: RenderContext = { lien: '', maintenant: new Date() }
    return <PageVitrine page={outil.page} maintenant={ctx.maintenant} />
  }
  if (outil.sorte === 'formulaire') return <PageFormulaire formulaire={outil.formulaire} />
  return null
}

/** La configuration brute, telle qu'elle repart au serveur au tour suivant. */
function brutDe(tour: LectureTour): unknown {
  if (tour.sorte !== 'outil') return undefined
  const c = composeDe(tour.outil)
  return c === null ? undefined : (c.registre ?? c.calcul ?? c.page ?? c.formulaire)
}

function ouvrir(
  tour: LectureTour,
  onCreer: ProprietesAgent['onCreer'],
  fcfa: number,
): void {
  if (tour.sorte !== 'outil') return
  const skeleton = squeletteDe(tour.outil)
  const compose = composeDe(tour.outil)
  if (skeleton === null || compose === null) return
  onCreer(skeleton, EXTRAIT_VIDE, compose, fcfa)
}

function motDePanne(signe: { readonly sorte: string; readonly pourquoi?: string }): string {
  if (signe.sorte === 'pas-ouvert') {
    return 'L’atelier n’est pas encore ouvert. En attendant, prends l’outil le plus proche dans la liste.'
  }
  if (signe.sorte === 'sans-credit') {
    const pourquoi = signe.pourquoi === undefined || signe.pourquoi === ''
      ? 'Il n’y a plus de crédit pour composer.'
      : signe.pourquoi
    return `${pourquoi} Les outils que tu as déjà continuent de marcher.`
  }
  if (signe.sorte === 'abonnement-requis') {
    return signe.pourquoi === undefined || signe.pourquoi === ''
      ? 'Cette demande vaut plusieurs outils d’un coup.'
      : signe.pourquoi
  }
  return `Je n’ai pas pu continuer — ${signe.pourquoi ?? 'le modèle n’a pas répondu'}.`
}
