import type { EtatDevis } from '@a237/engine'
import { controleLegal, devis, valider } from '@a237/engine'
import { DocumentDevis } from '@a237/render/doc'
import type { JSX } from 'preact'
import { useState } from 'preact/hooks'
import { ChampsSchema } from '../formulaire.js'
import type { ProprietesOutil } from '../outils.js'
import { CadreDocument, EtatInvalide, Manquements, ongletDOuverture } from './commun.js'
import type { OngletDocument } from './commun.js'
import type { Extrait } from '@a237/engine'

/** Champs que l'utilisateur ne saisit pas : ils sont dérivés à la création. */
const MASQUES = ['$.nom', '$.emisLe']

export function Outil(props: ProprietesOutil): JSX.Element {
  // Le crochet passe avant la sortie anticipée : un état qui redeviendrait
  // valide changerait sinon le nombre de crochets d'un rendu à l'autre.
  const [onglet, setOnglet] = useState<OngletDocument>(ongletDOuverture(props.outil.etat))

  const erreurs = valider(devis.schema, props.outil.etat)
  if (erreurs.length > 0) return <EtatInvalide erreurs={erreurs} />
  const etat = props.outil.etat as EtatDevis

  return (
    <CadreDocument
      titre={props.outil.nom}
      glyphe={props.glyphe}
      sousTitre={`Devis N° ${etat.numero}`}
      onglet={onglet}
      onOnglet={setOnglet}
      onDiffuser={() => props.onDiffuser((c) => devis.share(etat, c))}
    >
      {onglet === 'Document' ? (
        <>
          <Manquements
            manquements={controleLegal(etat)}
            consequence="Sans elles, un client qui veut déduire ne pourra pas s’en servir."
            onCompleter={() => setOnglet('Modifier')}
          />
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

export function creer(
  _skeleton: string,
  maintenant: Date,
  extrait: Extrait,
): { nom: string; etat: unknown } {
  const neuf = devis.initialiser?.({ lien: '', maintenant }) ?? devis.defaults
  return { nom: devis.title, etat: devis.garnir?.(neuf, extrait) ?? neuf }
}
