/**
 * Traduire l'erreur, hors ligne et tout de suite.
 *
 * La console affichait `Uncaught SyntaxError: Unexpected token '{'`. Pour
 * quelqu'un qui apprend, cette phrase ne dit rien — et s'il ne lit pas
 * l'anglais, elle ne dit rien du tout. Or c'est précisément le moment où il
 * conclut qu'il n'y arrive pas, alors qu'il lui manquait une virgule.
 *
 * Les erreurs d'un débutant forment un **ensemble fermé** : une trentaine de
 * messages en couvrent la quasi-totalité. Un dictionnaire les explique sans
 * réseau, sans clef et sans coût — ce qui vaut mieux qu'un appel au modèle pour
 * dire qu'il manque une parenthèse, et qui marche pendant la coupure. Le modèle
 * reste le recours pour ce que ce dictionnaire ne connaît pas.
 *
 * **Deux langues, parce que le pays en a deux.** Le français et l'anglais sont
 * tous deux officiels au Cameroun, et le Nord-Ouest et le Sud-Ouest sont
 * anglophones. Un outil d'apprentissage qui ne parle qu'une des deux en exclut
 * une partie — et ce n'est pas une partie qu'on choisit d'exclure.
 */

export const LANGUES = ['fr', 'en'] as const
export type Langue = (typeof LANGUES)[number]

export interface Explication {
  /** Ce qui s'est passé, en une phrase. */
  readonly quoi: string
  /** Ce qu'il faut aller regarder. Jamais vide : c'est ce qui débloque. */
  readonly faire: string
}

/**
 * La langue du téléphone, ramenée aux deux qu'on parle.
 *
 * Le français est le repli, parce qu'il est majoritaire dans le pays — mais
 * l'anglophone n'a pas à le subir : le choix se change à l'écran, et il tient.
 */
export function langueDuNavigateur(etiquette: string | undefined): Langue {
  return (etiquette ?? '').toLowerCase().startsWith('en') ? 'en' : 'fr'
}

/** Une entrée du dictionnaire : le motif, et ce qu'on en dit dans les deux langues. */
interface Entree {
  readonly motif: RegExp
  readonly dit: Readonly<Record<Langue, (nom: string) => Explication>>
}

/*
 * Les messages sont ceux de Chrome, qui est le navigateur de ces téléphones.
 * Ceux de Firefox et de Safari diffèrent ; les motifs sont écrits assez larges
 * pour en attraper la plupart, et ce qui passe au travers va au modèle.
 */
