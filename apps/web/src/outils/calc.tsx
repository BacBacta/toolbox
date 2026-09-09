import type { EtatCalc, Extrait } from '@a237/engine'
import { CALCULATRICES, squeletteDeCalcul, valider } from '@a237/engine'
import { Calculatrice } from '@a237/render/registre'
import type { JSX } from 'preact'
import type { Compose, ProprietesOutil } from '../outils.js'
import { EtatInvalide } from './commun.js'

/** L'adaptateur des calculatrices. Un fragment pour les deux, et pour les composées. */

const PAR_ID = new Map(CALCULATRICES.map((s) => [s.id, s]))

export function Outil(props: ProprietesOutil): JSX.Element {
  const compose = props.outil.calcul
  const squelette = compose !== undefined ? squeletteDeCalcul(compose) : PAR_ID.get(props.outil.skeleton)
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
  compose?: Compose,
): { nom: string; etat: unknown } {
  const calcul = compose?.calcul
  const squelette = calcul !== undefined ? squeletteDeCalcul(calcul) : PAR_ID.get(skeleton)
  if (squelette === undefined) throw new RangeError(`calcul inconnu : ${skeleton}`)
  return { nom: squelette.title, etat: squelette.defaults }
}
