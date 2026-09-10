import type { ErreurValidation, JsonSchema } from './types.js'
import { plierLesClefs } from './clefs.js'
import { valider } from './valider.js'

/**
 * La quatrième chose que le modèle a le droit de composer : un formulaire.
 *
 * Les trois autres se lisent. Celui-ci **reçoit** — et c'est la seule chose du
 * produit qui écrive depuis l'extérieur. Un traiteur qui prend les commandes du
 * week-end, un bureau de tontine qui ramasse les inscriptions, un lycée qui
 * recense les présences à une réunion : aujourd'hui, ça se fait par vingt
 * messages WhatsApp qu'il faut recopier à la main dans un cahier.
 *
 * La page publiée est un vrai `<form method="post">`, **sans une ligne de
 * script**. Ce n'est pas une prouesse, c'est la seule façon que ça marche : sur
 * un téléphone d'entrée de gamme, dans le navigateur intégré de WhatsApp, sur
 * une connexion qui hoquette, un formulaire qui dépend de JavaScript est un
 * formulaire qui perd des réponses sans que personne ne le sache. Le navigateur
 * sait faire ça depuis 1995.
 *
 * L'invariant § 2.1 tient comme ailleurs : le modèle ne rend pas de HTML, il
 * remplit cette configuration, et c'est du code écrit à la main qui la dessine.
 * Ce qu'un visiteur renvoie est revalidé contre cette même configuration —
 * personne ne fait confiance à un corps de requête.
 */

/** L'identifiant d'un formulaire composé par le modèle. */
export const ID_COMPOSE_FORMULAIRE = 'compose-formulaire'

/** Ce qu'un champ sait demander. Rien d'autre n'est acceptable. */
export type SorteChamp = 'texte' | 'paragraphe' | 'nombre' | 'telephone' | 'choix' | 'oui-non'

export interface ChampDemande {
  readonly clef: string
  readonly titre: string
  readonly sorte: SorteChamp
  readonly obligatoire?: boolean
  readonly aide?: string
  /** Pour un champ « choix », et pour lui seul. */
  readonly options?: readonly string[]
}

export interface FormulaireDemande {
  readonly titre: string
  readonly kicker: string
  readonly accroche: string
  readonly champs: readonly ChampDemande[]
  /** Ce que dit le bouton. Ex. « Envoyer ma commande ». */
  readonly bouton: string
  /** Ce qu'on lit une fois la réponse partie. */
  readonly merci: string
}

/*
 * Huit champs et six options : au-delà, on ne remplit plus un formulaire sur
 * un téléphone, on abandonne à mi-chemin. Le plafond des réponses n'est pas
 * une limite de produit mais une limite d'abus — une adresse publique où
 * n'importe qui écrit doit avoir un fond.
 */
export const MAX_CHAMPS = 8
export const MAX_OPTIONS = 6
export const MAX_REPONSES = 500

/** Ce qu'une réponse peut faire de long, par champ. */
export const MAX_TEXTE = 200
export const MAX_PARAGRAPHE = 1_000

const schemaChamp: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['clef', 'titre', 'sorte'],
  properties: {
    clef: {
      type: 'string', minLength: 1, maxLength: 24, title: 'Identifiant',
      description:
        'Lettres non accentuées, chiffres, soulignés. Commence par une minuscule. Ex. « nomDuClient ».',
    },
    titre: {
      type: 'string', minLength: 1, maxLength: 60, title: 'La question',
      description: 'Ce qu’on demande, tel qu’on le demanderait de vive voix. Ex. « Ton nom ».',
    },
    sorte: {
      type: 'string',
      enum: ['texte', 'paragraphe', 'nombre', 'telephone', 'choix', 'oui-non'],
      title: 'Sorte de réponse',
      description:
        'texte : une ligne. paragraphe : plusieurs. nombre : une quantité. telephone : un numéro. choix : une liste d’options. oui-non : une case à cocher.',
    },
    obligatoire: {
      type: 'boolean', title: 'Obligatoire',
      description: 'Vrai seulement si la réponse ne sert à rien sans. N’en mets pas partout.',
    },
    aide: {
      type: 'string', maxLength: 90, title: 'Précision',
      description: 'Une phrase sous la question, si elle évite un malentendu.',
    },
    options: {
      type: 'array', maxItems: MAX_OPTIONS, title: 'Options',
      items: { type: 'string', minLength: 1, maxLength: 40, title: 'Option' },
      description: 'Pour un champ « choix », et pour lui seul.',
      ecran: {
        montrerSi: { champ: 'sorte', vaut: ['choix'] },
        ajout: 'Ajouter une option', retrait: 'Retirer l’option',
      },
    },
  },
}

