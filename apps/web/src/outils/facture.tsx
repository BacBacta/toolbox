import type { EtatFacture } from '@a237/engine'
import { controleLegal, facture, valider } from '@a237/engine'
import { DocumentFacture } from '@a237/render/doc'
import type { JSX } from 'preact'
import { useState } from 'preact/hooks'
import { ChampsSchema } from '../formulaire.js'
import type { ProprietesOutil } from '../outils.js'
import { CadreDocument, EtatInvalide, Manquements } from './commun.js'
import type { OngletDocument } from './commun.js'

const MASQUES = ['$.nom', '$.emisLe']

export function Outil(props: ProprietesOutil): JSX.Element {
  const [onglet, setOnglet] = useState<OngletDocument>('Document')

  const erreurs = valider(facture.schema, props.outil.etat)
  if (erreurs.length > 0) return <EtatInvalide erreurs={erreurs} />
  const etat = props.outil.etat as EtatFacture

  return (
    <CadreDocument
      titre={props.outil.nom}
      sousTitre={`Facture N° ${etat.numero}`}
      onglet={onglet}
      onOnglet={setOnglet}
      onDiffuser={() => props.onDiffuser(facture.share(etat, props.ctx))}
    >
      {onglet === 'Document' ? (
        <>
          <Manquements manquements={controleLegal(etat)} />
          <DocumentFacture etat={etat} maintenant={props.ctx.maintenant} />
        </>
      ) : (
        <ChampsSchema
          schema={facture.schema}
          valeur={etat}
          masques={MASQUES}
          onChange={props.onChange}
        />
      )}
    </CadreDocument>
  )
}

export function creer(_skeleton: string, maintenant: Date): { nom: string; etat: unknown } {
  return {
    nom: facture.title,
    etat: facture.initialiser?.({ lien: '', maintenant }) ?? facture.defaults,
  }
}
