import type { ChampDemande, FormulaireDemande } from '@a237/engine'
import { MAX_PARAGRAPHE, MAX_TEXTE } from '@a237/engine'
import type { JSX } from 'preact'

/**
 * Un formulaire composé, dessiné à la main.
 *
 * **Aucun script.** Ce n'est pas une prouesse, c'est la seule façon que ça
 * marche : sur un téléphone d'entrée de gamme, dans le navigateur intégré de
 * WhatsApp, sur une connexion qui hoquette, un formulaire qui dépend de
 * JavaScript est un formulaire qui perd des réponses sans que personne ne le
 * sache. Le navigateur sait poster un `<form>` depuis 1995, et il le fait même
 * quand la page n'a pas fini de charger.
 *
 * Le même composant sert l'aperçu dans l'application et la page publiée. Dans
 * l'aperçu il ne poste nulle part — `action` est vide et les champs sont
 * inertes — mais il montre exactement ce qu'un visiteur verra. Un aperçu qui
 * ressemble n'est pas un aperçu.
 */

/**
 * Le champ que personne ne doit remplir.
 *
 * Un robot qui remplit tout ce qu'il trouve remplit aussi celui-là, et sa
 * réponse part à la poubelle. C'est la seule défense qui ne demande rien à
 * l'utilisateur : pas d'image à déchiffrer, pas de case « je ne suis pas un
 * robot » qui charge trois cents kilo-octets de script.
 *
 * Il est caché par le style et non par `type="hidden"` : un champ caché de
 * type `hidden` se repère, un champ de texte hors écran se remplit.
 */
export const CHAMP_PIEGE = 'ne_rien_ecrire_ici'

function Champ(props: { readonly champ: ChampDemande; readonly inerte: boolean }): JSX.Element {
  const c = props.champ
  const id = `f-${c.clef}`
  const commun = {
    id,
    name: c.clef,
    required: c.obligatoire === true,
    ...(props.inerte ? { disabled: true } : {}),
  }

  return (
    <label class="form-champ" for={id}>
      <span class="form-question">
        {c.titre}
        {c.obligatoire === true && <i aria-hidden="true"> *</i>}
      </span>

      {c.sorte === 'paragraphe' && <textarea {...commun} rows={3} maxLength={MAX_PARAGRAPHE} />}

      {c.sorte === 'choix' && (
        <select {...commun}>
          {/*
            * Une option vide en tête, et non la première option pré-choisie :
            * sans elle, un champ facultatif qu'on n'a pas touché renvoie la
            * première réponse de la liste, et on compte comme un choix ce qui
            * n'était que l'ordre d'affichage.
            */}
          <option value="">—</option>
          {(c.options ?? []).map((o) => (
            <option value={o} key={o}>
              {o}
            </option>
          ))}
        </select>
      )}

      {c.sorte === 'oui-non' && <input {...commun} type="checkbox" value="oui" />}

      {c.sorte === 'nombre' && <input {...commun} type="text" inputMode="decimal" />}

      {c.sorte === 'telephone' && (
        <input {...commun} type="tel" inputMode="tel" autocomplete="tel" maxLength={MAX_TEXTE} />
      )}

      {c.sorte === 'texte' && <input {...commun} type="text" maxLength={MAX_TEXTE} />}

      {c.aide !== undefined && c.aide !== '' && <span class="form-aide">{c.aide}</span>}
    </label>
  )
}

export function PageFormulaire(props: {
  readonly formulaire: FormulaireDemande
  /**
   * Où poster. Vide dans l'aperçu, qui ne poste nulle part et dont les champs
   * sont alors inertes : un aperçu qui envoie vraiment une réponse ajouterait
   * la réponse de celui qui a fabriqué le formulaire à celles qu'il attend.
   */
  readonly action?: string
  /** Les champs obligatoires laissés vides, quand le serveur en a trouvé. */
  readonly manques?: readonly string[]
  /** Vrai quand le formulaire a atteint son fond et n'accepte plus rien. */
  readonly ferme?: boolean
}): JSX.Element {
  const f = props.formulaire
  const inerte = props.action === undefined || props.action === ''
  const manques = props.manques ?? []

  return (
    <article class="vitrine form">
      <header class="vitrine-tete">
        <p class="kicker">{f.kicker}</p>
        <h1>{f.titre}</h1>
        <p class="accroche">{f.accroche}</p>
      </header>

      {props.ferme === true ? (
        <p class="form-clos">
          Ce formulaire ne prend plus de réponses. Écris directement à la personne qui te l’a
          envoyé.
        </p>
      ) : (
        <form class="form-corps" method="post" action={props.action ?? ''}>
          {manques.length > 0 && (
            /*
             * Le seul reproche qu'on montre à un visiteur, et il est nommé.
             * « Formulaire incomplet » oblige à relire huit questions ; la
             * liste dit laquelle.
             */
            <p class="form-manque" role="alert">
              Il manque {manques.join(', ')}.
            </p>
          )}

          {f.champs.map((c) => (
            <Champ champ={c} inerte={inerte} key={c.clef} />
          ))}

          <label class="form-piege" for={`f-${CHAMP_PIEGE}`} aria-hidden="true">
            Laisse ce champ vide
            <input id={`f-${CHAMP_PIEGE}`} type="text" name={CHAMP_PIEGE} tabIndex={-1} autocomplete="off" />
          </label>

          <button type="submit" class="form-envoyer" disabled={inerte}>
            {f.bouton}
          </button>
        </form>
      )}
    </article>
  )
}

/**
 * Ce qu'on lit une fois la réponse partie.
 *
 * Une page à part, servie après une redirection, et non le même document avec
 * un message en haut : rafraîchir après un `POST` renvoie la même réponse une
 * deuxième fois, et personne ne le sait avant de compter les commandes.
 */
export function PageMerci(props: { readonly formulaire: FormulaireDemande }): JSX.Element {
  return (
    <article class="vitrine form">
      <header class="vitrine-tete">
        <p class="kicker">{props.formulaire.kicker}</p>
        <h1>{props.formulaire.titre}</h1>
      </header>
      <p class="form-merci">{props.formulaire.merci}</p>
    </article>
  )
}