export const schemaFormulaire: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['titre', 'kicker', 'accroche', 'champs', 'bouton', 'merci'],
  properties: {
    titre: {
      type: 'string', minLength: 2, maxLength: 40, title: 'Nom',
      description: 'Ce que le formulaire demande. Ex. « Commandes du week-end ».',
    },
    kicker: {
      type: 'string', minLength: 2, maxLength: 30, title: 'Sur-titre',
      // Le nom du commerce ne s'invente pas non plus : voir « titre » de la page.
      description:
        'En capitales, au-dessus du nom. Le métier suffit si la personne n’a pas donné ' +
        'le nom de son commerce — ex. « TRAITEUR ».',
    },
    accroche: {
      type: 'string', minLength: 4, maxLength: 160, title: 'Accroche',
      description: 'Une ou deux phrases : à quoi ça sert, et jusqu’à quand on peut répondre.',
    },
    champs: {
      type: 'array', minItems: 1, maxItems: MAX_CHAMPS, items: schemaChamp, title: 'Questions',
      description: 'Le moins possible : chaque question de plus est une réponse de moins.',
      ecran: { ajout: 'Ajouter une question', retrait: 'Retirer la question' },
    },
    bouton: {
      type: 'string', minLength: 2, maxLength: 30, title: 'Bouton',
      description: 'Ex. « Envoyer ma commande ».',
    },
    merci: {
      type: 'string', minLength: 4, maxLength: 160, title: 'Après l’envoi',
      description: 'Ce qu’on lit une fois la réponse partie. Dis ce qui va se passer ensuite.',
    },
  },
}

/**
 * Vérifie ce que le modèle a rendu, au-delà de ce que le schéma sait dire.
 *
 * Deux incohérences que le schéma ne peut pas exprimer, et qui font toutes deux
 * un formulaire qu'on ne peut pas remplir : une clef en double — la seconde
 * réponse écraserait la première sans que rien ne le montre — et un champ
 * « choix » sans options, qui est une question dont aucune réponse n'est
 * possible.
 */
/**
 * Les clefs des champs, pliées.
 *
 * Rien ne les désigne ailleurs — c'est au moment des réponses qu'elles servent,
 * et à ce moment-là le formulaire est déjà publié avec les clefs pliées. Le
 * pliage se fait donc ici une fois pour toutes, avant qu'une seule réponse
 * existe : personne ne verra jamais deux orthographes de la même clef.
 */
export function redresserFormulaire(valeur: unknown): unknown {
  if (typeof valeur !== 'object' || valeur === null) return valeur
  const pliage = plierLesClefs((valeur as { champs?: unknown }).champs)
  if (pliage === null || !pliage.change) return valeur
  return { ...valeur, champs: pliage.liste }
}

