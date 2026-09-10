import type { EnvoiPython, ManifestePython } from '@a237/etabli'
import { lireManifeste } from '@a237/etabli'
import { createStore, get, set } from 'idb-keyval'

/**
 * Descendre Python une fois, et ne plus jamais le redescendre.
 *
 * Cinq mégaoctets sur un forfait compté à l'octet, c'est de l'argent. Les
 * redépenser à chaque « Lancer » serait la seule chose qui disqualifierait
 * complètement Python ici — plus encore que sa lenteur ou son poids.
 *
 * Le cadre isolé ne peut rien garder : son origine est opaque, donc `caches` et
 * `localStorage` y lèvent, et son stockage disparaît avec lui. C'est donc ce
 * module, du côté de l'Établi, qui garde les fichiers et les lui poste.
 */

const MOTEUR = createStore('etabli-python', 'moteur')

/** Où le manifeste est déposé par `scripts/pyodide.mjs`. */
const ADRESSE = 'pyodide/'

/**
 * Le manifeste, ou rien.
 *
 * Rien est un cas normal, pas une panne : les fichiers de Pyodide ne sont pas
 * versionnés, et une installation qui n'a pas lancé `pnpm pyodide` n'en a
 * simplement pas. L'Établi doit alors marcher exactement comme avant, sans
 * proposer Python — plutôt que de proposer un bouton qui échoue.
 */
export async function manifestePython(): Promise<ManifestePython | null> {
  try {
    const reponse = await fetch(`${ADRESSE}manifeste.json`)
    if (!reponse.ok) return null
    return lireManifeste(await reponse.json())
  } catch {
    return null
  }
}

function clef(version: string, nom: string): string {
  return `${version}/${nom}`
}

/** L'empreinte de ce qu'on a reçu, en hexadécimal. */
async function empreinte(octets: ArrayBuffer): Promise<string> {
  const brut = await crypto.subtle.digest('SHA-256', octets)
  return [...new Uint8Array(brut)].map((o) => o.toString(16).padStart(2, '0')).join('')
}

export interface Avancement {
  readonly recus: number
  readonly total: number
}

/**
 * Un fichier, descendu en surveillant l'aiguille.
 *
 * On lit le corps par morceaux au lieu d'attendre le tout : sur une connexion
 * lente, cinq mégaoctets prennent des minutes, et un écran qui ne bouge pas
 * pendant des minutes est un écran qu'on croit bloqué. C'est la différence
 * entre « ça charge » et « c'est cassé ».
 *
 * Le compteur avance en octets décompressés, ceux que le manifeste annonce :
 * le corps arrive décompressé, donc c'est la seule mesure qui tombe juste.
 */
async function descendreUn(
  nom: string,
  dejaRecus: number,
  total: number,
  avance: (a: Avancement) => void,
): Promise<ArrayBuffer> {
  const reponse = await fetch(`${ADRESSE}${nom}`)
  if (!reponse.ok) throw new Error(`${nom} : ${reponse.status}`)
  const corps = reponse.body
  if (corps === null) return await reponse.arrayBuffer()

  const lecteur = corps.getReader()
  const morceaux: Uint8Array[] = []
  let recus = 0
  for (;;) {
    const { done, value } = await lecteur.read()
    if (done === true) break
    if (value !== undefined) {
      morceaux.push(value)
      recus += value.byteLength
      avance({ recus: dejaRecus + recus, total })
    }
  }
  const tout = new Uint8Array(recus)
  let ou = 0
  for (const m of morceaux) { tout.set(m, ou); ou += m.byteLength }
  return tout.buffer
}

const DECODEUR = new TextDecoder()

/**
 * Le moteur, prêt à être posté au cadre.
 *
 * Ce qui est déjà gardé n'est pas redemandé — c'est tout l'objet du module. Ce
 * qui manque est descendu, **vérifié**, puis gardé.
 *
 * La vérification n'est pas de la méfiance envers le serveur : un
 * téléchargement de cinq mégaoctets sur un réseau qui coupe ne rate pas
 * bruyamment, il rend un fichier tronqué. Gardé tel quel, il ferait échouer
 * Python avec une erreur incompréhensible, à chaque lancement, sans que rien
 * ne suggère de recommencer. On préfère redemander.
 */
export async function moteurPython(
  manifeste: ManifestePython,
  avance: (a: Avancement) => void = () => {},
): Promise<EnvoiPython> {
  const textes: Record<string, string> = {}
  const octets: Record<string, ArrayBuffer> = {}

  const total = manifeste.octets
  let acquis = 0

  for (const f of manifeste.fichiers) {
    let brut = await get<ArrayBuffer>(clef(manifeste.version, f.nom), MOTEUR)

    if (brut === undefined || (await empreinte(brut)) !== f.empreinte) {
      brut = await descendreUn(f.nom, acquis, total, avance)
      if ((await empreinte(brut)) !== f.empreinte) {
        throw new Error(`${f.nom} est arrivé incomplet`)
      }
      await set(clef(manifeste.version, f.nom), brut, MOTEUR)
    } else {
      // Déjà là : l'aiguille avance quand même, sinon elle sauterait de 0 à
      // 100 sans qu'on sache si quelque chose se passe.
      avance({ recus: acquis + f.octets, total })
    }
    acquis += f.octets

    if (f.forme === 'texte') textes[f.nom] = DECODEUR.decode(brut)
    else octets[f.nom] = brut
  }

  /*
   * L'adresse est absolue : Pyodide en construit un `URL` sans base, et dans un
   * cadre `srcdoc` une adresse relative y lève « Invalid URL ».
   */
  return { a237: 'python', base: new URL(ADRESSE, location.href).href, textes, octets }
}

/**
 * Python est-il déjà sur ce téléphone ?
 *
 * Sert à choisir ce qu'on affiche : le prix et un bouton, ou rien du tout. On
 * ne vérifie que la présence et la taille, pas les empreintes — recalculer
 * douze mégaoctets de SHA-256 pour décider d'un libellé ferait ramer l'écran
 * à chaque ouverture.
 */
/**
 * Poster le moteur au cadre — **sans transférer les octets**.
 *
 * La première version les transférait, pour éviter de recopier douze
 * mégaoctets. Elle marchait au premier lancement et pas au second : transférer
 * détache les tampons du côté du parent, et « Relancer » échouait sur
 * « ArrayBuffer at index 0 is already detached ». Aucun essai unitaire ne
 * l'aurait vu — il fallait lancer deux fois, dans un vrai navigateur.
 *
 * La recopie coûte un memcpy de douze mégaoctets, face aux deux secondes que
 * met Python à démarrer. L'à-coup que la première version voulait éviter était
 * une supposition ; le second lancement cassé, lui, était mesurable.
 */
export function posterMoteur(fenetre: Window, envoi: EnvoiPython): void {
  fenetre.postMessage(envoi, '*')
}

export async function dejaDescendu(manifeste: ManifestePython): Promise<boolean> {
  try {
    for (const f of manifeste.fichiers) {
      const brut = await get<ArrayBuffer>(clef(manifeste.version, f.nom), MOTEUR)
      if (brut === undefined || brut.byteLength !== f.octets) return false
    }
    return true
  } catch {
    return false
  }
}
