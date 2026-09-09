import type { EtatCallbox, Extrait } from '@a237/engine'
import { callbox, valider } from '@a237/engine'
import { RegistreCallbox } from '@a237/render/registre'
import type { JSX } from 'preact'
import type { ProprietesOutil } from '../outils.js'
import { EtatInvalide } from './commun.js'

export function Outil(props: ProprietesOutil): JSX.Element {
  const erreurs = valider(callbox.schema, props.outil.etat)
  if (erreurs.length > 0) return <EtatInvalide erreurs={erreurs} />

  return (
    <RegistreCallbox
      glyphe={props.glyphe}
      etat={props.outil.etat as EtatCallbox}
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
  const neuf = callbox.defaults
  return { nom: callbox.title, etat: callbox.garnir?.(neuf, extrait) ?? neuf }
}
