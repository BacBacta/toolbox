import type { Langue } from './expliquer.js'
import type { Fichier } from './projet.js'

/**
 * Des leçons courtes, corrigées toutes seules.
 *
 * La décision qui fait tout : **la correction appelle ce que la personne a
 * écrit, avec des valeurs qu'elle n'a pas vues**. Une leçon qui vérifierait
 * « la console affiche 17400 » apprendrait à écrire `console.log(17400)` — et
 * quelqu'un qui apprend seul, sans personne pour lui dire que ce n'est pas ça,
 * le ferait de bonne foi et croirait avoir compris.
 *
 * Comparer le code à une solution modèle serait pire encore : ça apprend à
 * recopier, et ça refuse une bonne réponse écrite autrement.
 *
 * Elles sont en JavaScript, pas en Python. Python coûte cinq mégaoctets, et
 * une leçon qu'on ne peut pas commencer sans dépenser son forfait n'est pas une
 * leçon d'entrée. Le JavaScript ne coûte rien et tourne déjà.
 */

/** Un appel, et ce qu'il doit rendre. */
export interface Epreuve {
  readonly appel: string
  readonly attendu: string
}

export interface Lecon {
  readonly id: string
  readonly titre: string
  /** Ce qu'il y a à faire, en deux phrases au plus. */
  readonly enonce: string
  readonly fichiers: readonly Fichier[]
  readonly epreuves: readonly Epreuve[]
  /** Où regarder quand ça ne passe pas. Jamais « c'est faux ». */
  readonly indice: string
}

/**
 * La marque qui sépare la correction de ce que la personne affiche.
 *
 * Elle doit être introuvable par accident dans du code de débutant : des
 * chevrons doubles et un nom qui ne veut rien dire ailleurs. Les lignes qui la
 * portent ne s'affichent pas dans la console — sinon chaque « Lancer »
 * noierait la sortie de la personne sous la nôtre.
 */
export const MARQUE = '«a237»'

/**
 * Le bout de code qui corrige, ajouté après celui de la personne.
 *
 * Chaque appel est enveloppé : une fonction absente, un nom mal orthographié,
 * une erreur dedans — tout cela doit rendre un résultat qu'on peut montrer,
 * pas faire tomber la page en silence.
 */
export function correction(epreuves: readonly Epreuve[]): string {
  const lignes = epreuves.map((e, i) =>
    `try { console.log(${JSON.stringify(`${MARQUE}${i}=`)} + String(${e.appel})) }` +
    ` catch (err) { console.log(${JSON.stringify(`${MARQUE}${i}=!`)} + (err && err.message ? err.message : err)) }`)
  return `\n/* ${MARQUE} */\n${lignes.join('\n')}\n`
}

export interface Resultat {
  readonly rang: number
  readonly obtenu: string
}

/** Une ligne de correction, relue. `null` si ce n'en est pas une. */
export function lireResultat(texte: string): Resultat | null {
  if (!texte.startsWith(MARQUE)) return null
  const egal = texte.indexOf('=')
  if (egal === -1) return null
  const chiffres = texte.slice(MARQUE.length, egal)
  /*
   * Des chiffres, et au moins un.
   *
   * `Number('')` vaut zéro : sans cette vérification, une ligne « ...= » sans
   * rang passait pour la réponse à la première épreuve. Un essai l'a trouvé,
   * pas une relecture.
   */
  if (!/^[0-9]+$/.test(chiffres)) return null
  return { rang: Number(chiffres), obtenu: texte.slice(egal + 1) }
}

export interface Verdict {
  readonly reussi: boolean
  /** Ce qui n'est pas encore passé, pour le montrer sans dire « faux ». */
  readonly manque: readonly { readonly appel: string; readonly attendu: string; readonly obtenu: string }[]
}

/**
 * Le verdict, à partir de ce que la console a rendu.
 *
 * Tant qu'une épreuve n'a rien rendu du tout, on ne dit pas « raté » : le code
 * n'a peut-être pas fini de tourner. On ne conclut qu'une fois toutes les
 * réponses arrivées.
 */
export function juger(epreuves: readonly Epreuve[], resultats: readonly Resultat[]): Verdict | null {
  if (epreuves.length === 0) return null
  const parRang = new Map(resultats.map((r) => [r.rang, r.obtenu]))
  if (epreuves.some((_, i) => !parRang.has(i))) return null

  const manque = epreuves
    .map((e, i) => ({ appel: e.appel, attendu: e.attendu, obtenu: parRang.get(i) ?? '' }))
    .filter((m) => m.obtenu !== m.attendu)
  return { reussi: manque.length === 0, manque }
}

