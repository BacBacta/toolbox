import type { TypeColonne } from './compute/liste.js'
import type { ErreurValidation, JsonSchema } from './types.js'
import { valider } from './valider.js'

/**
 * La seule chose que le modèle a le droit de produire.
 *
 * Invariant § 2.1 du brief : **jamais de génération de code libre**. Le modèle
 * ne rend pas du HTML, pas du JavaScript, pas un gabarit — il remplit une
 * configuration de registre, et c'est `RegistreListe`, écrit à la main et
 * testé, qui la dessine. Ce fichier est la frontière : au-delà, rien de ce que
 * le modèle a dit n'atteint l'écran sans être passé par ici.
 *
 * Le contrat vit dans le moteur, pas dans le paquet qui appelle le modèle : le
 * client doit pouvoir revérifier ce que le serveur lui envoie sans importer de
 * quoi appeler un fournisseur. Deux validateurs qui se recopient finiraient par
 * diverger, et c'est celui du client qui se tairait.
 *
 * Le choix du registre décrit par ses colonnes n'est pas arbitraire. Quatre
 * squelettes du prototype n'étaient déjà que ça, et la fabrique en tire schéma,
 * validation, calculs, carte, partage et formulaire. Un cinquième registre
 * coûte vingt lignes de description — c'est exactement ce qu'un modèle sait
 * écrire, et exactement ce qu'il ne peut pas casser.
 */

/*
 * `TypeColonne` vient de `compute/liste.ts` : c'est le même vocabulaire, et le
 * redéclarer ici en ferait deux qui divergeraient au premier type ajouté.
 */
export interface ColonneDemandee {
  readonly clef: string
  readonly titre: string
  readonly type: TypeColonne
}

export interface RegistreDemande {
  readonly titre: string
  readonly kicker: string
  readonly titreNom: string
  readonly colonnes: readonly ColonneDemandee[]
  readonly libelleVide: string
  readonly libelleAjout: string
  readonly relancesVides: string
  readonly total?:
    | { readonly type: 'somme'; readonly clef: string; readonly libelle: string; readonly unite: 'F' | '' }
    | { readonly type: 'difference'; readonly plus: string; readonly moins: string; readonly libelle: string }
  readonly personnes?: boolean
}

/** Six colonnes tiennent sur un écran de 360 px. Au-delà, c'est un tableur. */
export const MAX_COLONNES = 6

/**
 * Le schéma que l'invite impose au modèle.
 *
 * Les `description` ne sont pas de la documentation : elles sont lues par le
 * modèle et ce sont elles qui font la différence entre une colonne « montant »
 * et une colonne « nombre ». Écrites pour lui, donc, pas pour nous.
 */
export const schemaRegistre: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['titre', 'kicker', 'titreNom', 'colonnes', 'libelleVide', 'libelleAjout', 'relancesVides'],
  properties: {
    titre: {
      type: 'string', minLength: 2, maxLength: 40, title: 'Nom de l’outil',
      description: 'Court, au singulier, sans article. Ex. « Suivi des livraisons ».',
    },
    kicker: {
      type: 'string', minLength: 2, maxLength: 30, title: 'Sur-titre de la carte',
      description: 'Le même, en capitales, pour la carte partagée. Ex. « SUIVI DES LIVRAISONS ».',
    },
    titreNom: {
      type: 'string', minLength: 2, maxLength: 40, title: 'Libellé du nom',
      description: 'Comment on demande à l’utilisateur de nommer son registre. Ex. « Nom du dépôt ».',
    },
    colonnes: {
      type: 'array', minItems: 1, maxItems: MAX_COLONNES, title: 'Colonnes',
      description:
        'La première nomme la ligne et doit être de type texte. Au plus une colonne de type bascule.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['clef', 'titre', 'type'],
        properties: {
          clef: {
            type: 'string', minLength: 1, maxLength: 24,
            description: 'Identifiant : lettres non accentuées, chiffres, soulignés. Commence par une minuscule. Ex. « prixUnitaire » ou « prix_unitaire ».',
          },
          titre: {
            type: 'string', minLength: 1, maxLength: 32,
            description: 'Ce que voit l’utilisateur. Ex. « Prix (F CFA) ».',
          },
          type: {
            type: 'string', enum: ['texte', 'montant', 'nombre', 'bascule'],
            description:
              'montant = une somme en francs CFA ; nombre = une quantité ; bascule = oui/non.',
          },
        },
      },
    },
    libelleVide: {
      type: 'string', minLength: 4, maxLength: 80,
      description: 'Ce qu’on lit quand le registre est vide. Ex. « L’inventaire est vide. »',
    },
    libelleAjout: {
      type: 'string', minLength: 4, maxLength: 40,
      description: 'Le bouton d’ajout. Ex. « Ajouter un article ».',
    },
    relancesVides: {
      type: 'string', minLength: 4, maxLength: 160,
      description: 'Pourquoi ce registre ne se relance pas. Une phrase.',
    },
    total: {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'libelle'],
      description: 'À n’écrire que si totaliser ce registre a un sens.',
      properties: {
        type: { type: 'string', enum: ['somme', 'difference'] },
        clef: { type: 'string', maxLength: 24, description: 'Pour une somme : la colonne à additionner.' },
        plus: { type: 'string', maxLength: 24, description: 'Pour une différence : la colonne ajoutée.' },
        moins: { type: 'string', maxLength: 24, description: 'Pour une différence : la colonne retranchée.' },
        libelle: { type: 'string', minLength: 2, maxLength: 24, description: 'Ex. « Solde ».' },
        unite: { type: 'string', enum: ['F', ''], description: 'F pour des francs, vide sinon.' },
      },
    },
    personnes: {
      type: 'boolean',
      description: 'Vrai seulement si chaque ligne nomme quelqu’un — un annuaire, une présence.',
    },
  },
}

