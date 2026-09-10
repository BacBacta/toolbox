import type { BatirPartage, RenderContext, ShareSpec } from '@a237/engine'
import { CATALOGUE, EXTRAIT_VIDE, lienPublic, montantF } from '@a237/engine'
import type { Extrait } from '@a237/engine'
import type { JSX } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { dernierEtatConnu } from './compte.js'
import type { EtatCompte } from './compte.js'
import { Diffusion } from './diffusion.js'
import type { ProprietesCompte } from './ecran-compte.js'
import { viderLaFile } from './file.js'
import { publier, televerserCarte } from './publier.js'
import { CHARGEURS, outilDisponible } from './outils.js'
import type { Compose, ModuleOutil } from './outils.js'
import { numeroter } from './numeros.js'
import {
  creerOutil, filerPublication, listerOutils, lireOutil, majEtat, noterPublication,
  nouvelIdentifiant, supprimerOutil,
} from './stockage.js'
import type { OutilEnregistre } from './stockage.js'
import { Atelier } from './atelier.js'

/**
 * La coquille.
 *
 * Elle ne connaît aucun outil : elle liste des squelettes, range des états, et
 * charge à la demande le fragment qui sait dessiner celui qu'on ouvre. C'est ce
 * découpage qui tient le budget de 120 Ko avec dix-sept outils.
 */

/** Les squelettes dont le moteur de rendu est écrit. */
const DISPONIBLES = CATALOGUE.filter((f) => outilDisponible(f.id))

/**
 * Le signe d'un outil ouvert.
 *
 * Un registre composé par le modèle n'est dans aucun catalogue : il porte son
 * propre signe, l'astérisque, et non le losange de repli. Ce losange dit « je
 * ne connais pas cet outil » — vrai pour un état enregistré par une version
 * plus ancienne, faux pour un registre composé, qui est un cas normal.
 */
function glyphePour(skeleton: string): string {
  if (skeleton.startsWith('compose')) return '✳'
  return CATALOGUE.find((f) => f.id === skeleton)?.glyphe ?? '◇'
}

