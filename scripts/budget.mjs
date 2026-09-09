#!/usr/bin/env node
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

// Le mode avion dépend de ces deux fichiers : sans eux, rien n'est mis en cache.
for (const requis of ['precache.json', 'sw.js']) {
  try {
    statSync(join(DIST, requis))
  } catch {
    echecs.push(`${requis} manquant : l'application ne fonctionnerait pas hors ligne`)
  }
}

if (echecs.length > 0) {
  console.error(`\n✗ Budget dépassé :\n  ${echecs.join('\n  ')}`)
  process.exit(1)
}
console.log('\n✓ Budgets tenus.')
