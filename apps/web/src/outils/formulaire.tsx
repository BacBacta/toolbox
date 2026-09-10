import type { ChampDemande, Extrait, FormulaireDemande, Reponse } from '@a237/engine'
import { dateCourte, heureCourte, schemaFormulaire, verifierFormulaire } from '@a237/engine'
import { PageFormulaire } from '@a237/render/page'
import { Action, Actions, CoquilleOutil } from '@a237/render/registre'
import '@a237/render/styles/vitrine.css'
import type { JSX } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { ChampsSchema } from '../formulaire.js'
import type { Compose, ProprietesOutil } from '../outils.js'
import { dernieresConnues, rafraichir } from '../reponses.js'
import type { Recolte } from '../reponses.js'
import { EtatInvalide } from './commun.js'

/**
 * L'écran d'un formulaire composé.
 *
 * Comme la page, ce qu'on modifie est ce qui se publie. Ce qu'il a en plus est
 * un troisième onglet : **les réponses**. C'est tout l'intérêt de l'outil —
 * aujourd'hui, ramasser quinze commandes se fait par quinze messages WhatsApp
 * qu'il faut recopier à la main dans un cahier.
 *
 * Les réponses sont gardées sur l'appareil dès qu'elles sont lues : un traiteur
 * doit pouvoir relire ses commandes dans son taxi. Le réseau sert à en chercher
 * de nouvelles, pas à consulter celles qu'on a déjà.
 */

const ONGLETS = ['Réponses', 'Aperçu', 'Modifier'] as const
type Onglet = (typeof ONGLETS)[number]

/** Un formulaire tout neuf, qui passe son propre contrôle. */
export const FORMULAIRE_VIDE: FormulaireDemande = {
  titre: 'Mon formulaire',
  kicker: 'MON FORMULAIRE',
  accroche: 'Dis ici ce que tu demandes, et jusqu’à quand on peut répondre.',
  champs: [{ clef: 'nom', titre: 'Ton nom', sorte: 'texte', obligatoire: true }],
  bouton: 'Envoyer',
  merci: 'C’est bien reçu, merci.',
}

export function Outil(props: ProprietesOutil): JSX.Element {
  const [onglet, setOnglet] = useState<Onglet>('Réponses')
  const erreurs = verifierFormulaire(props.outil.etat)
  if (erreurs.length > 0) return <EtatInvalide erreurs={erreurs} />

  const formulaire = props.outil.etat as FormulaireDemande

  return (
    <CoquilleOutil
      titre={formulaire.titre}
      glyphe={props.glyphe}
      sousTitre={formulaire.kicker}
      kpis={[]}
      onglets={ONGLETS}
      ongletCourant={onglet}
      onOnglet={setOnglet}
    >
      {onglet === 'Réponses' && <Recu formulaire={formulaire} lien={props.outil.lien} />}

      {onglet === 'Aperçu' && (
        <>
          <div class="page-apercu">
            {/*
              * Sans `action` : l'aperçu ne poste nulle part et ses champs sont
              * inertes. Un aperçu qui envoie vraiment ajouterait la réponse de
              * celui qui a fabriqué le formulaire à celles qu'il attend.
              */}
            <PageFormulaire formulaire={formulaire} />
          </div>
          <Actions>
            <Action principale onClick={() => props.onDiffuser((c) => partage(formulaire, c))}>
              Publier et partager
            </Action>
          </Actions>
        </>
      )}

      {onglet === 'Modifier' && (
        <ChampsSchema
          schema={schemaFormulaire}
          valeur={formulaire}
          onChange={(v) => props.onChange(v)}
        />
      )}
    </CoquilleOutil>
  )
}

/**
 * Ce que le formulaire a reçu.
 *
 * Il montre d'abord ce qu'on avait — instantanément, hors ligne — puis va
 * chercher la suite. L'ordre compte : un écran qui attend le réseau avant de
 * montrer quoi que ce soit est un écran vide sur une connexion qui hoquette,
 * et un écran vide se lit « personne n'a répondu ».
 */