const DICTIONNAIRE: readonly Entree[] = [
  {
    motif: /Unexpected token '?(.)'?/i,
    dit: {
      fr: (n) => ({
        quoi: `Le navigateur ne s’attendait pas à trouver « ${n} » ici.`,
        faire: 'Regarde la ligne juste avant : il manque souvent une virgule, une parenthèse ou une accolade fermante.',
      }),
      en: (n) => ({
        quoi: `The browser did not expect to find "${n}" here.`,
        faire: 'Look at the line just before: a comma, a closing bracket or a closing brace is usually missing.',
      }),
    },
  },
  {
    motif: /Unexpected end of input/i,
    dit: {
      fr: () => ({
        quoi: 'Le code s’arrête alors que quelque chose est resté ouvert.',
        faire: 'Compte tes accolades { } et tes parenthèses ( ) : il en manque une à fermer, souvent tout en bas.',
      }),
      en: () => ({
        quoi: 'The code ends while something is still open.',
        faire: 'Count your braces { } and brackets ( ): one is never closed, usually at the very bottom.',
      }),
    },
  },
  {
    motif: /(?:Uncaught )?ReferenceError: (\w+) is not defined/,
    dit: {
      fr: (n) => ({
        quoi: `« ${n} » n’existe pas au moment où tu t’en sers.`,
        faire: `Vérifie l’orthographe, ou déclare-le avant : « let ${n} = … ». Attention aux majuscules, elles comptent.`,
      }),
      en: (n) => ({
        quoi: `"${n}" does not exist at the point where you use it.`,
        faire: `Check the spelling, or declare it first: "let ${n} = …". Capital letters matter.`,
      }),
    },
  },
  {
    motif: /(\w+) is not a function/,
    dit: {
      fr: (n) => ({
        quoi: `« ${n} » existe, mais ce n’est pas une fonction : on ne peut pas l’appeler avec ( ).`,
        faire: `Regarde ce que tu as mis dans « ${n} ». C’est peut-être un nombre ou un texte, ou le nom est mal orthographié.`,
      }),
      en: (n) => ({
        quoi: `"${n}" exists, but it is not a function: it cannot be called with ( ).`,
        faire: `Check what you put in "${n}". It may be a number or a string, or the name is misspelled.`,
      }),
    },
  },
  {
    motif: /Cannot read propert(?:y|ies) of (null|undefined)(?: \(reading '(\w+)'\))?/,
    dit: {
      fr: (n) => ({
        quoi: `Tu demandes « ${n || 'quelque chose' } » à un élément qui n’existe pas.`,
        faire: 'Le plus souvent, un getElementById ne trouve rien : vérifie que l’identifiant est le même dans le HTML et dans le script.',
      }),
      en: (n) => ({
        quoi: `You ask for "${n || 'something'}" on an element that does not exist.`,
        faire: 'Most often a getElementById found nothing: check the id is the same in the HTML and in the script.',
      }),
    },
  },
  {
    motif: /missing \) after argument list/i,
    dit: {
      fr: () => ({
        quoi: 'Une parenthèse ouverte n’a jamais été fermée.',
        faire: 'Regarde le dernier appel de fonction que tu as écrit : il lui manque sa parenthèse fermante.',
      }),
      en: () => ({
        quoi: 'An opening bracket was never closed.',
        faire: 'Look at the last function call you wrote: its closing bracket is missing.',
      }),
    },
  },
  {
    motif: /Assignment to constant variable/i,
    dit: {
      fr: () => ({
        quoi: 'Tu changes une valeur déclarée avec « const », et const ne se change pas.',
        faire: 'Remplace « const » par « let » à l’endroit où tu l’as déclarée.',
      }),
      en: () => ({
        quoi: 'You are changing a value declared with "const", and const cannot change.',
        faire: 'Replace "const" with "let" where you declared it.',
      }),
    },
  },
  {
    motif: /Maximum call stack size exceeded/i,
    dit: {
      fr: () => ({
        quoi: 'Une fonction s’appelle elle-même sans jamais s’arrêter : c’est une boucle infinie.',
        faire: 'Cherche la fonction qui se rappelle elle-même et donne-lui une condition d’arrêt.',
      }),
      en: () => ({
        quoi: 'A function calls itself and never stops: this is an infinite loop.',
        faire: 'Find the function that calls itself and give it a stopping condition.',
      }),
    },
  },
  {
    motif: /Identifier '(\w+)' has already been declared/,
    dit: {
      fr: (n) => ({
        quoi: `« ${n} » a déjà été déclaré plus haut, dans le même endroit.`,
        faire: `Enlève le deuxième « let ${n} » ou « const ${n} » : il suffit d’écrire « ${n} = … » pour changer sa valeur.`,
      }),
      en: (n) => ({
        quoi: `"${n}" has already been declared above, in the same place.`,
        faire: `Remove the second "let ${n}" or "const ${n}": writing "${n} = …" is enough to change its value.`,
      }),
    },
  },
  {
    motif: /Cannot access '(\w+)' before initialization/,
    dit: {
      fr: (n) => ({
        quoi: `Tu te sers de « ${n} » avant la ligne qui le déclare.`,
        faire: `Déplace la déclaration de « ${n} » plus haut, avant l’endroit où tu t’en sers.`,
      }),
      en: (n) => ({
        quoi: `You use "${n}" before the line that declares it.`,
        faire: `Move the declaration of "${n}" higher up, above where you use it.`,
      }),
    },
  },
  {
    motif: /(?:Invalid or unexpected token|Unterminated string)/i,
    dit: {
      fr: () => ({
        quoi: 'Un texte entre guillemets n’a jamais été refermé.',
        faire: 'Vérifie tes guillemets " " et tes apostrophes \' \' : ils vont toujours par deux, et un accent courbe « ” » ne compte pas.',
      }),
      en: () => ({
        quoi: 'A quoted string was never closed.',
        faire: 'Check your quotes " " and apostrophes \' \': they always come in pairs, and a curly quote "”" does not count.',
      }),
    },
  },
  {
    motif: /(\w+) is not iterable/,
    dit: {
      fr: (n) => ({
        quoi: `« ${n} » n’est pas une liste : on ne peut pas le parcourir.`,
        faire: `Vérifie que « ${n} » contient bien un tableau [ ] avant de faire un for … of dessus.`,
      }),
      en: (n) => ({
        quoi: `"${n}" is not a list: it cannot be looped over.`,
        faire: `Check that "${n}" really holds an array [ ] before running a for … of on it.`,
      }),
    },
  },
  {
    motif: /Unexpected identifier '?(\w+)'?/,
    dit: {
      fr: (n) => ({
        quoi: `Le navigateur trouve « ${n} » là où il attendait autre chose.`,
        faire: 'Il manque souvent un point-virgule, une virgule ou un opérateur juste avant.',
      }),
      en: (n) => ({
        quoi: `The browser found "${n}" where it expected something else.`,
        faire: 'A semicolon, a comma or an operator is usually missing just before.',
      }),
    },
  },
]

/**
 * L'erreur, expliquée. `null` quand le dictionnaire ne sait pas.
 *
 * Rendre `null` plutôt qu'une phrase vague est délibéré : une explication qui
 * ne dit rien fait perdre plus de temps qu'un message en anglais, parce qu'on
 * la lit en croyant qu'elle va aider. C'est là que le modèle prend le relais.
 */
export function expliquer(message: string, langue: Langue): Explication | null {
  for (const entree of DICTIONNAIRE) {
    const trouve = entree.motif.exec(message)
    if (trouve === null) continue
    // Le premier groupe capturé qui porte quelque chose : c'est le mot que la
    // personne a écrit, et le lui rendre vaut mieux que « une variable ».
    const nom = trouve.slice(1).find((g) => g !== undefined && g !== '') ?? ''
    return entree.dit[langue](nom)
  }
  return null
}
