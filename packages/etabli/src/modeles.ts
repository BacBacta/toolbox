import type { Langue } from './expliquer.js'
import type { Fichier } from './projet.js'

/**
 * Par quoi on commence, parce qu'un éditeur vide n'apprend rien à personne.
 *
 * Trois modèles, et pas trente : chacun tient sur un écran, se lit en entier, et
 * fait quelque chose de visible dès qu'on appuie sur « Lancer ». Un modèle qu'on
 * doit faire défiler pour comprendre est un modèle qu'on recopie sans lire.
 *
 * Les exemples parlent d'ici — des francs CFA, des prix de quartier — parce
 * qu'un tutoriel qui convertit des dollars en euros demande à quelqu'un de
 * Douala de faire deux traductions avant d'apprendre quoi que ce soit.
 */

export interface Modele {
  readonly id: string
  readonly nom: string
  /** Ce qu'on apprend en l'ouvrant. Une ligne, affichée sous le nom. */
  readonly dit: string
  readonly fichiers: readonly Fichier[]
}

const MODELES_FR: readonly Modele[] = [
  {
    id: 'vide',
    nom: 'Page vide',
    dit: 'Juste de quoi partir de zéro.',
    fichiers: [
      { nom: 'index.html', contenu: '<h1>Bonjour</h1>\n' },
      { nom: 'style.css', contenu: 'body {\n  font-family: system-ui, sans-serif;\n  padding: 16px;\n}\n' },
      { nom: 'script.js', contenu: '' },
    ],
  },
  {
    id: 'bouton',
    nom: 'Un bouton qui répond',
    dit: 'HTML, CSS et JavaScript qui travaillent ensemble.',
    fichiers: [
      {
        nom: 'index.html',
        contenu: [
          '<h1>Ma page</h1>',
          '<p id="mot">Appuie sur le bouton.</p>',
          '<button id="bouton">Appuie ici</button>',
          '',
        ].join('\n'),
      },
      {
        nom: 'style.css',
        contenu: [
          'body {',
          '  font-family: system-ui, sans-serif;',
          '  padding: 16px;',
          '}',
          'button {',
          '  font-size: 18px;',
          '  padding: 12px 20px;',
          '  border: 0;',
          '  border-radius: 8px;',
          '  background: #14532d;',
          '  color: white;',
          '}',
          '',
        ].join('\n'),
      },
      {
        nom: 'script.js',
        contenu: [
          'const bouton = document.getElementById("bouton")',
          'const mot = document.getElementById("mot")',
          'let fois = 0',
          '',
          'bouton.addEventListener("click", () => {',
          '  fois = fois + 1',
          '  mot.textContent = "Tu as appuyé " + fois + " fois."',
          '  console.log("appui numéro", fois)',
          '})',
          '',
        ].join('\n'),
      },
    ],
  },
  {
    id: 'monnaie',
    nom: 'Rendre la monnaie',
    dit: 'Lire un nombre, calculer, afficher le résultat.',
    fichiers: [
      {
        nom: 'index.html',
        contenu: [
          '<h1>Rendre la monnaie</h1>',
          '<label>Prix à payer',
          '  <input id="prix" type="number" value="1750">',
          '</label>',
          '<label>Le client donne',
          '  <input id="donne" type="number" value="2000">',
          '</label>',
          '<button id="calculer">Calculer</button>',
          '<p id="resultat"></p>',
          '',
        ].join('\n'),
      },
      {
        nom: 'style.css',
        contenu: [
          'body {',
          '  font-family: system-ui, sans-serif;',
          '  padding: 16px;',
          '}',
          'label {',
          '  display: block;',
          '  margin: 12px 0;',
          '}',
          'input {',
          '  display: block;',
          '  font-size: 18px;',
          '  padding: 8px;',
          '  width: 100%;',
          '  box-sizing: border-box;',
          '}',
          '#resultat {',
          '  font-size: 22px;',
          '  font-weight: bold;',
          '}',
          '',
        ].join('\n'),
      },
      {
        nom: 'script.js',
        contenu: [
          'document.getElementById("calculer").addEventListener("click", () => {',
          '  const prix = Number(document.getElementById("prix").value)',
          '  const donne = Number(document.getElementById("donne").value)',
          '  const reste = donne - prix',
          '',
          '  if (reste < 0) {',
          '    document.getElementById("resultat").textContent = "Il manque " + (-reste) + " F"',
          '  } else {',
          '    document.getElementById("resultat").textContent = "Rends " + reste + " F"',
          '  }',
          '})',
          '',
        ].join('\n'),
      },
    ],
  },
]

