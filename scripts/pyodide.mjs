/*
 * Descendre Python, et mesurer ce qu'il coûte.
 *
 * Pyodide pèse douze mégaoctets sur le disque et cinq sur le fil. Ces
 * chiffres-là, l'Établi les affiche à quelqu'un **avant** de dépenser son
 * forfait — donc ils ne peuvent pas être une constante tapée à la main. Une
 * constante ment dès la montée de version suivante, et elle ment toujours dans
 * le sens qui arrange celui qui l'a écrite.
 *
 * Ce script les mesure sur les fichiers réellement déposés, et écrit un
 * manifeste que l'application lit.
 *
 * « surLeFil » est mesuré sur ce qu'un vrai serveur a réellement envoyé : le
 * « content-length » de la réponse compressée, pendant que Node décompresse le
 * corps. Comprimer nous-mêmes donnait un chiffre plus flatteur — quatre
 * mégaoctets et demi contre cinq — parce qu'on peut choisir le réglage le plus
 * lent. Annoncer moins que le vrai prix est exactement l'erreur qu'on cherche à
 * ne pas commettre.
 *
 * Les fichiers ne sont pas versionnés : douze mégaoctets rendraient le dépôt
 * pénible à cloner pour quelque chose qu'un `curl` retrouve à l'identique.
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { brotliCompress, constants } from 'node:zlib'
import { promisify } from 'node:util'

const comprimer = promisify(brotliCompress)

export const VERSION = '0.28.3'
const SOURCE = `https://cdn.jsdelivr.net/pyodide/v${VERSION}/full`
const DOSSIER = 'apps/etabli/public/pyodide'

/*
 * Cinq fichiers, et pas un de plus.
 *
 * `pyodide.js` et `pyodide.asm.js` sont du texte : ils s'injectent en balise
 * dans le cadre isolé, et c'est ce qui évite au cadre de les redemander au
 * réseau. Les deux autres voyagent en octets. Le verrou décrit les paquets
 * qu'on ne télécharge pas — sans lui, Pyodide irait le chercher tout seul.
 */
const FICHIERS = [
  { nom: 'pyodide.js', forme: 'texte' },
  { nom: 'pyodide.asm.js', forme: 'texte' },
  { nom: 'pyodide-lock.json', forme: 'texte' },
  { nom: 'pyodide.asm.wasm', forme: 'octets' },
  { nom: 'python_stdlib.zip', forme: 'octets' },
]

async function dejaLa(chemin, attendu) {
  try {
    const corps = await readFile(chemin)
    return createHash('sha256').update(corps).digest('hex') === attendu ? corps : null
  } catch {
    return null
  }
}

export async function descendrePyodide({ dossier = DOSSIER, dire = console.log } = {}) {
  await mkdir(dossier, { recursive: true })

  // Un manifeste déjà écrit permet de reconstruire sans réseau — et une
  // construction qui exige le réseau échoue le jour où il n'y en a pas.
  let ancien = null
  try {
    ancien = JSON.parse(await readFile(join(dossier, 'manifeste.json'), 'utf8'))
  } catch { /* premier passage */ }

  const fichiers = []
  for (const { nom, forme } of FICHIERS) {
    const chemin = join(dossier, nom)
    const connu = ancien?.version === VERSION
      ? ancien.fichiers?.find((f) => f.nom === nom)
      : undefined
    let corps = connu === undefined ? null : await dejaLa(chemin, connu.empreinte)
    // Ce qu'un vrai serveur a envoyé pour ce fichier-là. Repris tel quel quand
    // on reconstruit sans le retélécharger : c'est la même mesure.
    let surLeFil = corps === null ? null : (connu?.surLeFil ?? null)

    if (corps === null) {
      dire(`  ↓ ${nom}`)
      const reponse = await fetch(`${SOURCE}/${nom}`, { headers: { 'accept-encoding': 'br, gzip' } })
      if (!reponse.ok) throw new Error(`${nom} : ${reponse.status} ${reponse.statusText}`)
      const annonce = Number(reponse.headers.get('content-length'))
      const encode = reponse.headers.get('content-encoding') !== null
      corps = Buffer.from(await reponse.arrayBuffer())
      await writeFile(chemin, corps)
      surLeFil = encode && Number.isFinite(annonce) && annonce > 0 ? annonce : null
    }

    if (surLeFil === null) {
      /*
       * Le serveur n'a pas comprimé, ou n'a rien annoncé. On comprime nous-
       * mêmes, mais au réglage 5 : c'est l'ordre de grandeur d'un serveur qui
       * comprime à la volée. Le réglage 11 rendrait un chiffre que personne ne
       * verra jamais.
       */
      const comprime = await comprimer(corps, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } })
      surLeFil = comprime.length
      dire(`  ~ ${nom} : taille estimée, le serveur n'a rien annoncé`)
    }

    fichiers.push({
      nom,
      forme,
      octets: corps.length,
      surLeFil,
      empreinte: createHash('sha256').update(corps).digest('hex'),
    })
  }

  const manifeste = {
    version: VERSION,
    fichiers,
    octets: fichiers.reduce((t, f) => t + f.octets, 0),
    surLeFil: fichiers.reduce((t, f) => t + f.surLeFil, 0),
  }
  await writeFile(join(dossier, 'manifeste.json'), `${JSON.stringify(manifeste, null, 2)}\n`)
  return manifeste
}

const lanceDirectement = process.argv[1]?.endsWith('pyodide.mjs') === true
if (lanceDirectement) {
  const m = await descendrePyodide()
  const mo = (o) => `${(o / 1_048_576).toFixed(1)} Mo`
  console.log(`\nPyodide ${m.version} : ${mo(m.surLeFil)} sur le fil, ${mo(m.octets)} sur le téléphone`)
}
