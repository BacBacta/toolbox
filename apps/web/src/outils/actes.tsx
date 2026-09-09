import type {
  EtatAttestation, EtatDette, EtatMotivation, EtatRecu, Extrait, RenderContext, ShareSpec,
} from '@a237/engine'
import {
  attestation, controleDette, controleEmetteur, dette, motivation, recu, valider,
} from '@a237/engine'
import {
  DocumentAttestation, DocumentDette, DocumentMotivation, DocumentRecu,
} from '@a237/render/doc'
import type { JSX } from 'preact'
import { useState } from 'preact/hooks'
import { ChampsSchema } from '../formulaire.js'
import type { ProprietesOutil } from '../outils.js'
import { CadreDocument, EtatInvalide, Manquements, ongletDOuverture } from './commun.js'
import type { OngletDocument } from './commun.js'

/**
 * Les quatre actes et lettres à l'écran.
 *
 * Un seul fragment pour les quatre : ils partagent le cadre, le formulaire
 * dressé par le schéma et la bascule Document / Modifier. Ce qui les distingue
 * tient dans une fonction de rendu et un contrôle légal.
 */

/** Champs que l'utilisateur ne saisit pas : ils sont dérivés à la création. */
const MASQUES = ['$.nom', '$.emisLe']

interface Acte {
  readonly squelette: typeof attestation | typeof recu | typeof dette | typeof motivation
  readonly rendre: (etat: never) => JSX.Element
  readonly sousTitre: (etat: never) => string
  /** Ce qui manque au document pour être présentable. */
  readonly manques: (etat: never) => readonly { champ: string; libelle: string; gravite?: string }[]
  /** Ce qu'on risque à laisser ces mentions vides — propre à chaque acte. */
  readonly consequence: string
}

/**
 * Le contrôle d'une reconnaissance de dette n'est pas celui d'une attestation.
 *
 * `mentionsManquantes` cherche une entreprise — NIU, RCCM, centre des impôts.
 * Un acte entre deux personnes n'en a pas : ce qu'un juge cherche, c'est
 * l'identité des parties, un montant et une échéance. Les deux contrôles se
 * ramènent ici à la même forme, pour que l'écran n'ait qu'un seul encart.
 */
const ACTES: Readonly<Record<string, Acte>> = {
  attestation: {
    squelette: attestation,
    rendre: (etat: EtatAttestation) => <DocumentAttestation etat={etat} />,
    sousTitre: (etat: EtatAttestation) => `${etat.objet} N° ${etat.numero}`,
    manques: (etat: EtatAttestation) => controleEmetteur(etat),
    consequence: 'Sans elles, le document n’identifie pas l’entreprise qui le délivre.',
  },
  recu: {
    squelette: recu,
    rendre: (etat: EtatRecu) => <DocumentRecu etat={etat} />,
    sousTitre: (etat: EtatRecu) => `Reçu N° ${etat.numero}`,
    manques: (etat: EtatRecu) => controleEmetteur(etat),
    consequence: 'Sans elles, le document n’identifie pas l’entreprise qui le délivre.',
  },
  dette: {
    squelette: dette,
    rendre: (etat: EtatDette) => <DocumentDette etat={etat} />,
    sousTitre: () => 'Acte sous seing privé',
    manques: (etat: EtatDette) =>
      controleDette(etat).map((m) => ({ ...m, gravite: 'bloquant' })),
    consequence: 'Sans elles, l’acte ne prouve rien devant un juge.',
  },
  motivation: {
    squelette: motivation,
    rendre: (etat: EtatMotivation) => <DocumentMotivation etat={etat} />,
    sousTitre: (etat: EtatMotivation) => etat.objet,
    manques: () => [],
    consequence: '',
  },
} as unknown as Readonly<Record<string, Acte>>

export function Outil(props: ProprietesOutil): JSX.Element {
  const acte = ACTES[props.outil.skeleton]

  // Le crochet passe avant la sortie anticipée : un état qui redeviendrait
  // valide changerait sinon le nombre de crochets d'un rendu à l'autre.
  const [onglet, setOnglet] = useState<OngletDocument>(ongletDOuverture(props.outil.etat))

  if (acte === undefined) {
    return (
      <EtatInvalide erreurs={[{ chemin: '$', message: `acte inconnu : ${props.outil.skeleton}` }]} />
    )
  }

  const erreurs = valider(acte.squelette.schema, props.outil.etat)
  if (erreurs.length > 0) return <EtatInvalide erreurs={erreurs} />
  const etat = props.outil.etat as never

  return (
    <CadreDocument
      titre={props.outil.nom}
      glyphe={props.glyphe}
      sousTitre={acte.sousTitre(etat)}
      onglet={onglet}
      onOnglet={setOnglet}
      onDiffuser={() =>
        props.onDiffuser(
          (acte.squelette.share as (e: never, c: RenderContext) => ShareSpec)(etat, props.ctx),
        )
      }
    >
      {onglet === 'Document' ? (
        <>
          <Manquements
            manquements={acte.manques(etat).map((m) => ({
              champ: m.champ,
              libelle: m.libelle,
              gravite: (m.gravite ?? 'bloquant') as 'bloquant' | 'avertissement',
            }))}
            consequence={acte.consequence}
            onCompleter={() => setOnglet('Modifier')}
          />
          {acte.rendre(etat)}
        </>
      ) : (
        <ChampsSchema
          schema={acte.squelette.schema}
          valeur={etat}
          masques={MASQUES}
          onChange={props.onChange}
        />
      )}
    </CadreDocument>
  )
}

export function creer(
  skeleton: string,
  maintenant: Date,
  _extrait: Extrait,
): { nom: string; etat: unknown } {
  const acte = ACTES[skeleton]
  if (acte === undefined) throw new RangeError(`acte inconnu : ${skeleton}`)
  const s = acte.squelette
  return {
    nom: s.title,
    etat: s.initialiser?.({ lien: '', maintenant }) ?? s.defaults,
  }
}
