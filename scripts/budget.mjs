#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Les budgets de la section 8 du brief, mesurés et bloquants.
 *
 * « À faire échouer en CI, pas à surveiller à l'œil. » Le poids est une
 * fonctionnalité : sur un forfait data compté à l'octet, chaque kilo-octet est
 * payé par quelqu'un.
 *
 * La coquille, c'est ce que le navigateur télécharge avant d'afficher quoi que
 * ce soit : l'index, le fragment d'entrée et la feuille de style qu'il
 * référence. Les outils sont des fragments chargés à la demande et mis en cache
 * par le service worker ; ils ont leur propre plafond.
 */

const DIST = 'apps/web/dist'

const PLAFONDS = {
  coquille: 120 * 1024,
  fragmentOutil: 25 * 1024,
}

function poidsGzip(chemin) {
  return gzipSync(readFileSync(chemin), { level: 9 }).length
}

function ko(octets) {
  return `${(octets / 1024).toFixed(1)} Ko`
}

function fichiers(dossier) {
  return readdirSync(dossier).flatMap((entree) => {
    const chemin = join(dossier, entree)
    return statSync(chemin).isDirectory() ? fichiers(chemin) : [chemin]
  })
}

const index = join(DIST, 'index.html')
const html = readFileSync(index, 'utf8')

// Ce que l'index fait télécharger tout de suite : script d'entrée, feuilles de
// style, et les modules préchargés.
const references = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1])
const cheminsCoquille = [index, ...references.map((r) => join(DIST, r))]

const poidsCoquille = cheminsCoquille.reduce((a, c) => a + poidsGzip(c), 0)

const tous = fichiers(join(DIST, 'assets'))
const fragments = tous.filter((c) => !cheminsCoquille.includes(c))

const echecs = []

console.log('Coquille initiale (ce qui part avant le premier affichage)')
for (const c of cheminsCoquille) {
  console.log(`  ${c.replace(`${DIST}/`, '')} — ${ko(poidsGzip(c))}`)
}
console.log(`  total : ${ko(poidsCoquille)} / ${ko(PLAFONDS.coquille)}`)
if (poidsCoquille > PLAFONDS.coquille) {
  echecs.push(`coquille : ${ko(poidsCoquille)} au-delà de ${ko(PLAFONDS.coquille)}`)
}

console.log('\nFragments chargés à la demande')
for (const c of fragments) {
  const poids = poidsGzip(c)
  console.log(`  ${c.replace(`${DIST}/`, '')} — ${ko(poids)}`)
  if (poids > PLAFONDS.fragmentOutil) {
    echecs.push(`${c} : ${ko(poids)} au-delà de ${ko(PLAFONDS.fragmentOutil)}`)
  }
}

/**
 * Aucun outil ne doit se retrouver dans la coquille.
 *
 * Ces marqueurs sont des chaînes qui n'existent que dans un squelette ou un
 * moteur de rendu précis. Les voir dans le fragment de départ signifie que
 * l'arbre secoue mal, et que la coquille paie pour des outils que personne n'a
 * ouverts. C'est arrivé : sans `"sideEffects": false` dans les paquets de
 * l'espace de travail, Rollup ne pouvait pas prouver que construire un
 * squelette au chargement était sans conséquence, et gardait tout — sept
 * kilo-octets pour rien.
 */
const MARQUEURS_OUTILS = [
  ['CARNET DE NJANGI', 'squelette njangi'],
  ['LIVRE DE CAISSE', 'squelette caisse'],
  ['RESTE À PAYER', 'squelette scolarité'],
  ['Sous-total HT', 'rendu des documents A4'],
  ['quatre-vingt', 'montant en toutes lettres'],
  ['Bon pour accord', 'rendu du devis'],
]

/**
 * Rien du proxy IA ne doit atteindre le navigateur.
 *
 * C'est l'invariant § 2.8 rendu structurel : **aucune clef d'API dans le
 * client, jamais**. `@a237/ia` vit côté serveur, appelle le fournisseur et lit
 * la clef dans son environnement ; un import égaré depuis `apps/web` tirerait
 * cette mécanique dans le paquet que tout le monde télécharge — et le jour où
 * quelqu'un y ajouterait une valeur de repli, la clef partirait avec.
 *
 * On ne cherche pas la clef, qui n'est nulle part dans le code : on cherche
 * ce qui n'a de sens que côté serveur. Ces marqueurs-là sont introuvables
 * ailleurs.
 */
