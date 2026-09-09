import type { EtatArdoise, Extrait } from '@a237/engine'
import { ardoise, valider } from '@a237/engine'
import { RegistreArdoise } from '@a237/render/registre'
import type { JSX } from 'preact'
import type { ProprietesOutil } from '../outils.js'
import { EtatInvalide } from './commun.js'

export function Outil(props: ProprietesOutil): JSX.Element {
  const erreurs = valider(ardoise.schema, props.outil.etat)
  if (erreurs.length > 0) return <EtatInvalide erreurs={erreurs} />

  return (
    <RegistreArdoise
      glyphe={props.glyphe}
      etat={props.outil.etat as EtatArdoise}
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
  const neuf = ardoise.defaults
  return { nom: ardoise.title, etat: ardoise.garnir?.(neuf, extrait) ?? neuf }
}
