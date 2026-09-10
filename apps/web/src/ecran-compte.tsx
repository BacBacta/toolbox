import { PRIX_MENSUEL_XAF } from '@a237/comptes'
import { dateLongue, montantF } from '@a237/engine'
import type { JSX } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import {
  demanderCode, demarrerPaiement, lireCompte, reprendreAvecCode, retenirEtat, suivrePaiement,
} from './compte.js'
import type { EtatCompte } from './compte.js'

/**
 * L'écran du compte : ce qu'il reste, et comment en avoir plus.
 *
 * Il n'est pas sur le chemin de qui vient faire une facture. On y arrive par
 * une ligne discrète, et tout ce qu'il propose est facultatif : l'atelier
 * marche sans compte, sans abonnement et sans réseau (§ 2).
 *
 * Trois gestes, et un seul coûte de l'argent. Le code de récupération est
 * gratuit et c'est le plus important des trois : sans lui, un téléphone perdu
 * emporte l'abonnement.
 */

type Etape =
  | { readonly sorte: 'repos' }
  | { readonly sorte: 'code'; readonly code: string }
  | { readonly sorte: 'reprendre' }
  | { readonly sorte: 'payer' }
  | { readonly sorte: 'attente'; readonly id: string; readonly consigne: string }

export interface ProprietesCompte {
  readonly etat: EtatCompte | null
  readonly onEtat: (etat: EtatCompte) => void
  readonly onRetour: () => void
}

function joursRestants(expire: number | null, maintenant: number): number {
  if (expire === null) return 0
  return Math.max(0, Math.ceil((expire - maintenant) / 86_400_000))
}

