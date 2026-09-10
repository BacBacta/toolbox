import type { Langue } from './expliquer.js'
import type { Projet } from './projet.js'
import { sorteDuFichier } from './assembler.js'
import { fichierPrincipalPython } from './python.js'

/**
 * Python dans le cadre isolé, sans que le cadre ne touche au réseau.
 *
 * Le cadre est dans une origine opaque — c'est le prix de l'isolement, et c'est
 * ce qui rend acceptable d'ouvrir le projet de quelqu'un d'autre. Mais une
 * origine opaque n'a **pas de stockage** : `caches` et `localStorage` y lèvent
 * une exception (ils ne valent pas `undefined`, ce qui piège toute détection
 * écrite en `typeof`), et ce qu'IndexedDB y garde disparaît avec le cadre.
 *
 * Le cadre ne peut donc rien retenir d'un lancement à l'autre. Sans rien faire,
 * chaque « Lancer » redescendrait cinq mégaoctets. C'est le parent qui garde
 * les fichiers, et qui les lui poste.
 *
 * Reste à ce que Pyodide accepte de ne pas aller les chercher lui-même. Deux
 * accroches, trouvées en lisant sa source puis vérifiées en comptant les
 * requêtes reçues par un serveur :
 *
 * - il ne télécharge `pyodide.asm.js` que `if (typeof _createPyodideModule !=
 *   "function")`. On l'injecte en balise, il ne demande rien ;
 * - `lockFileContents` lui évite d'aller chercher le verrou ;
 * - le reste passe par `fetch`, qu'on détourne pour ces fichiers-là seulement.
 *
 * Mesuré : **zéro requête** au second lancement. Python est alors réellement
 * hors ligne, ce qui est la seule condition sous laquelle il a sa place ici.
 */

/**
 * Ce que le parent doit poster au cadre pour qu'il démarre.
 *
 * Les octets voyagent en transférables : ils changent de propriétaire au lieu
 * d'être recopiés. Douze mégaoctets recopiés feraient un à-coup visible sur un
 * téléphone d'entrée de gamme.
 */
export interface EnvoiPython {
  readonly a237: 'python'
  /*
   * L'adresse du dossier, absolue, et elle doit l'être.
   *
   * Pyodide construit un `new URL(indexURL)` sans base. Dans un cadre `srcdoc`
   * il n'y a pas de base à donner : une adresse relative y lève « Invalid URL »
   * et rien ne démarre. Le banc d'essai ne l'avait pas vu parce qu'il donnait
   * une adresse absolue sans y penser — c'est le document réel qui l'a dit.
   *
   * Le cadre n'ira rien chercher à cette adresse : tout est intercepté. Elle
   * doit seulement être constructible.
   */
  readonly base: string
  readonly textes: Readonly<Record<string, string>>
  readonly octets: Readonly<Record<string, ArrayBuffer>>
}

export function lireEnvoiPython(donnees: unknown): EnvoiPython | null {
  if (typeof donnees !== 'object' || donnees === null) return null
  const e = donnees as { a237?: unknown; base?: unknown; textes?: unknown; octets?: unknown }
  if (e.a237 !== 'python') return null
  if (typeof e.base !== 'string' || e.base === '') return null
  if (typeof e.textes !== 'object' || e.textes === null) return null
  if (typeof e.octets !== 'object' || e.octets === null) return null
  return e as unknown as EnvoiPython
}

/**
 * Le code de la personne voyage en JSON, pas interpolé dans du JavaScript.
 *
 * Interpoler du texte dans du code, c'est recréer la faille d'injection à
 * chaque guillemet. Ici les fichiers sont un objet JSON dans une balise que
 * personne n'exécute, et le programme le lit avec `JSON.parse`.
 *
 * Le seul échappement nécessaire est `</`, qui fermerait la balise avant sa
 * fin. `\/` est un échappement JSON valide qui se relit exactement `/` : le
 * texte revient au caractère près, ce qu'un essai vérifie.
 */
