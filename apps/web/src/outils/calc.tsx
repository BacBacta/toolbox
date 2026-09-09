import type { EtatCalc } from '@a237/engine'
import { CALCULATRICES, valider } from '@a237/engine'
import { Calculatrice } from '@a237/render/registre'
import type { JSX } from 'preact'
import type { ProprietesOutil } from '../outils.js'
import { EtatInvalide } from './commun.js'
import type { Extrait } from '@a237/engine'

/** L'adaptateur des calculatrices. Un fragment pour les deux. */

const PAR_ID = new Map(CALCULATRICES.map((s) => [s.id, s]))

export function Outil(props: ProprietesOutil): JSX.Element {
  const squelette = PAR_ID.get(props.outil.skeleton)
  if (squelette === undefined) {
    return (
      <EtatInvalide
        erreurs={[{ chemin: '$', message: `calcul inconnu : ${props.outil.skeleton}` }]}
      />
    )
  }

  const erreurs = valider(squelette.schema, props.outil.etat)
  if (erreurs.length > 0) return <EtatInvalide erreurs={erreurs} />

  return (
    <Calculatrice
      glyphe={props.glyphe}
      config={squelette.config}
      titre={squelette.title}
      etat={props.outil.etat as EtatCalc}
      ctx={props.ctx}
      onChange={props.onChange}
      onDiffuser={props.onDiffuser}
      partage={squelette.share}
    />
  )
}

export function creer(
  skeleton: string,
  _maintenant: Date,
  _extrait: Extrait,
): { nom: string; etat: unknown } {
  const squelette = PAR_ID.get(skeleton)
  if (squelette === undefined) throw new RangeError(`calcul inconnu : ${skeleton}`)
  return { nom: squelette.title, etat: squelette.defaults }
}
