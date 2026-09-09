import type { EtatFacture } from '@a237/engine'
import { controleLegal, facture, valider } from '@a237/engine'
import { DocumentFacture } from '@a237/render/doc'
import type { JSX } from 'preact'
import { useState } from 'preact/hooks'
import { ChampsSchema } from '../formulaire.js'
import type { ProprietesOutil } from '../outils.js'
import { CadreDocument, EtatInvalide, Manquements, ongletDOuverture } from './commun.js'
import type { OngletDocument } from './commun.js'
import type { Extrait } from '@a237/engine'

const MASQUES = ['$.nom', '$.emisLe']

export function Outil(props: ProprietesOutil): JSX.Element {
  // Le crochet passe avant la sortie anticipée : un état qui redeviendrait
  // valide changerait sinon le nombre de crochets d'un rendu à l'autre.
  const [onglet, setOnglet] = useState<OngletDocument>(ongletDOuverture(props.outil.etat))

  const erreurs = valider(facture.schema, props.outil.etat)
  if (erreurs.length > 0) return <EtatInvalide erreurs={erreurs} />
  const etat = props.outil.etat as EtatFacture

  return (
    <CadreDocument
      titre={props.outil.nom}
      glyphe={props.glyphe}
      sousTitre={`Facture N° ${etat.numero}`}
      onglet={onglet}
      onOnglet={setOnglet}
      onDiffuser={() => props.onDiffuser(facture.share(etat, props.ctx))}
    >
      {onglet === 'Document' ? (
        <>
          <Manquements manquements={controleLegal(etat)} onCompleter={() => setOnglet('Modifier')} />
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

export function creer(
  _skeleton: string,
  maintenant: Date,
  _extrait: Extrait,
): { nom: string; etat: unknown } {
  const neuf = facture.initialiser?.({ lien: '', maintenant }) ?? facture.defaults
  return { nom: facture.title, etat: neuf }
}
