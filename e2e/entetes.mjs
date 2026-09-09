import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Les en-têtes tels que Cloudflare Pages les servira, lus dans `_headers`.
 *
 * Ils étaient recopiés à la main dans chaque vérification de bout en bout, avec
 * un commentaire renvoyant à `vercel.json`. Deux copies d'une même règle
 * divergent toujours, et celle qui compte est celle du serveur : un `sw.js`
 * mis en cache par erreur ne se voit qu'en production, et fige l'application
 * dans une version qu'on ne peut plus corriger.
 *
 * On lit donc le vrai fichier, dans `dist/`, celui qui part en ligne.
 */

/** Une règle de `_headers` : un motif de chemin et ses en-têtes. */
function analyser(texte) {
  const regles = []
  let courante = null
  for (const brute of texte.split('\n')) {
    const ligne = brute.replace(/\s+$/, '')
    if (ligne === '' || ligne.trimStart().startsWith('#')) continue
    if (!/^\s/.test(ligne)) {
      courante = { motif: ligne.trim(), entetes: {} }
      regles.push(courante)
      continue
    }
    const separateur = ligne.indexOf(':')
    if (separateur === -1 || courante === null) continue
    courante.entetes[ligne.slice(0, separateur).trim()] = ligne.slice(separateur + 1).trim()
  }
  return regles
}

function correspond(motif, chemin) {
  if (!motif.includes('*')) return motif === chemin
  return chemin.startsWith(motif.slice(0, motif.indexOf('*')))
}

/**
 * Les en-têtes d'un chemin, dans l'ordre où Pages les applique : les règles
 * suivantes complètent et remplacent les précédentes.
 */
export function entetesDe(dist, chemin) {
  const regles = analyser(readFileSync(join(dist, '_headers'), 'utf8'))
  const resultat = {}
  for (const regle of regles) {
    if (!correspond(regle.motif, chemin)) continue
    Object.assign(resultat, regle.entetes)
  }
  return resultat
}
