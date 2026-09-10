import { describe, expect, it } from 'vitest'
import {
  enMegaoctets, estProjetPython, fichierPrincipalPython, lireManifeste,
} from '../src/python.js'

/**
 * Python, et le prix qu'on annonce avant de le télécharger.
 *
 * Tout ce fichier tourne autour d'une seule idée : personne ne doit dépenser
 * cinq mégaoctets de forfait sans l'avoir su et voulu. Le reste — quel fichier
 * on lance, comment on lit le manifeste — est au service de ça.
 */

const projet = (noms: readonly string[]) => ({
  id: 'p1',
  nom: 'essai',
  maj: 0,
  fichiers: noms.map((nom) => ({ nom, contenu: '' })),
})

describe('le fichier qu’on lance', () => {
  it('« main.py » d’abord, parce que c’est la convention partout ailleurs', () => {
    expect(fichierPrincipalPython(projet(['calcul.py', 'main.py']))?.nom).toBe('main.py')
  })

  it('mais le premier .py suffit quand il n’y a pas de main.py', () => {
    expect(fichierPrincipalPython(projet(['calcul.py', 'outils.py']))?.nom).toBe('calcul.py')
  })

  it('rien à lancer quand il n’y a pas de Python', () => {
    expect(fichierPrincipalPython(projet(['index.html', 'style.css']))).toBe(null)
    expect(estProjetPython(projet(['index.html']))).toBe(false)
    expect(estProjetPython(projet(['index.html', 'a.py']))).toBe(true)
  })
})

const FICHIER = {
  nom: 'pyodide.asm.wasm',
  octets: 8_645_967,
  surLeFil: 2_667_808,
  empreinte: 'a'.repeat(64),
  forme: 'octets',
}
const MANIFESTE = { version: '0.28.3', fichiers: [FICHIER], surLeFil: 2_667_808, octets: 8_645_967 }

describe('le manifeste, qui vient du réseau', () => {
  it('se lit quand il tient debout', () => {
    const m = lireManifeste(MANIFESTE)
    expect(m?.version).toBe('0.28.3')
    expect(m?.fichiers).toHaveLength(1)
  })

  /*
   * Les totaux se recalculent, ils ne se recopient pas.
   *
   * Un manifeste qui annonce moins que la somme de ses fichiers ferait
   * afficher un prix trop bas — et c'est précisément le sens dans lequel une
   * erreur arrange celui qui la commet. On ne lui laisse pas le choix.
   */
  it('recalcule les totaux au lieu de croire ceux qu’on lui donne', () => {
    const menteur = { ...MANIFESTE, surLeFil: 1, octets: 1 }
    expect(lireManifeste(menteur)?.surLeFil).toBe(2_667_808)
    expect(lireManifeste(menteur)?.octets).toBe(8_645_967)
  })

  /*
   * Le manifeste s'est enrichi en route — « notreBrotli » pour l'estimation de
   * construction, « mesureSur » pour dire quelle origine a été mesurée. Un
   * lecteur qui refuserait ce qu'il ne connaît pas ferait disparaître Python le
   * jour où le script gagne un champ, sans que rien ne dise pourquoi.
   */
  it('accepte les champs qu’il ne connaît pas', () => {
    const enrichi = {
      ...MANIFESTE,
      mesureSur: 'https://etabli237.pages.dev/',
      fichiers: [{ ...FICHIER, notreBrotli: 2_600_000, inconnu: 'plus tard' }],
    }
    expect(lireManifeste(enrichi)?.surLeFil).toBe(2_667_808)
  })

  it('refuse tout ce qui ne tient pas debout, plutôt que d’annoncer un prix faux', () => {
    expect(lireManifeste(null)).toBe(null)
    expect(lireManifeste('0.28.3')).toBe(null)
    expect(lireManifeste({ ...MANIFESTE, version: '' })).toBe(null)
    expect(lireManifeste({ ...MANIFESTE, fichiers: [] })).toBe(null)
    expect(lireManifeste({ ...MANIFESTE, fichiers: 'trois' })).toBe(null)
  })

  it('et refuse le manifeste entier dès qu’un seul fichier est douteux', () => {
    const avec = (mauvais: unknown) => lireManifeste({ ...MANIFESTE, fichiers: [FICHIER, mauvais] })
    expect(avec({ ...FICHIER, empreinte: 'trop court' })).toBe(null)
    expect(avec({ ...FICHIER, empreinte: 'A'.repeat(64) })).toBe(null)
    expect(avec({ ...FICHIER, forme: 'image' })).toBe(null)
    expect(avec({ ...FICHIER, octets: 0 })).toBe(null)
    expect(avec({ ...FICHIER, surLeFil: -1 })).toBe(null)
    expect(avec({ ...FICHIER, octets: Number.NaN })).toBe(null)
    expect(avec({ ...FICHIER, nom: '' })).toBe(null)
    expect(avec(null)).toBe(null)
  })
})

describe('le prix, écrit dans la langue de la personne', () => {
  /*
   * La virgule décimale n'est pas un détail de style. « 5.3 » se lit « cinq
   * mille trois cents » pour qui compte en français : un facteur mille sur un
   * prix, dans un outil dont tout l'argument est de dire le prix.
   */
  it('virgule en français, point en anglais', () => {
    expect(enMegaoctets(5_304_678, 'fr')).toBe('5,1 Mo')
    expect(enMegaoctets(5_304_678, 'en')).toBe('5.1 MB')
  })

  it('arrondit à l’entier au-delà de dix mégaoctets : la décimale n’apprend plus rien', () => {
    expect(enMegaoctets(12_262_929, 'fr')).toBe('12 Mo')
    expect(enMegaoctets(12_262_929, 'en')).toBe('12 MB')
  })
})
