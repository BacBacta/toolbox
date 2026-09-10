import { describe, expect, it } from 'vitest'
import { assembler, fichierAExporter, sorteDuFichier, verifierNomDeFichier } from '../src/assembler.js'
import type { Projet } from '../src/projet.js'

/**
 * L'assemblage : trois fichiers séparés, un seul document exécutable.
 *
 * C'est la pièce qui sert deux fois — l'aperçu dans le cadre isolé, et le
 * fichier qu'on exporte pour l'envoyer sur WhatsApp. Une seule fonction, donc
 * un seul endroit où se tromper, et un seul endroit à éprouver.
 */

const PROJET: Projet = {
  id: 'p1',
  nom: 'Ma page',
  maj: 0,
  fichiers: [
    { nom: 'index.html', contenu: '<h1>Bonjour Douala</h1>' },
    { nom: 'style.css', contenu: 'h1 { color: green }' },
    { nom: 'script.js', contenu: 'console.log("salut")' },
  ],
}

describe('un projet assemblé', () => {
  it('porte le corps, le style et le script', () => {
    const doc = assembler(PROJET)
    expect(doc).toContain('<h1>Bonjour Douala</h1>')
    expect(doc).toContain('h1 { color: green }')
    expect(doc).toContain('console.log("salut")')
  })

  it('est un document complet, pas un fragment', () => {
    const doc = assembler(PROJET)
    expect(doc.startsWith('<!doctype html>')).toBe(true)
    expect(doc).toContain('<meta charset="utf-8">')
    // Sans lui, la page s'affiche en taille bureau sur un téléphone, et il faut
    // pincer pour lire son propre travail.
    expect(doc).toContain('name="viewport"')
  })

  it('met le style avant le corps, et le script après', () => {
    const doc = assembler(PROJET)
    expect(doc.indexOf('h1 { color: green }')).toBeLessThan(doc.indexOf('<h1>Bonjour'))
    expect(doc.indexOf('<h1>Bonjour')).toBeLessThan(doc.indexOf('console.log("salut")'))
  })
})

/**
 * Le piège classique, et il n'est pas théorique.
 *
 * Quelqu'un qui apprend écrira `document.write("</script>")` dans la semaine.
 * Recopié tel quel entre deux balises, ce texte **ferme le script** : le reste
 * du code devient du texte affiché, et la page casse sans dire pourquoi. Sur un
 * téléphone, sans console de développement, c'est une soirée perdue.
 *
 * Le même piège existe pour `</style>` dans une feuille, et pour `<!--` qui
 * ouvre un commentaire que rien ne referme.
 */
describe('du code qui contient des balises fermantes', () => {
  const avec = (fichier: { nom: string; contenu: string }): string =>
    assembler({ ...PROJET, fichiers: [{ nom: 'index.html', contenu: '<p>x</p>' }, fichier] })

  it('un script qui écrit « </script> » ne se coupe pas lui-même', () => {
    const doc = avec({ nom: 'script.js', contenu: 'document.write("</script>")' })
    // La séquence littérale n'apparaît nulle part : elle est échappée.
    expect(doc).not.toContain('document.write("</script>")')
    expect(doc).toContain('<\\/script>')
  })

  it('une feuille qui contient « </style> » non plus', () => {
    const doc = avec({ nom: 'style.css', contenu: 'p::after { content: "</style>" }' })
    expect(doc).not.toContain('content: "</style>"')
  })

  it('et il ne reste qu’un seul script et une seule feuille dans le document', () => {
    const doc = avec({ nom: 'script.js', contenu: '"</script><script>alert(1)</script>"' })
    expect(doc).not.toContain('alert(1)</script>')
  })
})

describe('un projet incomplet s’assemble quand même', () => {
  it('sans feuille ni script : la page seule', () => {
    const doc = assembler({ ...PROJET, fichiers: [{ nom: 'index.html', contenu: '<p>seul</p>' }] })
    expect(doc).toContain('<p>seul</p>')
  })

  it('sans page : le style et le script ont quand même un corps où s’appliquer', () => {
    const doc = assembler({ ...PROJET, fichiers: [{ nom: 'script.js', contenu: 'let a = 1' }] })
    expect(doc).toContain('<body')
    expect(doc).toContain('let a = 1')
  })

  it('vide : un document qui s’ouvre, plutôt qu’une page blanche inexplicable', () => {
    const doc = assembler({ ...PROJET, fichiers: [] })
    expect(doc.startsWith('<!doctype html>')).toBe(true)
  })
})

