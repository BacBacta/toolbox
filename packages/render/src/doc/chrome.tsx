import type { Emetteur } from '@a237/legal-cm'
import { piedLegal } from '@a237/legal-cm'
import type { Encre } from '@a237/engine'
import type { ComponentChildren, JSX } from 'preact'
import { hexEncre } from '../encres.js'

/**
 * Les pièces communes aux documents A4.
 *
 * Rien n'est injecté en HTML : tout passe par des enfants JSX, que Preact
 * échappe. C'est l'invariant § 2.1 tenu à l'endroit où il compte — le rendu.
 * Un test vérifie qu'aucune source de ce paquet n'appelle
 * `dangerouslySetInnerHTML`.
 */

/** Une feuille A4 à la taille vraie. L'aperçu est mis à l'échelle par le CSS. */
export function PageA4(props: {
  readonly encre: Encre
  readonly children: ComponentChildren
}): JSX.Element {
  return (
    <div class="a4-cadre">
      <article class="a4" style={{ '--pa': hexEncre(props.encre) }}>
        {props.children}
      </article>
    </div>
  )
}

/** Ne rend une ligne que si elle porte quelque chose. */
function Lignes(props: { readonly valeurs: readonly (string | null)[] }): JSX.Element {
  const gardees = props.valeurs.filter((v): v is string => v !== null && v.trim() !== '')
  return (
    <>
      {gardees.map((v, i) => (
        <div key={`${i}-${v}`}>{v}</div>
      ))}
    </>
  )
}

/**
 * L'entête légal. Il porte les mentions de la section 5 du brief : raison
 * sociale, forme juridique, activité, adresse, RCCM, NIU et centre des impôts.
 * Un champ vide ne laisse pas une étiquette orpheline.
 */
export function Entete(props: { readonly emetteur: Emetteur }): JSX.Element {
  const e = props.emetteur
  return (
    <header class="a4-entete">
      <div>
        <div class="raison">{e.nom}</div>
        <div class="coordonnees">
          <Lignes
            valeurs={[
              e.activite,
              e.adresse,
              [e.tel && `Tél. ${e.tel}`, e.mail].filter(Boolean).join(' · ') || null,
            ]}
          />
        </div>
      </div>
      <div class="immat">
        <Lignes
          valeurs={[
            e.forme,
            e.rccm && `RCCM ${e.rccm}`,
            e.niu && `NIU ${e.niu}`,
            e.centre,
          ]}
        />
      </div>
    </header>
  )
}

export function TitreDocument(props: {
  readonly titre: string
  readonly sousTitre: string
}): JSX.Element {
  return (
    <>
      <h1 class="a4-titre">{props.titre}</h1>
      <div class="a4-sous-titre">{props.sousTitre}</div>
    </>
  )
}

/**
 * Le bloc destinataire. Le NIU du client y figure dès qu'on l'a : en B2B il est
 * obligatoire, et sans lui le client ne peut pas déduire.
 */
export function BlocClient(props: {
  readonly nom: string
  readonly niu: string
  /** Objet, référence au devis… `null` quand il n'y a rien à dire. */
  readonly complement: string | null
}): JSX.Element {
  return (
    <section class="a4-bloc-client">
      <div class="etiquette">Client</div>
      <div>
        <strong>{props.nom}</strong>
      </div>
      <Lignes valeurs={[props.niu && `NIU ${props.niu}`, props.complement]} />
    </section>
  )
}

export interface ZoneSignature {
  readonly libelle: string
  readonly mention?: string
}

export function ZonesSignature(props: { readonly zones: readonly ZoneSignature[] }): JSX.Element {
  return (
    <section class="a4-signatures">
      {props.zones.map((z) => (
        <div class="zone" key={z.libelle}>
          <div class="libelle">{z.libelle}</div>
          {z.mention !== undefined && <div class="mention">{z.mention}</div>}
          <div class="cadre" />
        </div>
      ))}
    </section>
  )
}

/** Le pied légal, obligatoire, plus d'éventuelles mentions propres au document. */
export function PiedLegal(props: {
  readonly emetteur: Emetteur
  readonly complement?: string
}): JSX.Element {
  return (
    <footer class="a4-pied">
      <div>{piedLegal(props.emetteur)}</div>
      {props.complement !== undefined && <div>{props.complement}</div>}
    </footer>
  )
}

export function NumeroPage(props: { readonly page: number; readonly total: number }): JSX.Element {
  return (
    <div class="a4-numero-page">
      {props.page}/{props.total}
    </div>
  )
}

/** Un texte libre découpé en paragraphes sur les lignes vides. Jamais de HTML. */
export function Paragraphes(props: { readonly texte: string }): JSX.Element {
  const blocs = props.texte.split(/\n\s*\n/).map((b) => b.trim()).filter((b) => b !== '')
  return (
    <>
      {blocs.map((b, i) => (
        <p key={`${i}-${b.slice(0, 12)}`}>{b}</p>
      ))}
    </>
  )
}
