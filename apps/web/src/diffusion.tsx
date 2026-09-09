import type { ShareSpec } from '@a237/engine'
import { cartePng, dessinerCarte } from '@a237/render/carte'
import type { JSX } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { lienWhatsApp } from './whatsapp.js'

/**
 * La feuille de diffusion.
 *
 * La carte est dessinée **ici, sur le téléphone du propriétaire**, puis
 * partagée en image (BRIEF.md § 3.1). Aucun rendu d'image côté serveur : on
 * réutilise du code déjà écrit et déjà vérifié à l'œil.
 *
 * Les relances partent une par une, du pouce du propriétaire, par `wa.me`
 * (invariant § 2.4). Rien ne s'envoie tout seul.
 */

async function copier(texte: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texte)
    return true
  } catch {
    return false
  }
}

export function Diffusion(props: {
  readonly partage: ShareSpec
  readonly onFermer: () => void
}): JSX.Element {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [poids, setPoids] = useState<number | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const element = canvas.current
    if (element === null) return
    try {
      dessinerCarte(element, props.partage.card)
      void cartePng(element).then(
        (blob) => setPoids(Math.round(blob.size / 1024)),
        () => setPoids(null),
      )
    } catch {
      setMessage('La carte n’a pas pu être dessinée sur cet appareil.')
    }
  }, [props.partage])

  async function partager(): Promise<void> {
    const element = canvas.current
    if (element === null) return
    try {
      const blob = await cartePng(element)
      const fichier = new File([blob], `${props.partage.name}.png`, { type: 'image/png' })
      if (navigator.canShare?.({ files: [fichier] }) === true) {
        await navigator.share({ files: [fichier], text: props.partage.txt })
        return
      }
    } catch {
      // Le partage natif a été refusé ou n'existe pas : on retombe sur le texte.
    }
    setMessage(
      (await copier(props.partage.txt))
        ? 'Texte copié. Appuie longuement sur l’image pour l’enregistrer.'
        : 'Copie impossible sur cet appareil.',
    )
  }

  return (
    <>
      {/* Le fond ferme la feuille : sur un téléphone, viser la croix est pénible. */}
      <button
        type="button"
        class="feuille-fond"
        aria-label="Fermer la diffusion"
        onClick={props.onFermer}
      />
      <div class="feuille" role="dialog" aria-modal="true" aria-label="Diffuser">
      <div class="feuille-tete">
        <b>Diffuser</b>
        <button type="button" class="feuille-fermer" onClick={props.onFermer} aria-label="Fermer">
          ×
        </button>
      </div>

      {props.partage.warn !== null && <div class="alerte">{props.partage.warn}</div>}

      <canvas ref={canvas} class="carte-apercu" aria-label={props.partage.desc} />
      {poids !== null && <p class="champ-aide">PNG de {poids} Ko</p>}

      <pre class="resume">{props.partage.txt}</pre>

      <div class="outil-actions">
        <button type="button" class="outil-action principale" onClick={() => void partager()}>
          Partager la carte
        </button>
        <button
          type="button"
          class="outil-action"
          onClick={() => {
            void copier(props.partage.txt).then((ok) =>
              setMessage(ok ? 'Résumé copié.' : 'Copie impossible sur cet appareil.'),
            )
          }}
        >
          Copier le texte
        </button>
      </div>

      {message !== '' && <p class="note">{message}</p>}

      <h3 class="outil-surtitre">Relances</h3>
      {props.partage.relances.length === 0 ? (
        <p class="note">{props.partage.relancesVides}</p>
      ) : (
        <div class="outil-rangees">
          {props.partage.relances.map((r) => {
            const lien = r.tel === null ? null : lienWhatsApp(r.tel, r.message)
            return (
              <div class="outil-rangee" key={r.nom}>
                <div class="identite">
                  <span class="nom">
                    <span class="n1">{r.nom}</span>
                    <span class="n2">{lien === null ? 'numéro inconnu' : r.tel}</span>
                  </span>
                </div>
                {lien === null ? (
                  <button
                    type="button"
                    class="outil-bascule"
                    onClick={() => {
                      void copier(r.message).then((ok) =>
                        setMessage(ok ? `Message pour ${r.nom} copié.` : 'Copie impossible.'),
                      )
                    }}
                  >
                    Copier
                  </button>
                ) : (
                  <a class="outil-bascule" href={lien} target="_blank" rel="noreferrer">
                    Relancer
                  </a>
                )}
              </div>
            )
          })}
        </div>
      )}
      </div>
    </>
  )
}
