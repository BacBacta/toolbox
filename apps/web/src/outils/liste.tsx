import type { EtatListe } from '@a237/engine'
import type { RegistreDemande, SqueletteListe } from '@a237/engine'
import { REGISTRES_LISTE, squeletteListe, valider } from '@a237/engine'
import { RegistreListe } from '@a237/render/registre'
import type { JSX } from 'preact'
import type { Compose, ProprietesOutil } from '../outils.js'
import { EtatInvalide } from './commun.js'
import type { Extrait } from '@a237/engine'

/**
 * L'adaptateur des registres décrits par leurs colonnes.
 *
 * Un seul fragment pour quatre outils — liste de prix, livre de caisse,
 * inventaire, annuaire — parce qu'ils partagent leur écran et leur moteur. Le
 * cinquième n'ajoutera rien ici.
 */

const PAR_ID = new Map(REGISTRES_LISTE.map((s) => [s.id, s]))

/**
 * Un registre composé par le modèle n'a pas de squelette : sa configuration
 * voyage avec lui, dans l'outil enregistré.
 *
 * C'est la thèse du brief prise au mot (§ 2.1, § 4) — le modèle n'a produit
 * que de la configuration, et c'est `RegistreListe`, écrit à la main et testé,
 * qui la dessine. Rien ici ne distingue un registre composé d'un squelette,
 * sinon d'où vient sa description ; il s'ouvre hors ligne comme les autres.
 */
export const ID_COMPOSE = 'compose'

function squeletteCompose(registre: RegistreDemande): SqueletteListe {
  return squeletteListe({
    id: ID_COMPOSE,
    title: registre.titre,
    group: 'registres',
    keywords: [],
    titreNom: registre.titreNom,
    config: {
      kicker: registre.kicker,
      colonnes: registre.colonnes,
      libelleVide: registre.libelleVide,
      libelleAjout: registre.libelleAjout,
      relancesVides: registre.relancesVides,
      ...(registre.total !== undefined ? { total: registre.total } : {}),
      ...(registre.personnes !== undefined ? { personnes: registre.personnes } : {}),
    },
  })
}

export function Outil(props: ProprietesOutil): JSX.Element {
  const compose = props.outil.registre
  const squelette =
    compose !== undefined ? squeletteCompose(compose) : PAR_ID.get(props.outil.skeleton)
  if (squelette === undefined) {
    return (
      <EtatInvalide
        erreurs={[{ chemin: '$', message: `registre inconnu : ${props.outil.skeleton}` }]}
      />
    )
  }

  const erreurs = valider(squelette.schema, props.outil.etat)
  if (erreurs.length > 0) return <EtatInvalide erreurs={erreurs} />

  return (
    <RegistreListe
      glyphe={props.glyphe}
      config={squelette.config}
      titre={squelette.title}
      etat={props.outil.etat as EtatListe}
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
  const registre = compose?.registre
  const squelette = registre !== undefined ? squeletteCompose(registre) : PAR_ID.get(skeleton)
  if (squelette === undefined) throw new RangeError(`registre inconnu : ${skeleton}`)
  // Rien dans une phrase ne se transpose en lignes de registre sans inventer.
  return { nom: squelette.title, etat: squelette.defaults }
}
