import type { EtatPresence, Extrait } from '@a237/engine'
import { presence, valider } from '@a237/engine'
import { RegistrePresence } from '@a237/render/registre'
import type { JSX } from 'preact'
import type { ProprietesOutil } from '../outils.js'
import { EtatInvalide } from './commun.js'

export function Outil(props: ProprietesOutil): JSX.Element {
  const erreurs = valider(presence.schema, props.outil.etat)
  if (erreurs.length > 0) return <EtatInvalide erreurs={erreurs} />

  return (
    <RegistrePresence
      glyphe={props.glyphe}
      etat={props.outil.etat as EtatPresence}
      ctx={props.ctx}
      onChange={props.onChange}
      onDiffuser={props.onDiffuser}
    />
  )
}

export function creer(
  _skeleton: string,
  _maintenant: Date,
  extrait: Extrait,
): { nom: string; etat: unknown } {
  const neuf = presence.defaults
  return { nom: presence.title, etat: presence.garnir?.(neuf, extrait) ?? neuf }
}
