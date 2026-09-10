import type { Langue } from './expliquer.js'
import type { Fichier, Projet } from './projet.js'

/**
 * Trois fichiers séparés, un seul document exécutable.
 *
 * Cette fonction sert deux fois, et c'est voulu : elle fabrique l'aperçu qu'on
 * regarde dans le cadre isolé, **et** le fichier qu'on exporte pour l'envoyer.
 * Deux chemins auraient fini par diverger, et on découvrirait la différence
 * chez quelqu'un d'autre, sur son téléphone, sans pouvoir la reproduire.
 *
 * Le résultat est un document complet et autonome : ouvert seul, sans réseau et
 * sans l'Établi, il fait exactement ce qu'il faisait dans l'aperçu.
 */

export type SorteFichier = 'html' | 'css' | 'js' | 'py' | 'inconnu'

const EXTENSIONS: Readonly<Record<string, SorteFichier>> = {
  html: 'html',
  htm: 'html',
  css: 'css',
  js: 'js',
  py: 'py',
}

export function sorteDuFichier(nom: string): SorteFichier {
  const point = nom.lastIndexOf('.')
  if (point === -1) return 'inconnu'
  return EXTENSIONS[nom.slice(point + 1).toLowerCase()] ?? 'inconnu'
}

const REPROCHES: Readonly<Record<Langue, Readonly<Record<string, (nom: string) => string>>>> = {
  fr: {
    vide: () => 'Donne-lui un nom.',
    espace: () => 'Un nom ne commence ni ne finit par une espace.',
    dossier: () => 'Pas de dossiers ici : un nom simple, comme « page.html ».',
    sansNom: () => 'Il manque le nom devant le point, comme « page.html ».',
    caracteres: () => 'Lettres, chiffres, points, tirets et soulignés seulement.',
    extension: () => 'Termine par .html, .css, .js ou .py — ce sont les quatre que je sais exécuter.',
    pris: (nom) => `« ${nom} » existe déjà dans ce projet.`,
  },
  en: {
    vide: () => 'Give it a name.',
    espace: () => 'A name cannot start or end with a space.',
    dossier: () => 'No folders here: a plain name, like "page.html".',
    sansNom: () => 'The name before the dot is missing, as in "page.html".',
    caracteres: () => 'Letters, digits, dots, dashes and underscores only.',
    extension: () => 'End it with .html, .css, .js or .py — those are the four I can run.',
    pris: (nom) => `"${nom}" already exists in this project.`,
  },
}

/**
 * Le nom d'un fichier, vérifié. `null` quand il va.
 *
 * Il sert de clef dans le projet et de libellé sur un onglet. Une barre oblique
 * laisserait croire à des dossiers qui n'existent pas ; un doublon rendrait
 * l'un des deux fichiers inatteignable — celui qu'on vient d'écrire, parce que
 * la recherche s'arrête au premier.
 *
 * Le reproche est dit dans la langue de la personne. C'est le seul moment où
 * l'éditeur refuse quelque chose ; le dire dans une langue qu'elle ne lit pas
 * en ferait un refus sans raison.
 */
export function verifierNomDeFichier(
  nom: string,
  pris: readonly string[],
  langue: Langue = 'fr',
): string | null {
  const dit = REPROCHES[langue]
  if (nom.trim() === '') return dit['vide']!(nom)
  if (nom !== nom.trim()) return dit['espace']!(nom)
  if (/[/\\]/.test(nom)) return dit['dossier']!(nom)
  if (!/^[A-Za-z0-9._-]+$/.test(nom)) return dit['caracteres']!(nom)
  /*
   * Un nom devant le point.
   *
   * « .js » passait toutes les autres règles : ce n'est pas dangereux — il
   * s'exécute dans le même bac à sable que le reste — mais l'onglet paraît
   * vide, et personne n'a voulu créer un fichier sans nom. Trouvé en donnant
   * au modèle le droit d'écrire : il a exactement les mêmes noms permis que la
   * personne, donc ce qui passait ici passait aussi pour lui.
   */
  if (nom.startsWith('.') || nom.slice(0, nom.lastIndexOf('.')) === '') return dit['sansNom']!(nom)
  if (sorteDuFichier(nom) === 'inconnu') return dit['extension']!(nom)
  if (pris.includes(nom)) return dit['pris']!(nom)
  return null
}

