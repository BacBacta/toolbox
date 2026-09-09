import type { CardSpec, Instantane, RenderContext } from '@a237/engine'
import { squeletteDeCalcul, squeletteDeRegistre, squeletteParId } from '@a237/engine'
import {
  DocumentAttestation, DocumentCv, DocumentDette, DocumentDevis, DocumentFacture,
  DocumentMotivation, DocumentRecu,
} from '@a237/render/doc'
import type { JSX } from 'preact'

/**
 * Ce qu'on dessine derrière un lien, selon ce qui a été publié.
 *
 * Deux formes, et le squelette dit laquelle. Les sept documents A4 sont déjà
 * des pages en lecture seule : on rend le document lui-même, celui que le
 * client aurait reçu imprimé. C'est tout l'intérêt du lien — ouvrir un devis
 * plutôt que recevoir une image qu'on ne peut ni chercher ni copier.
 *
 * Les registres, eux, sont des écrans avec des boutons. On ne les rejoue pas :
 * on rend leur **carte**, que chaque squelette sait déjà produire et qui est
 * déjà éprouvée. Elle dit l'essentiel — un titre, un grand chiffre, une liste —
 * et ne prétend pas être l'outil.
 */

const DOCUMENTS: Readonly<Record<string, (p: { etat: never }) => JSX.Element>> = {
  devis: DocumentDevis as never,
  facture: DocumentFacture as never,
  attestation: DocumentAttestation as never,
  recu: DocumentRecu as never,
  dette: DocumentDette as never,
  motivation: DocumentMotivation as never,
  cv: DocumentCv as never,
}

/** La facture a besoin de l'instant pour dire son retard ; les autres non. */
function estFacture(skeleton: string): boolean {
  return skeleton === 'facture'
}

export function documentDe(instantane: Instantane, ctx: RenderContext): JSX.Element | null {
  const Composant = Object.hasOwn(DOCUMENTS, instantane.skeleton)
    ? DOCUMENTS[instantane.skeleton]
    : undefined
  if (Composant === undefined) return null
  const etat = instantane.etat as never
  return estFacture(instantane.skeleton)
    ? <DocumentFacture etat={etat} maintenant={ctx.maintenant} />
    : <Composant etat={etat} />
}

/**
 * La carte d'un instantané, quand il n'y a pas de document à dessiner.
 *
 * Rend `null` si le squelette est inconnu du serveur : un lien publié par une
 * version plus récente de l'application ne doit pas faire tomber la page.
 *
 * Un outil composé par le modèle n'a pas de squelette — sa configuration
 * voyage avec lui, dans l'instantané. On la remonte en squelette, exactement
 * comme le fait l'écran : c'est la même fabrique. Sans cela, l'outil payé
 * était le seul qu'on ne pouvait pas partager.
 */
export function carteDe(instantane: Instantane, ctx: RenderContext): CardSpec | null {
  const squelette = squeletteCompose(instantane) ?? squeletteParId(instantane.skeleton)
  if (squelette === null) return null
  try {
    return squelette.card(instantane.etat as never, ctx)
  } catch {
    // Un état qui ne correspond plus au squelette d'aujourd'hui : on préfère
    // une page sobre à une page cassée.
    return null
  }
}

/** Le squelette que porte l'instantané lui-même, s'il en porte un. */
function squeletteCompose(instantane: Instantane): { card: (e: never, c: RenderContext) => CardSpec } | null {
  if (instantane.registre !== undefined) return squeletteDeRegistre(instantane.registre) as never
  if (instantane.calcul !== undefined) return squeletteDeCalcul(instantane.calcul) as never
  return null
}

/** La carte, dessinée en HTML — pas en image. */
export function VueCarte(props: { readonly carte: CardSpec }): JSX.Element {
  const c = props.carte
  return (
    <article class="lecture-carte">
      <header>
        <p class="kicker">{c.kicker}</p>
        <h1>{c.title}</h1>
        {c.sub !== '' && <p class="sous">{c.sub}</p>}
      </header>

      <section class="grand">
        <p class="etiquette">{c.bigLabel}</p>
        <p class="chiffre">{c.big}</p>
        {c.pct !== null && (
          <div class="barre" role="img" aria-label={`${Math.round(c.pct * 100)} %`}>
            <i style={{ width: `${Math.max(0, Math.min(100, Math.round(c.pct * 100)))}%` }} />
          </div>
        )}
        {c.subline !== '' && <p class="ligne">{c.subline}</p>}
      </section>

      {c.items.length > 0 && (
        <section class="detail">
          {c.listTitle !== '' && <p class="etiquette">{c.listTitle}</p>}
          <ul>
            {c.items.map((i) => (
              <li key={i.n} class={i.warn ? 'alerte' : i.ok ? 'fait' : ''}>
                <span class="quoi">{i.n}</span>
                {i.val !== null && <span class="combien">{i.val}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}