const MARQUEURS_SERVEUR = [
  ['generativelanguage.googleapis.com', 'appel direct à Gemini'],
  ['openrouter.ai/api', 'appel au routeur de modèles'],
  ['x-goog-api-key', 'entête d’authentification du modèle'],
  ['A237_CLEF_IA', 'nom de la variable qui porte la clef'],
  ['Tu configures un registre', 'invite envoyée au modèle'],
  /*
   * Et rien de la base des comptes non plus.
   *
   * `apps/web` importe `@a237/comptes` pour une seule fonction — tirer le jeton
   * de l'appareil. Le même paquet porte les requêtes D1, la vérification de
   * signature des rappels et le calcul des abonnements. L'arbre les secoue
   * aujourd'hui ; le jour où un import mal placé les retient, le client
   * embarquerait la règle économique entière, et qui l'embarque peut la lire.
   */
  ['INSERT OR IGNORE INTO comptes', 'requête d’ouverture de compte'],
  ['appels_ia', 'table du journal des coûts'],
  ['A237_PAIEMENT_SECRET', 'nom du secret qui signe les rappels'],
]

/*
 * Toute l'application, pas seulement la coquille : un fragment chargé à la
 * demande est téléchargé par le navigateur comme le reste.
 */
const codeClient = readdirSync(join(DIST, 'assets'))
  .filter((f) => f.endsWith('.js'))
  .map((f) => readFileSync(join(DIST, 'assets', f), 'utf8'))
  .join('')

for (const [marqueur, quoi] of MARQUEURS_SERVEUR) {
  if (codeClient.includes(marqueur)) {
    echecs.push(
      `« ${marqueur} » (${quoi}) est dans le paquet client : le proxy IA doit ` +
        'rester côté serveur (invariant § 2.8, aucune clef d’API dans le client)',
    )
  }
}

const codeCoquille = cheminsCoquille
  .filter((c) => c.endsWith('.js'))
  .map((c) => readFileSync(c, 'utf8'))
  .join('')

for (const [marqueur, quoi] of MARQUEURS_OUTILS) {
  if (codeCoquille.includes(marqueur)) {
    echecs.push(
      `« ${marqueur} » (${quoi}) est dans la coquille : le fragment de départ ` +
        'embarque un outil qu’on n’a pas encore ouvert',
    )
  }
}

// Le mode avion dépend de ces deux fichiers : sans eux, rien n'est mis en cache.
for (const requis of ['precache.json', 'sw.js']) {
  try {
    statSync(join(DIST, requis))
  } catch {
    echecs.push(`${requis} manquant : l'application ne fonctionnerait pas hors ligne`)
  }
}

/*
 * La fonction serveur doit être assemblée, complète, et savoir lire sa clef.
 *
 * Elle s'est déjà déployée vide : Rollup avait élagué son export, et Vite, en
 * mode navigateur, avait remplacé `process.env` par un objet vide. Quarante
 * octets sont partis en production sans qu'aucune construction n'échoue — et
 * la fonction aurait répondu « pas encore ouvert » pour toujours, ce qui
 * ressemble à un choix plutôt qu'à une panne.
 *
 * Chez Cloudflare le piège change de forme et non de nature : un Worker n'a
 * pas de `process`. Une fonction qui lirait `process.env` se déploierait sans
 * broncher et ne verrait jamais sa clef. On exige donc l'inverse — la lecture
 * passe par l'objet `env` reçu à chaque requête, et `process.env` ne doit pas
 * y figurer du tout.
 */
const FONCTION = 'functions/api/chat.js'
try {
  const fonction = readFileSync(FONCTION, 'utf8')
  const exigences = [
    ['export { onRequest }', 'l’export nommé, sans quoi Pages ne voit aucune fonction'],
    ['env.A237_CLEF_IA', 'la lecture de la clef dans l’environnement du Worker'],
    ['generativelanguage.googleapis.com', 'l’appel au fournisseur, preuve que tout est inclus'],
    ['text/event-stream', 'le flux, sans quoi l’agent n’écrit plus sous les yeux'],
  ]
  for (const [marqueur, quoi] of exigences) {
    if (!fonction.includes(marqueur)) {
      echecs.push(`${FONCTION} n'a pas ${quoi}`)
    }
  }
  if (/process\.env\.[A-Z]/.test(fonction)) {
    echecs.push(`${FONCTION} lit process.env : un Worker n'a pas de process, la clef serait invisible`)
  }
} catch {
  echecs.push(`${FONCTION} manquant : le proxy IA ne serait pas déployé`)
}

/*
 * Les deux fonctions de publication, et surtout **leur nom**.
 *
 * Pages tire ses routes du nom des fichiers : `d/[lien].js` répond à
 * `/d/n'importe quoi`. Rollup assainit les crochets d'un nom de sortie, et le
 * fichier sortait `_lien_.js` — qui ne répond qu'à `/d/_lien_`. Toutes les
 * pages de lecture auraient rendu 404, et la construction aurait réussi.
 */