export function EcranCompte(props: ProprietesCompte): JSX.Element {
  const [etape, setEtape] = useState<Etape>({ sorte: 'repos' })
  const [mot, setMot] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [saisi, setSaisi] = useState('')
  const [copie, setCopie] = useState(false)

  const etat = props.etat

  // On rafraîchit à l'ouverture, et seulement là : c'est le seul moment où
  // quelqu'un regarde ce nombre.
  useEffect(() => {
    void lireCompte().then(async (issue) => {
      if (issue.sorte === 'ok') {
        await retenirEtat(issue.valeur)
        props.onEtat(issue.valeur)
      } else if (issue.sorte === 'differe') {
        setMot('Pas de réseau : voici ce qu’on savait la dernière fois.')
      }
    })
    // Une seule fois, à l'ouverture de l'écran.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Tant qu'un paiement est en cours, on redemande où il en est. */
  useEffect(() => {
    if (etape.sorte !== 'attente') return
    const id = etape.id
    const minuteur = setInterval(() => {
      void suivrePaiement(id).then(async (issue) => {
        if (issue.sorte !== 'ok' || issue.valeur.etat === 'attente') return
        clearInterval(minuteur)
        if (issue.valeur.etat === 'reussi') {
          const frais = await lireCompte()
          if (frais.sorte === 'ok') {
            await retenirEtat(frais.valeur)
            props.onEtat(frais.valeur)
          }
          setMot('C’est bon. Ton atelier est ouvert pour un mois.')
        } else {
          setMot('Le paiement n’a pas abouti. Rien n’a été prélevé.')
        }
        setEtape({ sorte: 'repos' })
      })
    }, 3000)
    return () => clearInterval(minuteur)
  }, [etape, props])

  async function tirerUnCode(): Promise<void> {
    setOccupe(true)
    const issue = await demanderCode()
    setOccupe(false)
    if (issue.sorte === 'ok') setEtape({ sorte: 'code', code: issue.valeur.code })
    else setMot(issue.sorte === 'differe' ? 'Pas de réseau.' : issue.pourquoi)
  }

  async function reprendre(): Promise<void> {
    setOccupe(true)
    const issue = await reprendreAvecCode(saisi)
    setOccupe(false)
    if (issue.sorte === 'ok') {
      await retenirEtat(issue.valeur)
      props.onEtat(issue.valeur)
      setEtape({ sorte: 'repos' })
      setSaisi('')
      setMot('Ton atelier est revenu sur ce téléphone.')
      return
    }
    setMot(
      issue.sorte === 'differe'
        ? 'Pas de réseau.'
        : 'Ce code ne correspond à aucun atelier. Vérifie les seize lettres.',
    )
  }

  async function payer(): Promise<void> {
    setOccupe(true)
    const issue = await demarrerPaiement(saisi)
    setOccupe(false)
    if (issue.sorte === 'ok') {
      setEtape({ sorte: 'attente', id: issue.valeur.id, consigne: issue.valeur.consigne })
      setSaisi('')
      setMot('')
      return
    }
    setMot(
      issue.sorte === 'differe'
        ? 'Pas de réseau. Réessaie quand ça revient.'
        : issue.pourquoi,
    )
  }

  return (
    <div class="compte">
      <button type="button" class="retour" onClick={props.onRetour}>
        ← Mes outils
      </button>

      <h2 class="outil-surtitre">Mon atelier</h2>

      {etat === null ? (
        <p class="note">On ne sait pas encore. Il faut du réseau une fois.</p>
      ) : etat.plan === 'atelier' ? (
        <p class="compte-etat">
          <b>Atelier</b>
          <span>
            {joursRestants(etat.expire, Date.now())} jours restants
            {etat.expire === null ? '' : ` · jusqu’au ${dateLongue(new Date(etat.expire))}`}
          </span>
          <span>{etat.credits} compositions</span>
        </p>
      ) : (
        <p class="compte-etat">
          <b>Essai</b>
          <span>
            {etat.credits === 0
              ? 'Plus de composition'
              : `${etat.credits} composition${etat.credits > 1 ? 's' : ''} restante${etat.credits > 1 ? 's' : ''}`}
          </span>
          <span>Tout le reste de l’atelier marche sans rien payer.</span>
        </p>
      )}

      {mot !== '' && <p class="note">{mot}</p>}

      {etape.sorte === 'code' && (
        <div class="compte-code">
          {/* Montré une fois. Personne, nous compris, ne peut le retrouver. */}
          <p class="etiquette">Ton code de récupération</p>
          <p class="compte-code-valeur">{etape.code}</p>
          <p class="note">
            Écris-le quelque part maintenant. Il ne sera plus jamais affiché, et c’est lui
            qui te rendra ton atelier si tu changes de téléphone.
          </p>
          {/*
            Copier plutôt que recopier à la main : seize lettres se transcrivent
            mal sur un écran de téléphone. Le cahier reste le meilleur endroit —
            c'est ce que dit la phrase au-dessus — mais un carnet de notes ou un
            gestionnaire de mots de passe en vaut un autre.
          */}
          <button
            type="button"
            class="atelier-option"
            onClick={() => {
              void navigator.clipboard
                ?.writeText(etape.code)
                .then(() => setCopie(true))
                .catch(() => setCopie(false))
            }}
          >
            <span class="texte">
              <b>{copie ? 'Copié' : 'Copier le code'}</b>
            </span>
          </button>
          <button
            type="button"
            class="atelier-option principale"
            onClick={() => {
              setCopie(false)
              setEtape({ sorte: 'repos' })
            }}
          >
            <span class="texte">
              <b>C’est noté</b>
            </span>
          </button>
        </div>
      )}

      {etape.sorte === 'reprendre' && (
        <div class="compte-saisie">
          <label class="etiquette" for="compte-code">
            Le code de ton autre téléphone
          </label>
          <input
            id="compte-code"
            class="atelier-demande"
            value={saisi}
            placeholder="A2B3-C4D5-E6F7-G8H9"
            autocomplete="off"
            onInput={(e) => setSaisi((e.currentTarget as HTMLInputElement).value)}
          />
          <button
            type="button"
            class="atelier-option principale"
            disabled={occupe}
            onClick={() => void reprendre()}
          >
            <span class="texte">
              <b>Reprendre mon atelier</b>
            </span>
          </button>
        </div>
      )}

      {etape.sorte === 'payer' && (
        <div class="compte-saisie">
          <label class="etiquette" for="compte-tel">
            Ton numéro Mobile Money
          </label>
          <input
            id="compte-tel"
            class="atelier-demande"
            type="tel"
            inputMode="tel"
            value={saisi}
            placeholder="6 99 41 27 08"
            onInput={(e) => setSaisi((e.currentTarget as HTMLInputElement).value)}
          />
          <button
            type="button"
            class="atelier-option principale"
            disabled={occupe}
            onClick={() => void payer()}
          >
            <span class="texte">
              <b>Payer {montantF(PRIX_MENSUEL_XAF)}</b>
              <span>Un mois, quarante compositions</span>
            </span>
          </button>
        </div>
      )}

      {etape.sorte === 'attente' && (
        <div class="compte-saisie">
          <p class="note">{etape.consigne}</p>
          <p class="note">On regarde. Tu peux fermer, ça continue.</p>
        </div>
      )}

      {etape.sorte === 'repos' && (
        <div class="compte-choix">
          {/*
            Ce qui est mis en avant dépend de ce qui manque.
            Pour quelqu'un en essai, c'est l'abonnement. Pour un abonné qui n'a
            pas encore de code, c'est le code : il est à un téléphone perdu de
            perdre ce qu'il vient de payer, et repayer ne le lui rendrait pas.
          */}
          <button
            type="button"
            class={etat?.plan === 'atelier' ? 'atelier-option' : 'atelier-option principale'}
            onClick={() => setEtape({ sorte: 'payer' })}
          >
            <span class="marque" aria-hidden="true">
              ◈
            </span>
            <span class="texte">
              <b>
                {etat?.plan === 'atelier' ? 'Ajouter un mois' : 'Prendre un mois'} —{' '}
                {montantF(PRIX_MENSUEL_XAF)}
              </b>
              <span>
                {etat?.plan === 'atelier'
                  ? 'Les jours qui te restent ne sont pas perdus : ils s’ajoutent'
                  : 'Quarante compositions, et les demandes qui valent plusieurs outils'}
              </span>
            </span>
          </button>

          <button
            type="button"
            class={
              etat?.plan === 'atelier' && etat.aUnCode === false
                ? 'atelier-option principale'
                : 'atelier-option'
            }
            disabled={occupe}
            onClick={() => void tirerUnCode()}
          >
            <span class="marque" aria-hidden="true">
              ◫
            </span>
            <span class="texte">
              <b>{etat?.aUnCode === true ? 'Un nouveau code de récupération' : 'Mon code de récupération'}</b>
              <span>
                {etat?.aUnCode === true
                  ? 'Le précédent ne marchera plus'
                  : 'Sans lui, un téléphone perdu emporte l’atelier'}
              </span>
            </span>
          </button>

          <button type="button" class="atelier-option" onClick={() => setEtape({ sorte: 'reprendre' })}>
            <span class="marque" aria-hidden="true">
              ◷
            </span>
            <span class="texte">
              <b>J’ai déjà un atelier</b>
              <span>Le reprendre avec son code</span>
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
