import type { BatirPartage, ConfigListe, EtatListe, LigneListe, RenderContext, ShareSpec } from '@a237/engine'
import {
  ajouterLigne, basculerLigne, booleenDe, cellule, colonneBascule, colonneIdentite,
  colonnesSecondaires, comptageBascule, lignesEnAlerte, ligneNeuve, montantF, nf,
  retirerLigne, totalListe,
} from '@a237/engine'
import type { JSX } from 'preact'
import { useState } from 'preact/hooks'
import {
  Action, Actions, Badge, Barre, CoquilleOutil, Identite, Rangee, Rangees, Vide,
} from './chrome.js'

/**
 * L'écran d'un registre décrit par ses colonnes.
 *
 * Un seul composant pour la liste de prix, le livre de caisse, l'inventaire et
 * l'annuaire — et pour tous ceux qui suivront. Il ne connaît aucun de ces
 * outils : il lit une configuration.
 */

export type OngletListe = 'Lignes' | 'Ajouter'

const ONGLETS: readonly OngletListe[] = ['Lignes', 'Ajouter']

function valeurSaisie(brut: string, type: string): string | number | boolean {
  if (type === 'texte') return brut
  if (type === 'bascule') return brut === 'oui'
  // Les claviers d'Android d'entrée de gamme envoient espaces et virgules.
  const nombre = Number(brut.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(nombre) && nombre >= 0 ? nombre : 0
}

export function RegistreListe(props: {
  readonly glyphe: string
  readonly config: ConfigListe
  readonly titre: string
  readonly etat: EtatListe
  readonly ctx: RenderContext
  readonly onChange: (etat: EtatListe) => void
  readonly onDiffuser: (batir: BatirPartage) => void
  readonly partage: (etat: EtatListe, ctx: RenderContext) => ShareSpec
  readonly ongletInitial?: OngletListe
}): JSX.Element {
  const [onglet, setOnglet] = useState<OngletListe>(props.ongletInitial ?? 'Lignes')
  const [brouillon, setBrouillon] = useState<Record<string, string>>({})
  const [erreur, setErreur] = useState('')

  const { config, etat } = props
  const identite = colonneIdentite(config)
  const bascule = colonneBascule(config)
  const secondaires = colonnesSecondaires(config)
  const alertees = new Set(lignesEnAlerte(config, etat))
  const total = totalListe(config, etat)
  const compte = comptageBascule(config, etat)

  const kpis = [{ libelle: 'Lignes', valeur: nf(etat.lignes.length) }]
  if (total !== null && config.total !== undefined) {
    const unite = config.total.type === 'somme' ? config.total.unite : 'F'
    kpis.push({
      libelle: config.total.libelle,
      valeur: unite === 'F' ? montantF(total) : nf(total),
    })
  }
  if (alertees.size > 0 && config.alerte !== undefined) {
    kpis.push({ libelle: 'À surveiller', valeur: nf(alertees.size) })
  }

  function ajouter(): void {
    const ligne: Record<string, string | number | boolean> = { ...ligneNeuve(config) }
    for (const c of config.colonnes) {
      const saisi = brouillon[c.clef]
      if (saisi !== undefined) ligne[c.clef] = valeurSaisie(saisi, c.type)
    }
    try {
      props.onChange(ajouterLigne(config, etat, ligne as LigneListe))
      setBrouillon({})
      setErreur('')
      setOnglet('Lignes')
    } catch {
      setErreur('Remplis au moins un champ.')
    }
  }

  return (
    <CoquilleOutil
      titre={etat.nom}
      glyphe={props.glyphe}
      sousTitre={props.titre}
      kpis={kpis}
      onglets={ONGLETS}
      ongletCourant={onglet}
      onOnglet={setOnglet}
    >
      {onglet === 'Lignes' && (
        <>
          {compte !== null && (
            <Barre
              part={compte.total === 0 ? 0 : compte.oui / compte.total}
              legende={`${compte.oui} sur ${compte.total} ${bascule?.titre.toLowerCase() ?? ''}`}
            />
          )}

          {etat.lignes.length === 0 ? (
            <Vide>{config.libelleVide}</Vide>
          ) : (
            <Rangees>
              {etat.lignes.map((ligne, i) => {
                /*
                 * La première colonne nomme la ligne, quel que soit son type.
                 *
                 * Elle devait être du texte, et cette règle rendait certains
                 * registres inexprimables : « combien d'œufs par jour et
                 * combien vendus » n'a aucune colonne texte naturelle. Une
                 * date ou une quantité nomme très bien une ligne — il suffit
                 * de la lire comme elle s'imprime.
                 */
                const nom = cellule(ligne, identite)
                const coche = bascule === null ? true : booleenDe(ligne, bascule.clef)
                return (
                  <Rangee key={`${i}-${nom}`}>
                    <Identite
                      nom={nom === '' ? '—' : nom}
                      detail={secondaires.map((c) => cellule(ligne, c)).join(' · ')}
                      avatar={config.personnes === true}
                    />
                    {alertees.has(i) && config.alerte !== undefined && (
                      <Badge ton="non">{config.alerte.libelle}</Badge>
                    )}
                    {bascule !== null && (
                      <button
                        type="button"
                        class="outil-bascule"
                        aria-pressed={coche}
                        aria-label={`${nom} : ${coche ? bascule.titre.toLowerCase() : `pas ${bascule.titre.toLowerCase()}`}`}
                        onClick={() => props.onChange(basculerLigne(config, etat, i))}
                      >
                        {coche ? 'oui' : 'non'}
                      </button>
                    )}
                    <button
                      type="button"
                      class="outil-retirer"
                      aria-label={`Retirer ${nom === '' ? `la ligne ${i + 1}` : nom}`}
                      onClick={() => props.onChange(retirerLigne(etat, i))}
                    >
                      ×
                    </button>
                  </Rangee>
                )
              })}
            </Rangees>
          )}

          <Actions>
            <Action principale onClick={() => props.onDiffuser((c) => props.partage(etat, c))}>
              Diffuser
            </Action>
            <Action onClick={() => setOnglet('Ajouter')}>{config.libelleAjout}</Action>
          </Actions>
        </>
      )}

      {onglet === 'Ajouter' && (
        <>
          <div class="outil-formulaire">
            {config.colonnes.map((c) =>
              c.type === 'bascule' ? (
                <label class="champ champ-case" key={c.clef}>
                  <input
                    type="checkbox"
                    checked={brouillon[c.clef] === 'oui'}
                    aria-label={c.titre}
                    onChange={(e) =>
                      setBrouillon({
                        ...brouillon,
                        [c.clef]: (e.target as HTMLInputElement).checked ? 'oui' : 'non',
                      })
                    }
                  />
                  <span>{c.titre}</span>
                </label>
              ) : (
                <input
                  key={c.clef}
                  type="text"
                  inputMode={c.type === 'texte' ? 'text' : 'decimal'}
                  placeholder={c.titre}
                  aria-label={c.titre}
                  value={brouillon[c.clef] ?? ''}
                  onInput={(e) =>
                    setBrouillon({ ...brouillon, [c.clef]: (e.target as HTMLInputElement).value })
                  }
                />
              ),
            )}
          </div>

          {erreur !== '' && <p class="note">{erreur}</p>}

          <Actions>
            <Action principale onClick={ajouter}>
              {config.libelleAjout}
            </Action>
            <Action onClick={() => setOnglet('Lignes')}>Retour</Action>
          </Actions>
        </>
      )}
    </CoquilleOutil>
  )
}
