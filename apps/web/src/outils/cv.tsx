import type { EtatCv, Extrait, Gabarit, LangueCv, ShareSpec } from '@a237/engine'
import { GABARITS, controleCv, cv, debordeUnePage, valider } from '@a237/engine'
import { DocumentCv } from '@a237/render/doc'
import type { JSX } from 'preact'
import { useState } from 'preact/hooks'
import { ChampsSchema } from '../formulaire.js'
import type { ProprietesOutil } from '../outils.js'
import { CadreDocument, EtatInvalide, Manquements } from './commun.js'
import type { OngletDocument } from './commun.js'

/**
 * Le CV à l'écran.
 *
 * Il a ce qu'aucun autre document n'a : trois réglages de forme — gabarit,
 * langue, densité — qui ne changent rien au contenu. Ils vivent au-dessus de la
 * feuille et pas dans le formulaire, parce qu'on en juge en regardant la page,
 * pas en lisant un champ.
 */

/** Champs pilotés par les boutons au-dessus de la feuille, pas par le formulaire. */
const MASQUES = ['$.nom', '$.gabarit', '$.langue', '$.dense']

const NOMS_GABARIT: Readonly<Record<Gabarit, readonly [string, string]>> = {
  notaire: ['Notaire', 'sérif, administratif'],
  executif: ['Exécutif', 'grotesque, privé'],
  editorial: ['Éditorial', 'display, créatif'],
  bloc: ['Bloc', 'bande latérale'],
}

function Reglages(props: {
  readonly etat: EtatCv
  readonly onChange: (etat: EtatCv) => void
}): JSX.Element {
  const e = props.etat
  return (
    <>
      <div class="cv-gabarits" role="group" aria-label="Gabarit">
        {GABARITS.map((g) => (
          <button
            key={g}
            type="button"
            class="cv-gabarit"
            aria-pressed={e.gabarit === g}
            onClick={() => props.onChange({ ...e, gabarit: g })}
          >
            {NOMS_GABARIT[g][0]}
            <small>{NOMS_GABARIT[g][1]}</small>
          </button>
        ))}
      </div>
      <div class="cv-options">
        {(['fr', 'en'] as const).map((l: LangueCv) => (
          <button
            key={l}
            type="button"
            class="outil-bascule"
            aria-pressed={e.langue === l}
            onClick={() => props.onChange({ ...e, langue: l })}
          >
            {l === 'fr' ? 'Français' : 'English'}
          </button>
        ))}
        <span class="cv-ecart" aria-hidden="true" />
        <button
          type="button"
          class="outil-bascule"
          aria-pressed={e.dense}
          onClick={() => props.onChange({ ...e, dense: !e.dense })}
        >
          {e.dense ? 'Compact' : 'Aéré'}
        </button>
      </div>
    </>
  )
}

export function Outil(props: ProprietesOutil): JSX.Element {
  // Un CV neuf est vide : il s'ouvre sur son formulaire. Il n'a pas d'émetteur,
  // donc pas de quoi appliquer la règle commune — la sienne tient au nom.
  const vide = (props.outil.etat as { identite?: { nom?: unknown } } | null)?.identite?.nom
  const [onglet, setOnglet] = useState<OngletDocument>(
    typeof vide === 'string' && vide.trim() !== '' ? 'Document' : 'Modifier',
  )

  const erreurs = valider(cv.schema, props.outil.etat)
  if (erreurs.length > 0) return <EtatInvalide erreurs={erreurs} />
  const etat = props.outil.etat as EtatCv

  return (
    <CadreDocument
      titre={props.outil.nom}
      glyphe={props.glyphe}
      sousTitre={etat.identite.titre === '' ? 'Curriculum vitæ' : etat.identite.titre}
      onglet={onglet}
      onOnglet={setOnglet}
      onDiffuser={() => props.onDiffuser((c) => cv.share(etat, c) as ShareSpec)}
    >
      {onglet === 'Document' ? (
        <>
          <Manquements
            manquements={controleCv(etat).map((m) => ({
              champ: m.champ,
              libelle: m.libelle,
              gravite: 'bloquant' as const,
            }))}
            consequence="Sans elles, un recruteur ne peut ni te situer ni te rappeler."
            onCompleter={() => setOnglet('Modifier')}
          />
          {debordeUnePage(etat) && (
            <div class="note">
              Ce CV déborde sans doute d’une page.{' '}
              {etat.dense
                ? 'Coupe les faits les moins parlants : deux pages se lisent rarement en entier.'
                : 'Passe en compact, ou coupe les faits les moins parlants.'}
            </div>
          )}
          <Reglages etat={etat} onChange={props.onChange} />
          <DocumentCv etat={etat} />
        </>
      ) : (
        <ChampsSchema
          schema={cv.schema}
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
  _maintenant: Date,
  _extrait: Extrait,
): { nom: string; etat: unknown } {
  if (skeleton !== 'cv') throw new RangeError(`ce fragment ne sait faire qu’un CV : ${skeleton}`)
  return { nom: cv.title, etat: cv.defaults }
}
