import type { Fichier, Projet } from '@a237/etabli'
import { MODELES, fichierAExporter } from '@a237/etabli'
import { lienDemande, recuperer } from './partage.js'
import type { JSX } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { Apercu } from './apercu.js'
import { Partage } from './partage-vue.js'
import { Editeur } from './editeur.js'
import { enregistrer, lireProjets, supprimer } from './stockage.js'

/**
 * L'Établi : écrire du code sur son téléphone, hors ligne.
 *
 * Le compagnon de l'atelier, et son contraire sur un point : l'atelier fabrique
 * des outils pour qui n'écrit pas de code, l'Établi est pour qui veut
 * apprendre. Ce qu'ils partagent est la contrainte — un Android d'entrée de
 * gamme, un forfait compté à l'octet, des coupures, et le français.
 *
 * Tout se passe dans le navigateur : rien à installer, rien à téléverser, rien
 * qui cesse de marcher quand le réseau tombe. C'est ce que Replit ne sait pas
 * faire ici, et c'est toute l'ouverture.
 */

type Ecran =
  | { readonly quoi: 'liste' }
  | { readonly quoi: 'projet'; readonly id: string }

export function App(): JSX.Element {
  const [projets, setProjets] = useState<readonly Projet[] | null>(null)
  const [ecran, setEcran] = useState<Ecran>({ quoi: 'liste' })
  const [ouverture, setOuverture] = useState<'non'|'en-cours'|'faite'|'introuvable'|'echouee'>('non')

  useEffect(() => {
    void lireProjets().then(setProjets)
  }, [])

  /*
   * Un lien reçu s'ouvre tout seul.
   *
   * Quelqu'un reçoit l'adresse sur WhatsApp et la touche : il doit voir le
   * projet, pas un écran d'accueil où il faudrait deviner quoi faire. Le projet
   * arrive comme une copie à lui — il l'ouvre, le modifie, et sauvegardera sous
   * son propre lien s'il le veut. Celui qui a partagé ne risque rien.
   */
  useEffect(() => {
    const lien = lienDemande(location.search)
    if (lien === null) return
    setOuverture('en-cours')
    void recuperer(lien).then((r) => {
      if (r.sorte !== 'ouvert') {
        setOuverture(r.sorte === 'introuvable' ? 'introuvable' : 'echouee')
        return
      }
      const copie: Projet = {
        id: `p${Date.now().toString(36)}`,
        nom: r.nom,
        fichiers: r.fichiers.map((f) => ({ ...f })),
        maj: Date.now(),
      }
      setProjets((p) => [copie, ...(p ?? [])])
      setEcran({ quoi: 'projet', id: copie.id })
      setOuverture('faite')
      void enregistrer(copie)
      history.replaceState(null, '', location.pathname)
    })
  }, [])

  function creer(modeleId: string): void {
    const modele = MODELES.find((m) => m.id === modeleId)
    if (modele === undefined) return
    const projet: Projet = {
      id: `p${Date.now().toString(36)}`,
      nom: modele.nom,
      fichiers: modele.fichiers.map((f) => ({ ...f })),
      maj: Date.now(),
    }
    setProjets((p) => [projet, ...(p ?? [])])
    setEcran({ quoi: 'projet', id: projet.id })
    void enregistrer(projet)
  }

  function remplacer(projet: Projet): void {
    setProjets((p) => (p ?? []).map((autre) => (autre.id === projet.id ? projet : autre)))
    void enregistrer(projet)
  }

  function effacer(id: string): void {
    setProjets((p) => (p ?? []).filter((autre) => autre.id !== id))
    void supprimer(id)
  }

  if (projets === null) return <main class="chargement">Un instant…</main>

  if (ecran.quoi === 'projet') {
    const projet = projets.find((p) => p.id === ecran.id)
    if (projet === undefined) return <main class="chargement">Ce projet n’existe plus.</main>
    return (
      <EcranProjet
        projet={projet}
        onChanger={remplacer}
        onFermer={() => setEcran({ quoi: 'liste' })}
      />
    )
  }

  return (
    <main class="liste">
      <h1>Établi</h1>
      <p class="sous-titre">Écris du code, ici, sans réseau.</p>

      {ouverture === 'en-cours' && <p class="mot">On ouvre le projet reçu…</p>}
      {ouverture === 'introuvable' && (
        <p class="mot alerte">Ce lien n’existe plus. Demande à celui qui te l’a envoyé de le repartager.</p>
      )}
      {ouverture === 'echouee' && (
        <p class="mot alerte">Ce lien n’a pas pu être ouvert. Vérifie ton réseau et réessaie.</p>
      )}

      <h2>Commencer</h2>
      <div class="modeles">
        {MODELES.map((m) => (
          <button type="button" key={m.id} class="modele" onClick={() => creer(m.id)}>
            <b>{m.nom}</b>
            <span>{m.dit}</span>
          </button>
        ))}
      </div>

      {projets.length > 0 && (
        <>
          <h2>Tes projets</h2>
          <ul class="projets">
            {projets.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  class="projet"
                  onClick={() => setEcran({ quoi: 'projet', id: p.id })}
                >
                  <b>{p.nom}</b>
                  <span>{p.fichiers.length} fichier{p.fichiers.length > 1 ? 's' : ''}</span>
                </button>
                <button
                  type="button"
                  class="effacer"
                  aria-label={`Effacer ${p.nom}`}
                  onClick={() => effacer(p.id)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  )
}

/**
 * Un projet ouvert : on écrit, ou on regarde. Jamais les deux en même temps.
 *
 * Trois cent soixante pixels ne se partagent pas entre un éditeur et un aperçu
 * — chacun devient trop étroit pour servir. Sur un téléphone, on bascule ; c'est
 * ce que font toutes les applications que ces téléphones font déjà tourner.
 *
 * Le lancement est un geste, pas un rafraîchissement continu : une boucle
 * infinie relancée à chaque frappe fige l'appareil, et un aperçu qui se
 * redessine sans arrêt vide la batterie de quelqu'un qui n'a pas forcément de
 * quoi la recharger ce soir.
 */
function EcranProjet(props: {
  readonly projet: Projet
  readonly onChanger: (projet: Projet) => void
  readonly onFermer: () => void
}): JSX.Element {
  const [vue, setVue] = useState<'ecrire' | 'voir'>('ecrire')
  const [ouvert, setOuvert] = useState(props.projet.fichiers[0]?.nom ?? '')
  const [tour, setTour] = useState(0)

  function ecrire(nom: string, contenu: string): void {
    props.onChanger({
      ...props.projet,
      maj: Date.now(),
      fichiers: props.projet.fichiers.map((f) => (f.nom === nom ? { ...f, contenu } : f)),
    })
  }

  function ajouter(fichier: Fichier): void {
    props.onChanger({
      ...props.projet,
      maj: Date.now(),
      fichiers: [...props.projet.fichiers, fichier],
    })
    setOuvert(fichier.nom)
  }

  function lancer(): void {
    setTour((t) => t + 1)
    setVue('voir')
  }

  return (
    <main class="projet-ouvert">
      <header class="barre">
        <button type="button" class="retour" onClick={props.onFermer}>← Mes projets</button>
        <b class="nom">{props.projet.nom}</b>
        {vue === 'ecrire' ? (
          <button type="button" class="lancer" onClick={lancer}>▶ Lancer</button>
        ) : (
          <button type="button" class="lancer" onClick={() => setVue('ecrire')}>Écrire</button>
        )}
      </header>

      {vue === 'ecrire' ? (
        <Editeur
          projet={props.projet}
          ouvert={ouvert}
          onOuvrir={setOuvert}
          onEcrire={ecrire}
          onAjouter={ajouter}
        />
      ) : (
        <>
          <Apercu projet={props.projet} tour={tour} />
          <div class="actions">
            <button type="button" onClick={() => setTour((t) => t + 1)}>⟳ Relancer</button>
            <button type="button" onClick={() => telecharger(props.projet)}>
              Exporter en un fichier
            </button>
          </div>
          <Partage projet={props.projet} onChanger={props.onChanger} />
        </>
      )}
    </main>
  )
}

/**
 * Le fichier part sur le téléphone, et de là sur WhatsApp.
 *
 * Ce qu'il contient et comment il s'appelle se décide dans `fichierAExporter`,
 * qui est pur et éprouvé — le nom d'un projet écrit en français demande plus de
 * soin qu'il n'y paraît. Ce qui reste ici est la plomberie du navigateur, et
 * rien d'autre.
 */
function telecharger(projet: Projet): void {
  const { nom, contenu } = fichierAExporter(projet)
  const url = URL.createObjectURL(new Blob([contenu], { type: 'text/html' }))
  const lien = document.createElement('a')
  lien.href = url
  lien.download = nom
  lien.click()
  URL.revokeObjectURL(url)
}