function Accueil(props: {
  readonly outils: readonly OutilEnregistre[]
  readonly onCreer: (
    skeleton: string,
    extrait: Extrait,
    compose?: Compose,
    fcfa?: number,
  ) => void
  readonly onOuvrir: (id: string) => void
  readonly onSupprimer: (id: string) => void
}): JSX.Element {
  return (
    <>
      <header class="app-entete">
        <h1 class="titre-app">Atelier 237</h1>
        <span class="app-baseline">hors ligne, sur ton téléphone</span>
      </header>

      <Atelier fiches={DISPONIBLES} onCreer={props.onCreer} />

      <h2 class="outil-surtitre">Tous les outils</h2>
      <div class="grille">
        {DISPONIBLES.map((s) => (
          <button
            type="button"
            class="carte-squelette"
            key={s.id}
            onClick={() => props.onCreer(s.id, EXTRAIT_VIDE)}
          >
            <span class="marque" aria-hidden="true">
              {s.glyphe}
            </span>
            <span class="texte">
              <b>{s.title}</b>
              <span>{s.group}</span>
            </span>
          </button>
        ))}
      </div>

      <h2 class="outil-surtitre">Mes outils</h2>
      {props.outils.length === 0 ? (
        <p class="note">Rien pour l’instant. Choisis un outil ci-dessus.</p>
      ) : (
        <div class="outil-rangees">
          {props.outils.map((o) => (
            <div class="outil-rangee" key={o.id}>
              <button type="button" class="identite lien-outil" onClick={() => props.onOuvrir(o.id)}>
                <span class="nom">
                  <span class="n1">{o.nom}</span>
                  <span class="n2">{o.skeleton}</span>
                </span>
              </button>
              <button
                type="button"
                class="outil-retirer"
                aria-label={`Supprimer ${o.nom}`}
                onClick={() => props.onSupprimer(o.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

export function App(): JSX.Element {
  const [outils, setOutils] = useState<readonly OutilEnregistre[]>([])
  const [compte, setCompte] = useState<EtatCompte | null>(null)
  /*
   * L'écran du compte se charge à la demande, comme les outils.
   *
   * Il n'est sur le chemin de personne : on y arrive par une ligne discrète, et
   * la plupart des gens ne l'ouvriront jamais. Deux kilo-octets dans la
   * coquille initiale pour ça, c'est deux kilo-octets payés par tout le monde
   * avant le premier affichage, sur la connexion qu'ils ont.
   */
  const [surLeCompte, setSurLeCompte] = useState(false)
  const [ecranCompte, setEcranCompte] = useState<((p: ProprietesCompte) => JSX.Element) | null>(null)
  const [ouvert, setOuvert] = useState<OutilEnregistre | null>(null)
  const [module, setModule] = useState<ModuleOutil | null>(null)
  const [coutDernier, setCoutDernier] = useState<number | null>(null)
  const [partage, setPartage] = useState<ShareSpec | null>(null)
  const [erreur, setErreur] = useState('')
  /** Ce que la dernière tentative de dépôt a donné, dit dans la feuille. */
  const [motPublication, setMotPublication] = useState('')

  useEffect(() => {
    void listerOutils().then(setOutils)
    // Le dernier état connu, gardé sur l'appareil : la ligne s'affiche en mode
    // avion, et se rafraîchit quand une composition la met à jour.
    void dernierEtatConnu().then(setCompte)
  }, [])

  /*
   * Ce qui n'est pas parti repart, au lancement et au retour du réseau.
   *
   * Une file dans laquelle on dépose sans jamais rien retirer n'est pas une
   * file d'attente, c'est un tiroir. Rien ne s'affiche : la publication est
   * une conséquence de « Diffuser », pas une tâche que l'utilisateur suit. Ce
   * qui change, c'est que l'outil a désormais son adresse.
   */
  useEffect(() => {
    const reprendre = (): void => {
      void viderLaFile(new Date()).then(async (bilan) => {
        if (bilan.publies > 0) setOutils(await listerOutils())
      })
    }
    reprendre()
    globalThis.addEventListener('online', reprendre)
    return () => globalThis.removeEventListener('online', reprendre)
  }, [])

  useEffect(() => {
    if (!surLeCompte) return
    void import('./ecran-compte.js').then((m) => setEcranCompte(() => m.EcranCompte))
  }, [surLeCompte])

  useEffect(() => {
    if (ouvert === null) {
      setModule(null)
      return
    }
    const chargeur = CHARGEURS[ouvert.skeleton]
    if (chargeur === undefined) {
      setErreur(`Cet outil n’a pas encore d’écran : ${ouvert.skeleton}.`)
      return
    }
    void chargeur().then(setModule, () =>
      setErreur('Cet outil n’a pas pu être chargé. Réessaie une fois en ligne.'),
    )
  }, [ouvert])

  /**
   * Un `void promesse()` avale les rejets, et l'écran reste alors figé sans
   * rien dire — le pire des comportements pour quelqu'un qui a un réseau
   * capricieux et un téléphone plein. Tout ce qui est asynchrone passe par ici.
   */
  /**
   * Diffuser, c'est d'abord publier.
   *
   * L'ordre n'est pas indifférent : la carte porte le lien, donc il faut que
   * le lien existe avant de la dessiner. Un dépôt refusé, en conflit ou
   * simplement hors ligne n'empêche pas de partager — la carte part sans
   * adresse, comme avant, et l'écran dit pourquoi.
   */
  async function diffuser(batir: BatirPartage, outil: OutilEnregistre): Promise<void> {
    const maintenant = new Date()
    const avec = (lien: string | undefined): ShareSpec =>
      batir({
        lien: lien === undefined ? '' : lienPublic(location.host, lien),
        maintenant,
      })

    if (outil.lien !== undefined && outil.versionPubliee === outil.version) {
      // Rien n'a bougé depuis le dernier dépôt : le lien vaut toujours, et on
      // ne dépense pas une requête pour le redire.
      setMotPublication('')
      setPartage(avec(outil.lien))
      return
    }

    const issue = await publier(outil, maintenant, outil.lien)

    if (issue.sorte === 'publie') {
      const suivant = await noterPublication(outil, issue.lien, outil.version)
      setOuvert(suivant)
      setOutils(await listerOutils())
      setMotPublication('')
      setPartage(avec(issue.lien))
      return
    }

    if (issue.sorte === 'refuse') setMotPublication(issue.pourquoi)
    else if (issue.sorte === 'conflit') {
      setMotPublication(
        `Une version plus récente de cet outil est déjà publiée (version ${issue.versionServeur}). ` +
          'Ouvre-la, compare, puis modifie ici pour la remplacer.',
      )
    } else {
      await filerPublication({
        id: nouvelIdentifiant(),
        outilId: outil.id,
        version: outil.version,
        creeLe: Date.now(),
      })
      setMotPublication(
        'Pas de réseau : la publication attend son tour. La carte part sans lien pour l’instant.',
      )
    }
    // La carte part sans adresse plutôt que d'en porter une qui ne répond pas.
    setPartage(avec(issue.sorte === 'refuse' ? undefined : outil.lien))
  }

  function tenter(travail: () => Promise<void>, quoi: string): void {
    void travail().catch((cause: unknown) => {
      setErreur(`${quoi} : ${cause instanceof Error ? cause.message : String(cause)}`)
    })
  }

  async function creer(
    skeleton: string,
    extrait: Extrait,
    compose?: Compose,
    fcfa?: number,
  ): Promise<void> {
    const chargeur = CHARGEURS[skeleton]
    if (chargeur === undefined) throw new Error(`aucun écran pour « ${skeleton} »`)
    const maintenant = new Date()
    const neuf = (await chargeur()).creer(skeleton, maintenant, extrait, compose)
    /*
     * Le squelette a posé un numéro de gabarit : il connaît son préfixe et
     * l'année, pas ce que ce compte a déjà émis. Celui qui compte se réserve
     * ici, sur un registre qu'une suppression ne fait pas reculer — sans quoi
     * effacer la dernière facture réattribuerait son numéro à la suivante.
     */
    const etat = await numeroter(skeleton, neuf.etat, maintenant)
    const outil = await creerOutil(skeleton, neuf.nom, etat, maintenant, compose)
    setOutils(await listerOutils())
    setOuvert(outil)
    /*
     * Le solde a peut-être changé, et l'écran doit le voir.
     *
     * Une composition rapporte le solde avec sa réponse, et `composer` le range
     * sur l'appareil — mais l'état affiché avait été lu une fois, au montage.
     * La ligne du compte restait donc absente jusqu'au lancement suivant : on
     * venait de dépenser un crédit sans que rien ne le dise.
     *
     * On relit après chaque création, y compris celles qui ne coûtent rien :
     * une lecture d'IndexedDB ne se sent pas, et distinguer les deux cas ici
     * ferait dépendre l'affichage d'une règle qui se décide ailleurs.
     */
    setCompte(await dernierEtatConnu())
    /*
     * Ce que la composition a coûté, dit une fois.
     *
     * La consommation se paie à l'appel : une dépense qu'on ne voit pas est
     * une dépense qu'on découvre à la fin du mois. Elle s'affiche sur l'outil
     * qu'elle vient d'ouvrir, puis disparaît au suivant.
     */
    setCoutDernier(fcfa ?? null)
  }

  async function changer(etat: unknown): Promise<void> {
    if (ouvert === null) return
    const suivant = await majEtat(ouvert, etat, new Date())
    setOuvert(suivant)
    setOutils(await listerOutils())
  }

  async function supprimer(id: string): Promise<void> {
    await supprimerOutil(id)
    setOutils(await listerOutils())
  }

  async function ouvrir(id: string): Promise<void> {
    // Le coût affiché appartient à la composition qui vient d'avoir lieu, pas
    // à l'outil qu'on rouvre : il s'efface dès qu'on passe à autre chose.
    setCoutDernier(null)
    setOuvert(await lireOutil(id))
  }

  if (surLeCompte) {
    const Ecran = ecranCompte
    return (
      <main class="app">
        {Ecran === null ? (
          <p class="note">Un instant…</p>
        ) : (
          <Ecran etat={compte} onEtat={setCompte} onRetour={() => setSurLeCompte(false)} />
        )}
      </main>
    )
  }

  if (ouvert === null) {
    return (
      <main class="app">
        {erreur !== '' && <div class="alerte">{erreur}</div>}
        <Accueil
          outils={outils}
          onCreer={(s, extrait, compose, fcfa) =>
            tenter(() => creer(s, extrait, compose, fcfa), 'Création impossible')
          }
          onOuvrir={(id) => tenter(() => ouvrir(id), 'Ouverture impossible')}
          onSupprimer={(id) => tenter(() => supprimer(id), 'Suppression impossible')}
        />
        {/*
          Une ligne, en bas, hors du chemin de qui vient faire une facture.
          Elle ne dit rien tant qu'on n'a jamais composé — il n'y a alors rien
          à savoir, et une invitation à s'occuper de son compte serait la
          première chose que verrait quelqu'un venu pour un devis.
        */}
        {compte !== null && (
          <button type="button" class="compte-ligne" onClick={() => setSurLeCompte(true)}>
            {compte.plan === 'atelier'
              ? `Atelier · ${compte.credits} compositions`
              : compte.credits === 0
                ? 'Essai · plus de composition'
                : `Essai · ${compte.credits} composition${compte.credits > 1 ? 's' : ''}`}
          </button>
        )}
      </main>
    )
  }

  /**
   * Le lien de l'outil ouvert, ou rien.
   *
   * Il ne s'écrit qu'une fois le dépôt accepté. Inventer `atl.cm/a/1234` sur
   * la carte et dans les relances ferait un lien mort, envoyé par le trésorier
   * à ses membres, sous son nom. Le moteur sait taire un lien vide.
   */
  const ctx: RenderContext = {
    lien: ouvert.lien === undefined ? '' : lienPublic(location.host, ouvert.lien),
    maintenant: new Date(),
  }

  return (
    <main class="app">
      <button
        type="button"
        class="retour"
        onClick={() => {
          setOuvert(null)
          setErreur('')
        }}
      >
        ← Mes outils
      </button>

      {erreur !== '' && <div class="alerte">{erreur}</div>}

      {coutDernier !== null && (
        <p class="note cout-compose">
          Composé par le modèle pour {montantF(coutDernier)}.
        </p>
      )}

      {module === null ? (
        <p class="note">Chargement de l’outil…</p>
      ) : (
        <module.Outil
          outil={ouvert}
          glyphe={glyphePour(ouvert.skeleton)}
          ctx={ctx}
          onChange={(etat) => tenter(() => changer(etat), 'Enregistrement impossible')}
          onDiffuser={(batir) =>
            tenter(() => diffuser(batir, ouvert), 'Diffusion impossible')
          }
        />
      )}

      {partage !== null && (
        <Diffusion
          partage={partage}
          mot={motPublication}
          /*
           * La carte suit le dépôt, elle ne le précède pas. Ce qui rate ici ne
           * se dit pas : sans image, l'aperçu WhatsApp porte le titre et la
           * description, ce qui est moins bien et n'est pas une panne.
           */
          onCarte={(png) => {
            if (ouvert.lien !== undefined) void televerserCarte(ouvert.lien, png)
          }}
          onFermer={() => setPartage(null)}
        />
      )}
    </main>
  )
}