describe('la sorte d’un fichier se lit sur son extension', () => {
  it.each([
    ['index.html', 'html'],
    ['page.HTM', 'html'],
    ['style.css', 'css'],
    ['script.js', 'js'],
    ['notes.txt', 'inconnu'],
    ['sansextension', 'inconnu'],
  ])('%s → %s', (nom, attendu) => {
    expect(sorteDuFichier(nom)).toBe(attendu)
  })
})

/**
 * Le nom d'un fichier n'est pas du texte libre.
 *
 * Il sert de clef dans le projet et s'affiche dans un onglet. Une barre oblique
 * laisserait croire à des dossiers qui n'existent pas, et deux fichiers du même
 * nom rendraient l'un des deux inaccessible — celui qu'on vient d'écrire.
 */
describe('le nom d’un fichier', () => {
  it('accepte ce qui ressemble à un fichier', () => {
    for (const nom of ['index.html', 'style.css', 'mon-script.js', 'page_2.html']) {
      expect(verifierNomDeFichier(nom, []), nom).toBe(null)
    }
  })

  it('refuse ce qui n’en est pas un, et dit pourquoi', () => {
    for (const nom of ['', '   ', 'dossier/page.html', '../secret.js', 'page.html ']) {
      expect(verifierNomDeFichier(nom, []), nom).not.toBe(null)
    }
  })

  it('refuse un nom déjà pris : le second cacherait le premier', () => {
    expect(verifierNomDeFichier('index.html', ['index.html'])).toMatch(/existe/)
  })

  it('refuse une extension qu’on ne sait pas exécuter, plutôt que de faire semblant', () => {
    expect(verifierNomDeFichier('notes.txt', [])).toMatch(/html|css|js|py/i)
    expect(verifierNomDeFichier('image.png', [])).toMatch(/html|css|js|py/i)
  })

  // Python est arrivé : ce nom-là était refusé, il ne l'est plus.
  it('accepte le Python', () => {
    expect(verifierNomDeFichier('script.py', [])).toBe(null)
    expect(sorteDuFichier('script.py')).toBe('py')
  })
})

/**
 * Le corps de `index.html` est du HTML, et on n'y touche pas.
 *
 * On échappe ce qui est du *texte* posé dans une balise — une feuille de style,
 * un script — parce que là, une balise fermante coupe son contenant. Le corps
 * de la page, lui, est fait de balises : les échapper casserait un `<script>`
 * écrit à la main dans la page, qui est la première chose qu'on apprend à
 * faire. Cette distinction a failli m'échapper, et seul un sabotage l'a
 * montrée — l'échappement était là, et rien ne le réclamait.
 */
describe('un script écrit directement dans la page', () => {
  it('reste exécutable : c’est du HTML, pas du texte', () => {
    const doc = assembler({
      ...PROJET,
      fichiers: [{ nom: 'index.html', contenu: '<h1>Hé</h1>\n<script>console.log(1)</script>' }],
    })
    expect(doc).toContain('<script>console.log(1)</script>')
    expect(doc).not.toContain('<\\/script>')
  })

  it('et une balise fermante dans le corps ne devient pas du texte affiché', () => {
    const doc = assembler({
      ...PROJET,
      fichiers: [{ nom: 'index.html', contenu: '<p>a</p>' }],
    })
    expect(doc).toContain('<p>a</p>')
  })
})

/**
 * Le fichier qu'on envoie : c'est tout le partage de l'Établi.
 *
 * Pas de compte, pas de lien à héberger, pas de réseau. Le nom vient de celui
 * du projet, que la personne a écrit en français — avec des espaces et des
 * accents — et il doit rester ouvrable sur le téléphone de celui qui le reçoit.
 */
describe('exporter un projet', () => {
  it('rend un document autonome, le même que l’aperçu', () => {
    const { contenu } = fichierAExporter(PROJET)
    expect(contenu).toBe(assembler(PROJET))
    expect(contenu).toContain('<h1>Bonjour Douala</h1>')
  })

  it.each([
    ['Ma page', 'ma-page.html'],
    ['Ma première page', 'ma-premiere-page.html'],
    ['Rendre la monnaie !', 'rendre-la-monnaie.html'],
    ['  ', 'projet.html'],
    ['../../etc/passwd', 'etc-passwd.html'],
    ['日本語', 'projet.html'],
  ])('« %s » devient %s', (nom, attendu) => {
    expect(fichierAExporter({ ...PROJET, nom }).nom).toBe(attendu)
  })

  it('et un nom très long ne devient pas un fichier qu’on ne peut pas ranger', () => {
    const { nom } = fichierAExporter({ ...PROJET, nom: 'a'.repeat(300) })
    expect(nom.length).toBeLessThan(50)
    expect(nom.endsWith('.html')).toBe(true)
  })
})