function Recu(props: {
  readonly formulaire: FormulaireDemande
  readonly lien: string | undefined
}): JSX.Element {
  const lien = props.lien
  const [recolte, setRecolte] = useState<Recolte | null>(null)
  const [enCours, setEnCours] = useState(false)

  useEffect(() => {
    if (lien === undefined) return
    let vivant = true
    void dernieresConnues(lien).then((r) => {
      if (vivant) setRecolte(r)
    })
    setEnCours(true)
    void rafraichir(lien, new Date()).then((r) => {
      if (!vivant) return
      setRecolte(r)
      setEnCours(false)
    })
    return () => {
      vivant = false
    }
  }, [lien])

  if (lien === undefined) {
    return (
      <p class="note">
        Ce formulaire n’est pas encore publié. Ouvre l’aperçu et partage-le : les réponses
        arriveront ici.
      </p>
    )
  }

  const reponses = recolte?.reponses ?? []

  return (
    <>
      {recolte?.horsLigne === true && (
        <p class="note">
          Pas de réseau : voici les {reponses.length === 0 ? 'réponses' : `${reponses.length}`}{' '}
          {reponses.length === 0 ? '' : 'réponses '}
          déjà rapportées. Il y en a peut-être de nouvelles.
        </p>
      )}

      {reponses.length > 0 && (
        // Le compte d'abord : c'est la première chose qu'on vient voir, et
        // souvent la seule — quinze commandes ou trois, ça ne se décide pas
        // pareil.
        <p class="reponses-compte">
          {reponses.length === 1 ? '1 réponse' : `${reponses.length} réponses`}
        </p>
      )}

      {reponses.length === 0 ? (
        <p class="note">
          {enCours && recolte === null
            ? 'Je regarde…'
            : 'Personne n’a encore répondu. Renvoie le lien : c’est souvent tout ce qu’il manque.'}
        </p>
      ) : (
        <div class="reponses">
          {reponses.map((r) => (
            <UneReponse formulaire={props.formulaire} reponse={r} key={r.recuLe} />
          ))}
        </div>
      )}
    </>
  )
}

function UneReponse(props: {
  readonly formulaire: FormulaireDemande
  readonly reponse: Reponse
}): JSX.Element {
  const quand = new Date(props.reponse.recuLe)
  return (
    <article class="reponse">
      <p class="reponse-quand">
        {dateCourte(quand)} à {heureCourte(quand)}
      </p>
      <dl>
        {/*
          * On parcourt les champs du formulaire et non les clefs reçues :
          * l'ordre est alors celui des questions, le même d'une réponse à
          * l'autre, et une clef d'une version précédente ne s'affiche pas sous
          * un nom qui n'existe plus.
          */}
        {props.formulaire.champs
          .filter((c) => (props.reponse.contenu[c.clef] ?? '') !== '')
          .map((c) => (
            <div class="reponse-ligne" key={c.clef}>
              <dt>{c.titre}</dt>
              <dd>{dire(c, props.reponse.contenu[c.clef] ?? '')}</dd>
            </div>
          ))}
      </dl>
    </article>
  )
}

/** « oui » plutôt que la valeur brute d'une case cochée. */
function dire(champ: ChampDemande, valeur: string): string {
  return champ.sorte === 'oui-non' ? 'oui' : valeur
}

/**
 * Ce qui part dans une discussion : le lien, et de quoi donner envie de
 * l'ouvrir. Jamais les réponses — elles sont à celui qui les reçoit.
 */
function partage(
  formulaire: FormulaireDemande,
  ctx: { readonly lien: string; readonly maintenant: Date },
): ReturnType<NonNullable<Parameters<ProprietesOutil['onDiffuser']>[0]>> {
  return {
    title: formulaire.titre,
    desc: formulaire.accroche,
    name: 'compose-formulaire',
    txt: [
      `${formulaire.titre.toUpperCase()} — ${formulaire.kicker.toLowerCase()}`,
      formulaire.accroche,
      ctx.lien,
    ]
      .filter((l) => l !== '')
      .join('\n'),
    broad: null,
    warn: null,
    card: {
      kicker: formulaire.kicker,
      title: formulaire.titre,
      sub: formulaire.accroche,
      tag: null,
      bigLabel: '',
      big: formulaire.bouton,
      pct: null,
      subline: '',
      listTitle: 'CE QU’ON TE DEMANDE',
      items: formulaire.champs.map((c) => ({ n: c.titre, ok: false, warn: false, val: null })),
      link: ctx.lien,
      stamp: '',
    },
    relances: [],
    relancesVides: 'Un formulaire se partage, il ne relance personne.',
  }
}

export function creer(
  _skeleton: string,
  _maintenant: Date,
  _extrait: Extrait,
  compose?: Compose,
): { nom: string; etat: unknown } {
  const formulaire = compose?.formulaire ?? FORMULAIRE_VIDE
  return { nom: formulaire.titre, etat: formulaire }
}