export function verifierFormulaire(valeur: unknown): readonly ErreurValidation[] {
  const erreurs = [...valider(schemaFormulaire, valeur)]
  if (erreurs.length > 0) return erreurs

  const f = valeur as FormulaireDemande
  const clefs = f.champs.map((c) => c.clef)

  for (const [i, champ] of f.champs.entries()) {
    if (!/^[a-z][a-zA-Z0-9_]*$/.test(champ.clef)) {
      erreurs.push({
        chemin: `$.champs[${i}].clef`,
        message: `« ${champ.clef} » ne prend que des lettres non accentuées, des chiffres et des soulignés, et commence par une minuscule`,
      })
    }
    if (champ.sorte === 'choix' && (champ.options ?? []).length < 2) {
      erreurs.push({
        chemin: `$.champs[${i}].options`,
        message: 'un champ « choix » a besoin d’au moins deux options : sinon il n’y a rien à choisir',
      })
    }
    if (champ.sorte !== 'choix' && champ.options !== undefined) {
      erreurs.push({
        chemin: `$.champs[${i}].options`,
        message: `des options sur un champ « ${champ.sorte} » ne s’afficheraient nulle part`,
      })
    }
  }

  for (const d of new Set(clefs.filter((c, i) => clefs.indexOf(c) !== i))) {
    erreurs.push({
      chemin: '$.champs',
      message: `la clef « ${d} » apparaît deux fois : la seconde réponse écraserait la première`,
    })
  }

  return erreurs
}

/** Une réponse reçue, telle qu'elle est rangée et relue. */
export interface Reponse {
  /** Ce que le visiteur a écrit, par clef de champ. */
  readonly contenu: Readonly<Record<string, string>>
  /** Quand elle est arrivée, en millisecondes depuis l'époque. */
  readonly recuLe: number
}

/**
 * Ce qu'un visiteur a envoyé, ramené à ce que le formulaire demandait.
 *
 * Personne ne fait confiance à un corps de requête : le nom des champs, leur
 * nombre, leur longueur et — pour un choix — les valeurs possibles sont
 * relus contre la configuration publiée. Ce qui n'y figure pas est jeté sans
 * un mot ; ce qui est trop long est coupé plutôt que rejeté, parce qu'une
 * réponse tronquée vaut mieux qu'une réponse perdue pour qui l'a tapée.
 *
 * Rend la liste des manques quand un champ obligatoire est vide : c'est la
 * seule erreur qu'on montre au visiteur, et il faut la lui montrer sur sa
 * page, sans le renvoyer à un formulaire vidé.
 */
export interface Depouille {
  readonly contenu: Readonly<Record<string, string>>
  readonly manques: readonly string[]
}

export function depouiller(
  formulaire: FormulaireDemande,
  recu: Readonly<Record<string, string>>,
): Depouille {
  const contenu: Record<string, string> = {}
  const manques: string[] = []

  for (const champ of formulaire.champs) {
    const brut = (recu[champ.clef] ?? '').trim()
    /*
     * Le vide se reconnaît **avant** toute conversion.
     *
     * `Number('')` vaut zéro : un « Combien de parts ? » qu'on n'a pas rempli
     * se rangeait comme une commande de zéro part, impossible à distinguer de
     * quelqu'un qui aurait vraiment tapé 0 — et un champ nombre obligatoire ne
     * manquait jamais, puisqu'il n'était jamais vide.
     */
    const valeur = brut === '' ? '' : ramener(champ, brut)
    if (valeur === '') {
      if (champ.obligatoire === true) manques.push(champ.titre)
      continue
    }
    contenu[champ.clef] = valeur
  }

  return { contenu, manques }
}

function ramener(champ: ChampDemande, brut: string): string {
  // Une case cochée porte ce que le navigateur veut — « on », « oui », « 1 ».
  if (champ.sorte === 'oui-non') return 'oui'
  if (champ.sorte === 'choix') {
    // Une valeur hors de la liste vient d'ailleurs que de la page : on ne la
    // range pas, plutôt que de laisser un choix inventé passer pour un vote.
    return (champ.options ?? []).includes(brut) ? brut : ''
  }
  if (champ.sorte === 'nombre') {
    const nombre = Number(brut.replace(/\s/g, '').replace(',', '.'))
    return Number.isFinite(nombre) ? String(nombre) : ''
  }
  return brut.slice(0, champ.sorte === 'paragraphe' ? MAX_PARAGRAPHE : MAX_TEXTE)
}