// `onRequest` peut voisiner avec ce que les tests importent : on cherche le nom
// dans la liste d'exports, pas une liste d'exports précise.
const EXPORTE_ONREQUEST = /export \{[^}]*\bonRequest\b[^}]*\}/
for (const [chemin, marqueur, quoi] of [
  ['functions/api/publier.js', EXPORTE_ONREQUEST, 'l’export nommé que Pages appelle'],
  ['functions/d/[lien].js', EXPORTE_ONREQUEST, 'l’export nommé que Pages appelle'],
  ['functions/d/[lien].js', '<!doctype html>', 'la page de lecture, preuve que le rendu est inclus'],
  ['functions/c/[lien].js', EXPORTE_ONREQUEST, 'l’export nommé que Pages appelle'],
  ['functions/c/[lien].js', 'image/png', 'le service des cartes'],
  ['functions/api/compte/[[chemin]].js', EXPORTE_ONREQUEST, 'l’export nommé que Pages appelle'],
  ['functions/api/pay/[[chemin]].js', EXPORTE_ONREQUEST, 'l’export nommé que Pages appelle'],
  // Sans la vérification de signature, n'importe qui s'offre un abonnement
  // avec `curl` : c'est la seule ligne de ce fichier qui protège de l'argent.
  ['functions/api/pay/[[chemin]].js', 'memeSignature', 'la vérification de signature du rappel'],
  ['functions/p/[lien].js', EXPORTE_ONREQUEST, 'l’export nommé que Pages appelle'],
  ['functions/p/[lien].js', 'application/pdf', 'le service des PDF'],
]) {
  try {
    const source = readFileSync(chemin, 'utf8')
    const present = marqueur instanceof RegExp ? marqueur.test(source) : source.includes(marqueur)
    if (!present) echecs.push(`${chemin} n'a pas ${quoi}`)
  } catch {
    echecs.push(`${chemin} manquant : la publication ne serait pas déployée`)
  }
}

/*
 * Rien d'autre que des routes dans `functions/`.
 *
 * Un fragment partagé déposé par Rollup dans `functions/assets/` devient une
 * route `/assets/…` servie par Pages, qui masquerait les vrais fichiers de
 * l'application. Chaque fonction porte donc tout ce dont elle a besoin.
 */
{
  const attendus = new Set([
    'functions/api/chat.js', 'functions/api/publier.js',
    'functions/api/compte/[[chemin]].js', 'functions/api/pay/[[chemin]].js',
    'functions/api/reponses/[lien].js',
    'functions/d/[lien].js', 'functions/c/[lien].js', 'functions/p/[lien].js',
  ])
  const vus = []
  const parcourir = (dossier) => {
    for (const e of readdirSync(dossier, { withFileTypes: true })) {
      const chemin = `${dossier}/${e.name}`
      if (e.isDirectory()) parcourir(chemin)
      else vus.push(chemin)
    }
  }
  try {
    parcourir('functions')
    for (const f of vus) {
      if (!attendus.has(f)) echecs.push(`${f} n'est pas une route attendue de functions/`)
    }
  } catch {
    echecs.push('functions/ manquant : aucune fonction ne serait déployée')
  }
}

/*
 * Le service worker doit porter l'empreinte de la construction.
 *
 * Le navigateur ne le réinstalle que si son fichier a changé d'un octet. Avec
 * une version écrite en dur, `sw.js` était identique d'une construction à
 * l'autre : aucune réinstallation, aucune purge du cache, et la coquille
 * d'une version précédente servie indéfiniment — donc une application qui ne
 * pouvait plus jamais se mettre à jour chez quelqu'un qui l'avait ouverte une
 * fois. Ça n'a été vu qu'en production, par un utilisateur.
 *
 * Ce contrôle refait le calcul du côté de la construction et exige de le
 * retrouver dans le fichier livré.
 */
try {
  const liste = readFileSync(join(DIST, 'precache.json'), 'utf8')
  const empreinte = createHash('sha256').update(liste).digest('hex').slice(0, 12)
  const sw = readFileSync(join(DIST, 'sw.js'), 'utf8')
  if (!sw.includes(empreinte)) {
    echecs.push(
      `sw.js ne porte pas l'empreinte de la construction (${empreinte}) : ` +
        'le navigateur ne le réinstallerait pas, et les mises à jour ne ' +
        'parviendraient jamais à ceux qui ont déjà ouvert l’application',
    )
  }
} catch {
  echecs.push('impossible de vérifier l’empreinte du service worker')
}

if (echecs.length > 0) {
  console.error(`\n✗ Budget dépassé :\n  ${echecs.join('\n  ')}`)
  process.exit(1)
}
console.log('\n✓ Budgets tenus.')