/**
 * Ce que le schéma ne peut pas dire.
 *
 * JSON Schema vérifie des formes, pas des accords : que `total.clef` désigne
 * une colonne qui existe, qu'une seule bascule serve d'interrupteur, que la
 * première colonne nomme bien la ligne. Sans ces contrôles, une configuration
 * « valide » ferait un registre qui totalise une colonne absente — et
 * l'utilisateur verrait un zéro qu'il ne saurait pas expliquer.
 *
 * Un seul essai de reprise est prévu (§ 3) : ces messages repartent au modèle,
 * donc ils lui disent quoi corriger, pas seulement que c'est faux.
 */
export function verifierRegistre(valeur: unknown): readonly ErreurValidation[] {
  const erreurs = [...valider(schemaRegistre, valeur)]
  if (erreurs.length > 0) return erreurs

  const r = valeur as RegistreDemande
  const clefs = r.colonnes.map((c) => c.clef)

  const premiere = r.colonnes[0]
  if (premiere !== undefined && premiere.type !== 'texte') {
    erreurs.push({
      chemin: '$.colonnes[0].type',
      message: 'la première colonne nomme la ligne : elle doit être de type texte',
    })
  }

  /*
   * Le souligné est accepté.
   *
   * La règle exigeait du camelCase, et une génération réelle est morte
   * là-dessus : le modèle avait écrit `nom_poule`, qui ne casse rien — la clef
   * ne sert que de propriété d'objet et de nom de champ, jamais d'URL. Pire,
   * le reproche disait « minuscule initiale, ni accent ni espace », trois
   * conditions que `nom_poule` remplit : le modèle a relu, n'a rien trouvé à
   * corriger, et a renvoyé la même chose. Une reprise coûte un tour entier ;
   * une reprise qui ne peut pas aboutir les gaspille tous les deux.
   *
   * Le message nomme donc ce qui est refusé, pas ce qui est exigé.
   */
  for (const [i, c] of r.colonnes.entries()) {
    if (!/^[a-z][a-zA-Z0-9_]*$/.test(c.clef)) {
      const fautifs = [...new Set([...c.clef].filter((x) => !/[a-zA-Z0-9_]/.test(x)))]
      erreurs.push({
        chemin: `$.colonnes[${i}].clef`,
        message:
          fautifs.length > 0
            ? `« ${c.clef} » contient ${fautifs.map((x) => `« ${x} »`).join(', ')} : la clef ne prend que des lettres non accentuées, des chiffres et des soulignés`
            : `« ${c.clef} » doit commencer par une lettre minuscule`,
      })
    }
  }

  const doublons = clefs.filter((c, i) => clefs.indexOf(c) !== i)
  for (const d of new Set(doublons)) {
    erreurs.push({ chemin: '$.colonnes', message: `la clef « ${d} » apparaît deux fois` })
  }

  const bascules = r.colonnes.filter((c) => c.type === 'bascule')
  if (bascules.length > 1) {
    erreurs.push({
      chemin: '$.colonnes',
      message: 'une seule colonne de type bascule : c’est l’interrupteur de la ligne',
    })
  }

  const t = r.total
  if (t !== undefined) {
    const exige = t.type === 'somme' ? [['clef', t.clef]] : [['plus', t.plus], ['moins', t.moins]]
    for (const [champ, clef] of exige) {
      if (clef === undefined) {
        erreurs.push({ chemin: `$.total.${champ}`, message: `un total « ${t.type} » exige ${champ}` })
      } else if (!clefs.includes(clef)) {
        erreurs.push({
          chemin: `$.total.${champ}`,
          message: `« ${clef} » ne désigne aucune colonne (elles s’appellent ${clefs.join(', ')})`,
        })
      }
    }
  }

  return erreurs
}