/*
 * Le script d'abord, la page ensuite.
 *
 * L'éditeur ouvre le premier fichier. Mettre `index.html` en tête faisait
 * tomber sur « <h1>Leçon</h1> » quelqu'un venu écrire une fonction : il fallait
 * comprendre qu'il y avait des onglets, et lequel choisir, avant de commencer.
 * Pour une leçon, le premier fichier est celui où se fait le travail.
 */
const DEPART = (commentaire: readonly string[], corps: string): readonly Fichier[] => [
  { nom: 'script.js', contenu: `${commentaire.map((l) => `// ${l}`).join('\n')}\n\n${corps}\n` },
  { nom: 'index.html', contenu: '<h1>Leçon</h1>\n<p>Regarde la console.</p>\n' },
]

const LECONS_FR: readonly Lecon[] = [
  {
    id: 'total',
    titre: 'Le prix de plusieurs sacs',
    enonce: 'Un sac de ciment coûte 5 800 F. Écris « total » : elle rend le prix de plusieurs sacs.',
    fichiers: DEPART(
      ['Elle doit rendre le prix de « nombre » sacs à « prix » francs.',
        'Le mot « return » est ce qui fait sortir la réponse.'],
      'function total(prix, nombre) {\n  \n}',
    ),
    epreuves: [
      { appel: 'total(5800, 3)', attendu: '17400' },
      { appel: 'total(1750, 4)', attendu: '7000' },
      { appel: 'total(500, 0)', attendu: '0' },
    ],
    indice: 'Vérifie que tu écris « return » devant le calcul. Sans lui, la fonction ne rend rien.',
  },
  {
    id: 'reduction',
    titre: 'Le prix après négociation',
    enonce: 'Au marché, on négocie. Écris « reduction » : elle rend le prix une fois la remise faite.',
    fichiers: DEPART(
      ['« pourcent » vaut 10 pour dix pour cent.',
        'Dix pour cent de 2 000, c’est 200 — et le prix devient 1 800.'],
      'function reduction(prix, pourcent) {\n  \n}',
    ),
    epreuves: [
      { appel: 'reduction(2000, 10)', attendu: '1800' },
      { appel: 'reduction(5800, 50)', attendu: '2900' },
      { appel: 'reduction(1200, 0)', attendu: '1200' },
    ],
    indice: 'Pour enlever un pourcentage, calcule d’abord combien il représente : prix × pourcent ÷ 100.',
  },
  {
    id: 'monnaie',
    titre: 'La monnaie à rendre',
    enonce: 'Quelqu’un paie. Écris « monnaie » : elle rend ce qu’il faut lui remettre — et 0 si ce n’est pas assez.',
    fichiers: DEPART(
      ['« donne » est ce qu’on te tend, « prix » ce que ça coûte.',
        'S’il manque de l’argent, rends 0 plutôt qu’un nombre négatif.'],
      'function monnaie(donne, prix) {\n  \n}',
    ),
    epreuves: [
      { appel: 'monnaie(10000, 5800)', attendu: '4200' },
      { appel: 'monnaie(2000, 2000)', attendu: '0' },
      { appel: 'monnaie(1000, 5800)', attendu: '0' },
    ],
    indice: 'Il te faut un « if » : un cas quand il y a assez, un autre quand il n’y en a pas.',
  },
  {
    id: 'pluscher',
    titre: 'Le plus cher des deux',
    enonce: 'Deux vendeurs, deux prix. Écris « plusCher » : elle rend le plus élevé des deux.',
    fichiers: DEPART(
      ['Rends le plus grand des deux nombres.',
        'Quand ils sont égaux, l’un ou l’autre : c’est le même.'],
      'function plusCher(a, b) {\n  \n}',
    ),
    epreuves: [
      { appel: 'plusCher(5800, 6200)', attendu: '6200' },
      { appel: 'plusCher(900, 400)', attendu: '900' },
      { appel: 'plusCher(1500, 1500)', attendu: '1500' },
    ],
    indice: 'Compare avec « > », puis rends celui qui gagne. Un « if » et un « else » suffisent.',
  },
  {
    id: 'panier',
    titre: 'Le total du panier',
    enonce: 'Voici les prix de ce que tu as acheté. Écris « totalDuPanier » : elle en fait la somme.',
    fichiers: DEPART(
      ['« prix » est une liste, comme [500, 1200, 800].',
        'Parcours-la et additionne. Une liste vide fait 0.'],
      'function totalDuPanier(prix) {\n  \n}',
    ),
    epreuves: [
      { appel: 'totalDuPanier([500, 1200, 800])', attendu: '2500' },
      { appel: 'totalDuPanier([5800])', attendu: '5800' },
      { appel: 'totalDuPanier([])', attendu: '0' },
    ],
    indice: 'Pars d’un total à 0, puis ajoute chaque prix avec une boucle « for ».',
  },
]

const LECONS_EN: readonly Lecon[] = [
  {
    id: 'total',
    titre: 'The price of several bags',
    enonce: 'A bag of cement costs 5,800 F. Write "total": it gives the price of several bags.',
    fichiers: DEPART(
      ['It must give the price of "nombre" bags at "prix" francs each.',
        'The word "return" is what sends the answer back out.'],
      'function total(prix, nombre) {\n  \n}',
    ),
    epreuves: [
      { appel: 'total(5800, 3)', attendu: '17400' },
      { appel: 'total(1750, 4)', attendu: '7000' },
      { appel: 'total(500, 0)', attendu: '0' },
    ],
    indice: 'Check that you wrote "return" before the calculation. Without it the function gives nothing back.',
  },
  {
    id: 'reduction',
    titre: 'The price after haggling',
    enonce: 'At the market you haggle. Write "reduction": it gives the price once the discount is taken off.',
    fichiers: DEPART(
      ['"pourcent" is 10 for ten per cent.',
        'Ten per cent of 2,000 is 200 — so the price becomes 1,800.'],
      'function reduction(prix, pourcent) {\n  \n}',
    ),
    epreuves: [
      { appel: 'reduction(2000, 10)', attendu: '1800' },
      { appel: 'reduction(5800, 50)', attendu: '2900' },
      { appel: 'reduction(1200, 0)', attendu: '1200' },
    ],
    indice: 'To take off a percentage, first work out how much it is: prix × pourcent ÷ 100.',
  },
  {
    id: 'monnaie',
    titre: 'The change to hand back',
    enonce: 'Someone pays. Write "monnaie": it gives the change to hand back — and 0 if it is not enough.',
    fichiers: DEPART(
      ['"donne" is what you are handed, "prix" is what it costs.',
        'If there is not enough, give 0 rather than a negative number.'],
      'function monnaie(donne, prix) {\n  \n}',
    ),
    epreuves: [
      { appel: 'monnaie(10000, 5800)', attendu: '4200' },
      { appel: 'monnaie(2000, 2000)', attendu: '0' },
      { appel: 'monnaie(1000, 5800)', attendu: '0' },
    ],
    indice: 'You need an "if": one case when there is enough, another when there is not.',
  },
  {
    id: 'pluscher',
    titre: 'The dearer of the two',
    enonce: 'Two sellers, two prices. Write "plusCher": it gives the higher of the two.',
    fichiers: DEPART(
      ['Give back the larger of the two numbers.',
        'When they are equal, either one — it is the same.'],
      'function plusCher(a, b) {\n  \n}',
    ),
    epreuves: [
      { appel: 'plusCher(5800, 6200)', attendu: '6200' },
      { appel: 'plusCher(900, 400)', attendu: '900' },
      { appel: 'plusCher(1500, 1500)', attendu: '1500' },
    ],
    indice: 'Compare with ">", then give back the winner. An "if" and an "else" are enough.',
  },
  {
    id: 'panier',
    titre: 'The basket total',
    enonce: 'Here are the prices of what you bought. Write "totalDuPanier": it adds them up.',
    fichiers: DEPART(
      ['"prix" is a list, like [500, 1200, 800].',
        'Go through it and add. An empty list makes 0.'],
      'function totalDuPanier(prix) {\n  \n}',
    ),
    epreuves: [
      { appel: 'totalDuPanier([500, 1200, 800])', attendu: '2500' },
      { appel: 'totalDuPanier([5800])', attendu: '5800' },
      { appel: 'totalDuPanier([])', attendu: '0' },
    ],
    indice: 'Start with a total of 0, then add each price with a "for" loop.',
  },
]

/**
 * Les leçons, dans la langue de la personne.
 *
 * Les identifiants et les épreuves sont les mêmes des deux côtés : ce qui
 * change est ce qu'on lit, jamais ce qui est demandé. Sinon une leçon réussie
 * en français redeviendrait à faire en anglais.
 */
export function lecons(langue: Langue): readonly Lecon[] {
  return langue === 'en' ? LECONS_EN : LECONS_FR
}
