import type { EtatDevis } from '@a237/engine'
import { controleLegal, devis, valider } from '@a237/engine'
import { DocumentDevis } from '@a237/render/doc'
import type { JSX } from 'preact'
import { useState } from 'preact/hooks'
import { ChampsSchema } from '../formulaire.js'
import type { ProprietesOutil } from '../outils.js'
import { CadreDocument, EtatInvalide, Manquements } from './commun.js'
import type { OngletDocument } from './commun.js'

/** Champs que l'utilisateur ne saisit pas : ils sont dérivés à la création. */
const MASQUES = ['$.nom', '$.emisLe']

export function Outil(props: ProprietesOutil): JSX.Element {
  const [onglet, setOnglet] = useState<OngletDocument>('Document')

  const erreurs = valider(devis.schema, props.outil.etat)
  if (erreurs.length > 0) return <EtatInvalide erreurs={erreurs} />
  const etat = props.outil.etat as EtatDevis

  return (
    <CadreDocument
      titre={props.outil.nom}
      sousTitre={`Devis N° ${etat.numero}`}
      onglet={onglet}
      onOnglet={setOnglet}
      onDiffuser={() => props.onDiffuser(devis.share(etat, props.ctx))}
    >
      {onglet === 'Document' ? (
        <>
          <Manquements manquements={controleLegal(etat)} />
          <DocumentDevis etat={etat} />
        </>
      ) : (
        <ChampsSchema
          schema={devis.schema}
          valeur={etat}
          masques={MASQUES}
          onChange={props.onChange}
        />
      )}
    </CadreDocument>
  )
}

export function creer(maintenant: Date): { nom: string; etat: unknown } {
  return {
    nom: devis.title,
    etat: devis.initialiser?.({ lien: '', maintenant }) ?? devis.defaults,
  }
}
