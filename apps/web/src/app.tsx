import type { RenderContext, ShareSpec } from '@a237/engine'
import { CATALOGUE, classer } from '@a237/engine'
import type { JSX } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { Diffusion } from './diffusion.js'
import { CHARGEURS, outilDisponible } from './outils.js'
import type { ModuleOutil } from './outils.js'
import { creerOutil, listerOutils, lireOutil, majEtat, supprimerOutil } from './stockage.js'
import type { OutilEnregistre } from './stockage.js'

/**
 * La coquille.
 *
 * Elle ne connaît aucun outil : elle liste des squelettes, range des états, et
 * charge à la demande le fragment qui sait dessiner celui qu'on ouvre. C'est ce
 * découpage qui tient le budget de 120 Ko avec dix-sept outils.
 */

/** Les squelettes dont le moteur de rendu est écrit. */
const DISPONIBLES = CATALOGUE.filter((f) => outilDisponible(f.id))

function Accueil(props: {
  readonly outils: readonly OutilEnregistre[]
  readonly onCreer: (skeleton: string) => void
  readonly onOuvrir: (id: string) => void
  readonly onSupprimer: (id: string) => void
}): JSX.Element {
  const [recherche, setRecherche] = useState('')

  // Étage 1 du moteur : correspondance de mots-clés, zéro jeton (§ 4).
  const proposes =
    recherche.trim() === ''
      ? DISPONIBLES
      : classer(recherche, DISPONIBLES).map((c) => c.squelette)

  return (
    <>
      <h1 class="titre-app">Atelier 237</h1>

      <label class="champ" for="recherche">
        <span class="champ-libelle">De quoi as-tu besoin ?</span>
        <input
          id="recherche"
          type="search"
          value={recherche}
          placeholder="il me faut un devis, noter le njangi…"
          onInput={(e) => setRecherche((e.target as HTMLInputElement).value)}
        />
      </label>

      {proposes.length === 0 ? (
        <p class="note">
          Rien ne correspond encore. Les autres outils du prototype arrivent ; en attendant,
          essaie « devis », « facture » ou « njangi ».
        </p>
      ) : (
        <div class="grille">
          {proposes.map((s) => (
            <button type="button" class="carte-squelette" key={s.id} onClick={() => props.onCreer(s.id)}>
              <b>{s.title}</b>
              <span>{s.group}</span>
            </button>
          ))}
        </div>
      )}

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
  const [ouvert, setOuvert] = useState<OutilEnregistre | null>(null)
  const [module, setModule] = useState<ModuleOutil | null>(null)
  const [partage, setPartage] = useState<ShareSpec | null>(null)
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    void listerOutils().then(setOutils)
  }, [])

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
  function tenter(travail: () => Promise<void>, quoi: string): void {
    void travail().catch((cause: unknown) => {
      setErreur(`${quoi} : ${cause instanceof Error ? cause.message : String(cause)}`)
    })
  }

  async function creer(skeleton: string): Promise<void> {
    const chargeur = CHARGEURS[skeleton]
    if (chargeur === undefined) throw new Error(`aucun écran pour « ${skeleton} »`)
    const maintenant = new Date()
    const neuf = (await chargeur()).creer(maintenant)
    const outil = await creerOutil(skeleton, neuf.nom, neuf.etat, maintenant)
    setOutils(await listerOutils())
    setOuvert(outil)
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
    setOuvert(await lireOutil(id))
  }

  if (ouvert === null) {
    return (
      <main class="app">
        {erreur !== '' && <div class="alerte">{erreur}</div>}
        <Accueil
          outils={outils}
          onCreer={(s) => tenter(() => creer(s), 'Création impossible')}
          onOuvrir={(id) => tenter(() => ouvrir(id), 'Ouverture impossible')}
          onSupprimer={(id) => tenter(() => supprimer(id), 'Suppression impossible')}
        />
      </main>
    )
  }

  /**
   * Le lien est vide tant que la publication n'existe pas.
   *
   * Il serait facile d'écrire `atl.cm/a/1234` sur la carte et dans les
   * relances : ce serait un lien mort, envoyé par le trésorier à ses membres,
   * sous son nom. Le moteur sait taire un lien vide ; la phase 2 le remplira
   * avec l'adresse que le serveur aura vraiment attribuée.
   */
  const ctx: RenderContext = { lien: '', maintenant: new Date() }

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

      {module === null ? (
        <p class="note">Chargement de l’outil…</p>
      ) : (
        <module.Outil
          outil={ouvert}
          ctx={ctx}
          onChange={(etat) => tenter(() => changer(etat), 'Enregistrement impossible')}
          onDiffuser={setPartage}
        />
      )}

      {partage !== null && <Diffusion partage={partage} onFermer={() => setPartage(null)} />}
    </main>
  )
}
