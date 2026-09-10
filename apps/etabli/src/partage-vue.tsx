import type { Projet } from '@a237/etabli'
import type { JSX } from 'preact'
import { useState } from 'preact/hooks'
import { adressePartagee, deposer } from './partage.js'

/**
 * Sauvegarder et partager, dans le même bouton.
 *
 * C'est le même geste, et le dire autrement embrouillerait : déposer le projet
 * lui donne un lien, ce lien le retrouve quand le téléphone a disparu, et c'est
 * aussi celui qu'on envoie. Deux boutons pour une seule action feraient croire
 * qu'il faut choisir.
 *
 * Rien ici n'est un passage obligé. L'Établi s'ouvre, on écrit et on exécute
 * sans réseau ; ce bouton attend qu'on en ait un, et le dit quand il n'y en a
 * pas.
 */

type Etat =
  | { readonly quoi: 'repos' }
  | { readonly quoi: 'en-cours' }
  | { readonly quoi: 'fait'; readonly adresse: string }
  | { readonly quoi: 'raté'; readonly pourquoi: string }

export function Partage(props: {
  readonly projet: Projet
  readonly onChanger: (projet: Projet) => void
}): JSX.Element {
  const [etat, setEtat] = useState<Etat>(
    props.projet.lien === undefined
      ? { quoi: 'repos' }
      : { quoi: 'fait', adresse: adressePartagee(props.projet.lien, location.origin) },
  )
  const [copie, setCopie] = useState(false)

  async function envoyer(): Promise<void> {
    setEtat({ quoi: 'en-cours' })
    const r = await deposer(props.projet)
    if (r.sorte === 'depose') {
      props.onChanger(r.projet)
      setEtat({ quoi: 'fait', adresse: adressePartagee(r.projet.lien ?? '', location.origin) })
      return
    }
    setEtat({
      quoi: 'raté',
      pourquoi: r.sorte === 'pas-de-reseau'
        ? 'Pas de réseau. Ton projet est en sécurité sur ce téléphone ; réessaie quand ça revient.'
        : r.sorte === 'refuse' ? r.pourquoi : 'Le partage a échoué.',
    })
  }

  return (
    <div class="partage">
      <button
        type="button"
        class="partager"
        disabled={etat.quoi === 'en-cours'}
        onClick={() => void envoyer()}
      >
        {etat.quoi === 'en-cours'
          ? 'Envoi…'
          : props.projet.lien === undefined
            ? 'Sauvegarder en ligne et partager'
            : 'Mettre à jour le lien'}
      </button>

      {etat.quoi === 'fait' && (
        <div class="partage-lien">
          <p class="mot">
            {/*
              * On dit ce que le lien fait, pas seulement qu'il existe.
              * « Garde-le » est l'instruction qui sauve le travail : c'est lui
              * qui retrouve le projet quand le téléphone a disparu.
              */}
            Garde ce lien : il retrouve ton projet même si tu perds ce téléphone.
          </p>
          <code class="adresse">{etat.adresse}</code>
          <div class="partage-actions">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(etat.adresse).then(
                  () => setCopie(true),
                  // Le presse-papier peut être refusé : l'adresse reste lisible
                  // à l'écran, et on ne prétend pas l'avoir copiée.
                  () => setCopie(false),
                )
              }}
            >
              {copie ? 'Copié' : 'Copier'}
            </button>
            <a
              class="whatsapp"
              href={`https://wa.me/?text=${encodeURIComponent(`${props.projet.nom} — ${etat.adresse}`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Envoyer sur WhatsApp
            </a>
          </div>
        </div>
      )}

      {etat.quoi === 'raté' && <p class="mot alerte">{etat.pourquoi}</p>}
    </div>
  )
}