/*
 * Les mêmes trois modèles, en anglais — code compris.
 *
 * Traduire le nom et la description seulement aurait laissé un anglophone
 * devant `const bouton = document.getElementById("bouton")` et
 * `mot.textContent = "Tu as appuyé…"`. Le tout premier code qu'on lit est
 * celui qui apprend à nommer les choses : le lui donner dans une langue qu'il
 * ne lit pas, c'est lui apprendre à recopier sans comprendre.
 *
 * Les prix restent en francs CFA dans les deux : la monnaie du pays ne change
 * pas avec la langue, et le Nord-Ouest paie en francs comme le reste.
 */
const MODELES_EN: readonly Modele[] = [
  {
    id: 'vide',
    nom: 'Blank page',
    dit: 'Just enough to start from nothing.',
    fichiers: [
      { nom: 'index.html', contenu: '<h1>Hello</h1>\n' },
      { nom: 'style.css', contenu: 'body {\n  font-family: system-ui, sans-serif;\n  padding: 16px;\n}\n' },
      { nom: 'script.js', contenu: '' },
    ],
  },
  {
    id: 'bouton',
    nom: 'A button that answers',
    dit: 'HTML, CSS and JavaScript working together.',
    fichiers: [
      {
        nom: 'index.html',
        contenu: [
          '<h1>My page</h1>',
          '<p id="word">Press the button.</p>',
          '<button id="button">Press here</button>',
          '',
        ].join('\n'),
      },
      {
        nom: 'style.css',
        contenu: [
          'body {',
          '  font-family: system-ui, sans-serif;',
          '  padding: 16px;',
          '}',
          'button {',
          '  font-size: 18px;',
          '  padding: 12px 20px;',
          '  border: 0;',
          '  border-radius: 8px;',
          '  background: #14532d;',
          '  color: white;',
          '}',
          '',
        ].join('\n'),
      },
      {
        nom: 'script.js',
        contenu: [
          'const button = document.getElementById("button")',
          'const word = document.getElementById("word")',
          'let times = 0',
          '',
          'button.addEventListener("click", () => {',
          '  times = times + 1',
          '  word.textContent = "You pressed " + times + " times."',
          '  console.log("press number", times)',
          '})',
          '',
        ].join('\n'),
      },
    ],
  },
  {
    id: 'monnaie',
    nom: 'Giving change',
    dit: 'Read a number, do the maths, show the answer.',
    fichiers: [
      {
        nom: 'index.html',
        contenu: [
          '<h1>Giving change</h1>',
          '<label>Price to pay',
          '  <input id="price" type="number" value="1750">',
          '</label>',
          '<label>Customer gives',
          '  <input id="given" type="number" value="2000">',
          '</label>',
          '<button id="work-it-out">Work it out</button>',
          '<p id="answer"></p>',
          '',
        ].join('\n'),
      },
      {
        nom: 'style.css',
        contenu: [
          'body {',
          '  font-family: system-ui, sans-serif;',
          '  padding: 16px;',
          '}',
          'label {',
          '  display: block;',
          '  margin: 12px 0;',
          '}',
          'input {',
          '  display: block;',
          '  font-size: 18px;',
          '  padding: 8px;',
          '  width: 100%;',
          '  box-sizing: border-box;',
          '}',
          '#answer {',
          '  font-size: 22px;',
          '  font-weight: bold;',
          '}',
          '',
        ].join('\n'),
      },
      {
        nom: 'script.js',
        contenu: [
          'document.getElementById("work-it-out").addEventListener("click", () => {',
          '  const price = Number(document.getElementById("price").value)',
          '  const given = Number(document.getElementById("given").value)',
          '  const change = given - price',
          '',
          '  if (change < 0) {',
          '    document.getElementById("answer").textContent = (-change) + " F short"',
          '  } else {',
          '    document.getElementById("answer").textContent = "Give back " + change + " F"',
          '  }',
          '})',
          '',
        ].join('\n'),
      },
    ],
  },
]

const PAR_LANGUE: Readonly<Record<Langue, readonly Modele[]>> = { fr: MODELES_FR, en: MODELES_EN }

/** Les modèles, dans la langue de la personne. */
export function modeles(langue: Langue): readonly Modele[] {
  return PAR_LANGUE[langue]
}