/**
 * Neutralise ce qui fermerait la balise qui contient le texte.
 *
 * Quelqu'un qui apprend écrira `document.write("</script>")` dans la semaine, et
 * recopié tel quel ce texte **ferme le script** : la moitié du code devient du
 * texte affiché, et la page casse sans dire pourquoi. Sur un téléphone, sans
 * console de développement, c'est une soirée perdue à chercher une faute qu'on
 * n'a pas commise.
 *
 * On casse la séquence plutôt que le sens : `<\/script>` est, pour le moteur
 * JavaScript, exactement la même chaîne — l'échappement d'une barre oblique n'a
 * pas d'effet — alors que l'analyseur HTML n'y voit plus une balise fermante.
 * Pour le CSS et le HTML, il n'y a pas d'échappement équivalent : on remplace le
 * chevron par son entité, qui s'affiche pareil.
 */
function sansFermeture(texte: string, balise: 'script' | 'style'): string {
  const fermante = new RegExp(`</(?=${balise}\\b)`, 'gi')
  return balise === 'script'
    ? texte.replace(fermante, '<\\/')
    : texte.replace(fermante, '&lt;/')
}

const DOCTYPE = '<!doctype html>'

/*
 * Le viewport n'est pas de la décoration.
 *
 * Sans lui, un téléphone rend la page en largeur de bureau puis la réduit :
 * quelqu'un qui apprend voit son propre travail illisible et croit s'être
 * trompé. La page qu'on lui rend s'ouvre comme il l'attend.
 */
const ENTETE =
  '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">'

function contenuDe(fichiers: readonly Fichier[], nom: string): string {
  return fichiers.find((f) => f.nom.toLowerCase() === nom)?.contenu ?? ''
}

function tousDeSorte(fichiers: readonly Fichier[], sorte: 'css' | 'js'): string {
  return fichiers
    .filter((f) => sorteDuFichier(f.nom) === sorte)
    .map((f) => f.contenu)
    .join('\n')
}

/**
 * Le document, prêt à s'exécuter.
 *
 * L'ordre n'est pas indifférent : le style avant le corps, sinon la page
 * s'affiche nue pendant un instant puis saute ; le script après le corps, sinon
 * il cherche des éléments qui n'existent pas encore. C'est la première chose
 * qu'on apprendrait en se cognant dessus, et personne n'a besoin de se cogner
 * dessus pour afficher un titre.
 */
export function assembler(projet: Projet): string {
  const html = contenuDe(projet.fichiers, 'index.html') || contenuDe(projet.fichiers, 'index.htm')
  const css = tousDeSorte(projet.fichiers, 'css')
  const js = tousDeSorte(projet.fichiers, 'js')

  /*
   * Le corps ne passe pas par `sansFermeture`, et c'est délibéré.
   *
   * Ce qu'on échappe, c'est du *texte* posé dans une balise — une feuille, un
   * script — où une balise fermante couperait son contenant. Le corps de la
   * page est fait de balises : l'échapper casserait un `<script>` écrit à la
   * main dans `index.html`, qui est la première chose qu'on apprend à faire.
   */
  const corps = html
  const style = css === '' ? '' : `<style>\n${sansFermeture(css, 'style')}\n</style>`
  const script = js === '' ? '' : `<script>\n${sansFermeture(js, 'script')}\n</script>`

  return [
    DOCTYPE,
    '<html lang="fr">',
    '<head>',
    ENTETE,
    style,
    '</head>',
    '<body>',
    corps,
    script,
    '</body>',
    '</html>',
  ]
    .filter((ligne) => ligne !== '')
    .join('\n')
}

export interface FichierExporte {
  readonly nom: string
  readonly contenu: string
}

/**
 * Le projet en un seul fichier, prêt à partir sur WhatsApp.
 *
 * C'est le partage qui marche ici, aujourd'hui : pas de compte, pas de lien à
 * héberger, pas de réseau au moment d'exporter. Le fichier s'ouvre seul dans
 * n'importe quel navigateur et fait exactement ce qu'il faisait dans l'aperçu,
 * parce que c'est `assembler` des deux côtés.
 *
 * Le nom demande plus de soin qu'il n'y paraît. Il vient de celui du projet,
 * que la personne a écrit en français : « Ma première page » porte une espace
 * et un accent, et selon le téléphone qui le reçoit ça donne un fichier
 * qu'on ne peut pas ouvrir, ou un nom illisible. On le ramène donc à ce que
 * tous les systèmes acceptent, sans le rendre méconnaissable.
 */
export function fichierAExporter(projet: { nom: string } & Projet): FichierExporte {
  const base = projet.nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 40)
  return { nom: `${base === '' ? 'projet' : base}.html`, contenu: assembler(projet) }
}
