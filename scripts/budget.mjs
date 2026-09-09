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
  ['generativelanguage.googleapis.com', 'appel au fournisseur de modèle'],
  ['x-goog-api-key', 'entête d’authentification du modèle'],
  ['A237_CLEF_IA', 'nom de la variable qui porte la clef'],
  ['Tu configures un registre', 'invite envoyée au modèle'],
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
