import type { EtatNjangi } from '@a237/engine'
import { njangi, valider } from '@a237/engine'
import { RegistreNjangi } from '@a237/render/registre'
import type { JSX } from 'preact'
import type { ProprietesOutil } from '../outils.js'
import { EtatInvalide } from './commun.js'
import type { Extrait } from '@a237/engine'

export function Outil(props: ProprietesOutil): JSX.Element {
  const erreurs = valider(njangi.schema, props.outil.etat)
  if (erreurs.length > 0) return <EtatInvalide erreurs={erreurs} />

  return (
    <RegistreNjangi
      glyphe={props.glyphe}
      etat={props.outil.etat as EtatNjangi}
      ctx={props.ctx}
      onChange={props.onChange}
      onDiffuser={props.onDiffuser}
    />
  )
}

export function creer(
  _skeleton: string,
  maintenant: Date,
  extrait: Extrait,
): { nom: string; etat: unknown } {
  const neuf = njangi.initialiser?.({ lien: '', maintenant }) ?? njangi.defaults
  return { nom: njangi.title, etat: njangi.garnir?.(neuf, extrait) ?? neuf }
}