function enJson(valeur: unknown): string {
  return JSON.stringify(valeur).replace(/<\//g, '<\\/')
}

const MOTS: Readonly<Record<Langue, Readonly<Record<string, string>>>> = {
  fr: {
    demarrage: 'Python démarre…',
    pret: 'Python est prêt.',
    sansFichier: 'Ce projet n’a pas de fichier Python à lancer.',
  },
  en: {
    demarrage: 'Python is starting…',
    pret: 'Python is ready.',
    sansFichier: 'This project has no Python file to run.',
  },
}

/**
 * Le document Python, prêt à recevoir le moteur.
 *
 * Il ne fait rien tant que le parent ne lui a pas posté les fichiers : c'est
 * volontaire. Un cadre qui démarrerait tout seul irait les chercher sur le
 * réseau, et le réseau est précisément ce qu'on cherche à ne pas dépenser.
 */
export function pourApercuPython(projet: Projet, langue: Langue = 'fr'): string {
  const principal = fichierPrincipalPython(projet)
  const fichiers = projet.fichiers
    .filter((f) => sorteDuFichier(f.nom) === 'py')
    .map((f) => ({ nom: f.nom, contenu: f.contenu }))
  const mots = MOTS[langue]

  return `<!doctype html>
<html lang="${langue}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Python</title>
</head>
<body>
<script type="application/json" id="a237-py">${enJson({
    fichiers,
    entree: principal?.nom ?? null,
    mots,
  })}</script>
<script>
(function () {
  var envoyer = function (sorte, texte) {
    try {
      parent.postMessage({ a237: 'etabli', sorte: sorte, texte: String(texte) }, '*')
    } catch (e) { /* la fenêtre parente est partie : on se tait */ }
  }
  var plan = JSON.parse(document.getElementById('a237-py').textContent)

  if (plan.entree === null) { envoyer('erreur', plan.mots.sansFichier); return }

  window.onerror = function (m) { envoyer('erreur', m); return false }
  window.addEventListener('unhandledrejection', function (e) {
    envoyer('erreur', e.reason && e.reason.message ? e.reason.message : e.reason)
  })

  var demarre = false
  window.addEventListener('message', function (e) {
    // Le parent, et personne d'autre. Une extension ou une autre page peut
    // poster ici ; sans cette vérification son contenu passerait pour le moteur.
    if (e.source !== parent || demarre) return
    var envoi = e.data
    if (!envoi || envoi.a237 !== 'python') return
    demarre = true
    lancer(envoi)
  })

  function poser(texte) {
    var b = document.createElement('script')
    b.textContent = texte
    document.head.appendChild(b)
  }

  function lancer(envoi) {
    envoyer('journal', plan.mots.demarrage)
    var vrai = window.fetch
    /*
     * Les gros fichiers viennent de la mémoire, le reste du réseau.
     *
     * On compare sur la fin de l'adresse et non sur son égalité : Pyodide
     * fabrique ses URL à partir de indexURL, et une barre oblique de plus ou
     * de moins ferait repartir huit mégaoctets sur le réseau sans rien dire.
     */
    window.fetch = function (r, o) {
      var url = String(r && r.url ? r.url : r)
      for (var nom in envoi.octets) {
        if (url.slice(-nom.length) === nom) {
          var type = nom.slice(-5) === '.wasm' ? 'application/wasm' : 'application/zip'
          return Promise.resolve(new Response(envoi.octets[nom], {
            status: 200, headers: { 'content-type': type },
          }))
        }
      }
      return vrai(r, o)
    }

    // Le moteur d'abord : tant que _createPyodideModule n'existe pas, la
    // façade va le chercher sur le réseau.
    poser(envoi.textes['pyodide.asm.js'])
    poser(envoi.textes['pyodide.js'])

    loadPyodide({
      indexURL: envoi.base,
      lockFileContents: envoi.textes['pyodide-lock.json'],
      stdout: function (t) { envoyer('journal', t) },
      stderr: function (t) { envoyer('erreur', t) },
    }).then(function (py) {
      envoyer('journal', plan.mots.pret)
      /*
       * Tous les fichiers, pas seulement celui qu'on lance : « import outils »
       * doit trouver « outils.py ». Sans ça, séparer son code en deux fichiers
       * — la première chose qu'on apprend après la centième ligne — ne
       * marcherait pas.
       */
      for (var i = 0; i < plan.fichiers.length; i += 1) {
        py.FS.writeFile(plan.fichiers[i].nom, plan.fichiers[i].contenu)
      }
      try {
        py.runPython(py.FS.readFile(plan.entree, { encoding: 'utf8' }))
      } catch (err) {
        // La trace Python dit la ligne et la raison ; c'est plus utile que
        // n'importe quoi qu'on pourrait écrire à la place.
        envoyer('erreur', err && err.message ? err.message : err)
      }
    }).catch(function (err) {
      envoyer('erreur', err && err.message ? err.message : err)
    })
  }
})()
</script>
</body>
</html>`
}
