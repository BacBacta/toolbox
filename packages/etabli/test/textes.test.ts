import { describe, expect, it } from 'vitest'
import { LANGUES } from '../src/expliquer.js'
import { textes } from '../src/textes.js'

/**
 * Une interface à moitié traduite est pire qu'une interface qui ne l'est pas :
 * on croit que le reste va suivre, et on cherche le bouton anglais qui
 * n'existera jamais.
 *
 * Tout vit donc dans un seul fichier, et cet essai vérifie qu'aucune phrase
 * n'existe dans une langue et pas dans l'autre. C'est la seule garde qui tienne
 * quand quelqu'un ajoutera un écran dans six mois.
 */
describe('les deux langues disent la même chose', () => {
  it('exactement les mêmes clefs, dans les deux', () => {
    const [a, b] = LANGUES.map((l) => Object.keys(textes(l)).sort())
    expect(a).toEqual(b)
  })

  it('et rien de vide nulle part', () => {
    for (const langue of LANGUES) {
      for (const [clef, valeur] of Object.entries(textes(langue))) {
        const rendu = typeof valeur === 'function' ? valeur(2) : valeur
        expect(String(rendu).trim(), `${langue}.${clef}`).not.toBe('')
      }
    }
  })

  /*
   * Une phrase identique dans les deux langues est presque toujours une
   * traduction oubliée. Les exceptions sont réelles — « Console » se dit
   * pareil — et se nomment ici pour qu'on les voie.
   */
  it('et rien qui soit resté en français dans la version anglaise', () => {
    const memes = ['console', 'nomDeFichier']
    for (const [clef, valeur] of Object.entries(textes('fr'))) {
      if (memes.includes(clef) || typeof valeur === 'function') continue
      expect(valeur, clef).not.toBe((textes('en') as unknown as Record<string, unknown>)[clef])
    }
  })

  it('le pluriel se fait dans chaque langue, pas une fois pour les deux', () => {
    expect(textes('fr').fichiers(1)).toBe('1 fichier')
    expect(textes('fr').fichiers(3)).toBe('3 fichiers')
    expect(textes('en').fichiers(1)).toBe('1 file')
    expect(textes('en').fichiers(3)).toBe('3 files')
  })

  /*
   * Le bouton porte le nom de **l'autre** langue : c'est ce vers quoi il mène.
   * « Langue / Language » demanderait de lire les deux pour comprendre.
   */
  it('le bouton de langue nomme celle vers laquelle il mène', () => {
    expect(textes('fr').langue).toBe('English')
    expect(textes('en').langue).toBe('Français')
  })
})
