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
 * Sauf que le serveur qui nous donne les fichiers n'est pas celui qui les
 * servira. Mesuré après la mise en ligne : Cloudflare envoie 5 401 584 octets
 * là où jsDelivr en annonçait 5 304 678 — quatre-vingt-seize mille de plus,
 * surtout parce qu'il ne comprime pas le `.zip` du tout. On annonçait un
 * dixième de mégaoctet de moins que le prix payé.
 *
 * D'où deux règles. À la construction, `surLeFilPrudent` ne prend jamais le
 * chiffre le plus bas — c'est une estimation, et elle penche du bon côté.
 * Après la mise en ligne, `--mesurer <origine>` remplace l'estimation par la
 * mesure réelle sur le serveur qui sert vraiment les fichiers.
 *
 * La mesure passe par `curl` et non par `fetch` : Cloudflare répond en
 * morceaux, donc sans `content-length`, et `fetch` décompresse sans jamais dire
 * combien d'octets sont passés. Un premier essai a cru mesurer et rendait les
 * tailles décompressées — onze mégaoctets et demi au lieu de cinq — parce que
 * le repli s'était déclenché sans le dire.
 *
 * Les fichiers ne sont pas versionnés : douze mégaoctets rendraient le dépôt
 * pénible à cloner pour quelque chose qu'un `curl` retrouve à l'identique.
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { brotliCompress, constants } from 'node:zlib'
import { promisify } from 'node:util'
import { execFile as execFileBrut } from 'node:child_process'

const comprimer = promisify(brotliCompress)
const execFile = promisify(execFileBrut)

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

/*
 * Les formats déjà compressés, qu'aucun serveur sensé ne recomprime.
 *
 * Cloudflare sert le `.zip` tel quel — le comprimer coûterait du calcul pour
 * gagner un pour cent. Lui appliquer brotli en estimation faisait annoncer
 * trente-sept mille octets de moins que ce qui passe vraiment.
 */
const DEJA_COMPRIME = new Set(['.zip', '.png', '.jpg', '.woff2'])

/**
 * Ce qu'on annonce : jamais le chiffre le plus bas.
 *
 * Trois mesures existent pour un même fichier — ce que la source a envoyé, ce
 * que notre brotli obtient, et sa taille brute — et elles diffèrent d'un
 * serveur à l'autre. Prendre la plus basse revient à promettre un prix qu'on ne
 * tiendra pas. On prend donc la plus haute des estimations plausibles, en
 * sachant qu'une annonce un peu trop grosse déçoit dans le bon sens.
 */
function surLeFilPrudent(nom, brut, sourceDitAvoirEnvoye, notreBrotli) {
  const point = nom.lastIndexOf('.')
  const extension = point === -1 ? '' : nom.slice(point)
  if (DEJA_COMPRIME.has(extension)) return brut.length
  return Math.max(sourceDitAvoirEnvoye ?? 0, notreBrotli, 0)
}

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

    /*
     * Notre propre brotli, au réglage 5 : l'ordre de grandeur d'un serveur qui
     * comprime à la volée. Le réglage 11 rendrait un chiffre que personne ne
     * verra jamais, et toujours dans le sens qui arrange.
     */
    const notre = connu?.notreBrotli ?? (await comprimer(corps, {
      params: { [constants.BROTLI_PARAM_QUALITY]: 5 },
    })).length

    fichiers.push({
      nom,
      forme,
      octets: corps.length,
      notreBrotli: notre,
      surLeFil: surLeFilPrudent(nom, corps, surLeFil, notre),
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

/**
 * Remesurer sur l'origine qui sert vraiment les fichiers.
 *
 * On vérifie l'empreinte avant d'inscrire une taille : sans ça, on écrirait le
 * poids d'un fichier qui n'est pas le nôtre — une version en avance, une page
 * d'erreur — et l'annonce redeviendrait fausse sans prévenir.
 */
export async function mesurerSur(origine, { dossier = DOSSIER, dire = console.log } = {}) {
  const manifeste = JSON.parse(await readFile(join(dossier, 'manifeste.json'), 'utf8'))
  const base = origine.endsWith('/') ? origine : `${origine}/`

  const fichiers = []
  for (const f of manifeste.fichiers) {
    const url = `${base}pyodide/${f.nom}`
    /*
     * `curl` et pas `fetch`. Ce qu'on veut est le nombre d'octets réellement
     * passés sur le fil, et `fetch` décompresse sans jamais le dire — il n'y a
     * pas de `content-length` quand le serveur répond en morceaux.
     */
    const { stdout } = await execFile('curl', [
      '-s', '--compressed-no-vary', '-H', 'Accept-Encoding: br, gzip',
      '-o', '/dev/null', '-w', '%{size_download}', url,
    ]).catch(async () => await execFile('curl', [
      '-s', '-H', 'Accept-Encoding: br, gzip', '-o', '/dev/null', '-w', '%{size_download}', url,
    ]))
    const surLeFil = Number(stdout.trim())
    if (!Number.isFinite(surLeFil) || surLeFil <= 0) throw new Error(`${f.nom} : rien mesuré`)

    // Le même fichier, et pas un autre.
    const reponse = await fetch(url)
    if (!reponse.ok) throw new Error(`${f.nom} : ${reponse.status} sur ${base}`)
    const corps = Buffer.from(await reponse.arrayBuffer())
    const vu = createHash('sha256').update(corps).digest('hex')
    if (vu !== f.empreinte) throw new Error(`${f.nom} : ce n'est pas le même fichier sur ${base}`)

    if (surLeFil !== f.surLeFil) dire(`  ± ${f.nom} : ${f.surLeFil} → ${surLeFil}`)
    fichiers.push({ ...f, surLeFil })
  }

  const remesure = {
    ...manifeste,
    mesureSur: base,
    fichiers,
    surLeFil: fichiers.reduce((t, f) => t + f.surLeFil, 0),
  }
  await writeFile(join(dossier, 'manifeste.json'), `${JSON.stringify(remesure, null, 2)}\n`)
  return remesure
}

const lanceDirectement = process.argv[1]?.endsWith('pyodide.mjs') === true
if (lanceDirectement) {
  const mo = (o) => `${(o / 1_048_576).toFixed(1)} Mo`
  const ou = process.argv.indexOf('--mesurer')
  const m = ou === -1
    ? await descendrePyodide()
    : await mesurerSur(process.argv[ou + 1] ?? '')
  const d = m.mesureSur === undefined ? 'estimé' : `mesuré sur ${m.mesureSur}`
  console.log(`\nPyodide ${m.version} : ${mo(m.surLeFil)} sur le fil (${d}), ${mo(m.octets)} sur le téléphone`)
}
