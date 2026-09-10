import { describe, expect, it } from 'vitest'
import {
  ALPHABET_LIEN, LONGUEUR_CLEF, LONGUEUR_LIEN, MAX_OCTETS_DEPOT,
  clefValide, lienValide, lireDepot, nouvelleClef, nouveauLien, pourLeDepot,
} from '../src/depot.js'
import type { Projet } from '../src/projet.js'

/**
 * Le dépôt : ce qui sauve un projet du téléphone perdu, et ce qui le partage.
 *
 * C'est le même travail, et c'était le premier écart bloquant avec Replit : les
 * projets ne vivaient que dans l'IndexedDB de l'appareil. Téléphone volé, vendu,
 * ou « effacer les données du site » — trois mois de travail disparaissaient
 * sans avertissement, et personne ne le découvrait avant que ce soit arrivé.
 *
 * Pas de compte pour autant : un lien qu'on garde, une clef qui autorise à
 * réécrire. Créer un compte avant d'avoir écrit trois lignes est exactement la
 * marche que cet outil existe pour retirer.
 */

const PROJET: Projet = {
  id: 'p1', nom: 'Ma page', maj: 1_700_000_000_000,
  fichiers: [
    { nom: 'index.html', contenu: '<h1>Bonjour</h1>' },
    { nom: 'script.js', contenu: 'console.log(1)' },
  ],
}

describe('le lien qu’on garde', () => {
  it('se dit au téléphone : ni I, ni 1, ni O, ni 0', () => {
    for (const confusable of ['I', '1', 'O', '0', 'U']) {
      expect(ALPHABET_LIEN, confusable).not.toContain(confusable)
    }
  })

  it('se tire au hasard, et deux tirages ne se ressemblent pas', () => {
    const tires = new Set(Array.from({ length: 200 }, () => nouveauLien()))
    expect(tires.size).toBe(200)
    for (const l of tires) expect(lienValide(l), l).toBe(true)
  })

  it('a la longueur annoncée', () => {
    expect(nouveauLien()).toHaveLength(LONGUEUR_LIEN)
  })

  it('refuse ce qui n’en est pas un', () => {
    for (const faux of ['', 'court', 'a'.repeat(LONGUEUR_LIEN), '../../etc', `${'A'.repeat(LONGUEUR_LIEN)}X`]) {
      expect(lienValide(faux), JSON.stringify(faux)).toBe(false)
    }
  })
})

/**
 * La clef, elle, ne se dit pas : elle autorise à réécrire.
 *
 * Le lien se partage — c'est son but. Si le partager donnait le droit de
 * modifier, le premier destinataire pourrait effacer le travail de celui qui
 * le lui a envoyé. Deux choses distinctes, donc, et une seule des deux voyage.
 */
describe('la clef qui autorise à réécrire', () => {
  it('est plus longue que le lien : elle ne se devine pas', () => {
    expect(LONGUEUR_CLEF).toBeGreaterThan(LONGUEUR_LIEN * 2)
    expect(nouvelleClef()).toHaveLength(LONGUEUR_CLEF)
  })

  it('se tire au hasard', () => {
    expect(new Set(Array.from({ length: 200 }, () => nouvelleClef())).size).toBe(200)
  })

  it('se vérifie, et refuse ce qui n’en est pas une', () => {
    expect(clefValide(nouvelleClef())).toBe(true)
    for (const fausse of ['', 'x', 'G'.repeat(LONGUEUR_CLEF)]) {
      expect(clefValide(fausse), JSON.stringify(fausse)).toBe(false)
    }
  })
})

describe('ce qui part sur le réseau', () => {
  it('porte le nom et les fichiers, et rien de l’appareil', () => {
    const depot = pourLeDepot(PROJET)
    expect(depot.nom).toBe('Ma page')
    expect(depot.fichiers).toEqual(PROJET.fichiers)
    // L'identifiant local et la date de modification ne regardent que le
    // téléphone : les envoyer ne servirait qu'à en dire plus qu'il ne faut.
    expect(depot).not.toHaveProperty('id')
    expect(depot).not.toHaveProperty('maj')
  })

  it('et se relit tel quel', () => {
    const lu = lireDepot(pourLeDepot(PROJET))
    expect(lu).not.toBe(null)
    expect(lu?.nom).toBe('Ma page')
    expect(lu?.fichiers[0]?.contenu).toBe('<h1>Bonjour</h1>')
  })
})

/**
 * Ce qui revient du serveur a pu être écrit par n'importe qui.
 *
 * Un dépôt est public en lecture : celui qui a le lien l'ouvre. Ce qu'on en
 * relit ne devient un projet qu'après vérification — sinon un dépôt trafiqué
 * ferait tomber l'éditeur de celui qui ouvre le lien reçu sur WhatsApp.
 */
describe('un dépôt qui revient du serveur', () => {
  it('se refuse quand il n’a pas la forme attendue', () => {
    for (const faux of [
      null, 'texte', 42, {},
      { nom: 'x' },
      { nom: 42, fichiers: [] },
      { nom: 'x', fichiers: 'deux' },
      { nom: 'x', fichiers: [{ nom: 'a.js' }] },
      { nom: 'x', fichiers: [{ nom: 42, contenu: 'x' }] },
    ]) {
      expect(lireDepot(faux), JSON.stringify(faux)).toBe(null)
    }
  })

  it('se refuse aussi quand il est vide : un projet sans fichier n’en est pas un', () => {
    expect(lireDepot({ nom: 'x', fichiers: [] })).toBe(null)
  })

  it('refuse un nom de fichier que l’éditeur n’accepterait pas', () => {
    expect(lireDepot({ nom: 'x', fichiers: [{ nom: '../secret.js', contenu: '' }] })).toBe(null)
    expect(lireDepot({ nom: 'x', fichiers: [{ nom: 'notes.txt', contenu: '' }] })).toBe(null)
  })

  it('coupe un nom de projet trop long plutôt que de refuser le dépôt', () => {
    const lu = lireDepot({ nom: 'a'.repeat(500), fichiers: PROJET.fichiers })
    expect(lu).not.toBe(null)
    expect(lu!.nom.length).toBeLessThan(100)
  })

  it('et refuse ce qui pèse plus que le plafond', () => {
    const gros = { nom: 'x', fichiers: [{ nom: 'a.js', contenu: 'x'.repeat(MAX_OCTETS_DEPOT + 1) }] }
    expect(lireDepot(gros)).toBe(null)
  })
})

/**
 * La clef ne quitte jamais l'appareil, et un essai le tient.
 *
 * C'est la seule chose qui distingue le propriétaire d'un projet de celui qui a
 * juste reçu le lien. Elle a sa place dans le stockage local et dans l'en-tête
 * d'une écriture, nulle part ailleurs — surtout pas dans ce qu'on dépose.
 */
describe('ce qui ne part jamais', () => {
  it('la clef reste sur le téléphone, même quand le projet la porte', () => {
    const avecClef: Projet = { ...PROJET, lien: 'ABCDEFGHJK', clef: 'a'.repeat(32) }
    const depot = pourLeDepot(avecClef)
    expect(JSON.stringify(depot)).not.toContain('a'.repeat(32))
    expect(depot).not.toHaveProperty('clef')
    expect(depot).not.toHaveProperty('lien')
  })
})

describe('les bornes du dépôt', () => {
  it('refuse plus de fichiers que l’éditeur n’en accepte', () => {
    const trop = Array.from({ length: 9 }, (_, i) => ({ nom: `f${i}.js`, contenu: '' }))
    expect(lireDepot({ nom: 'x', fichiers: trop })).toBe(null)
  })

  it('refuse deux fichiers du même nom : le second cacherait le premier', () => {
    expect(lireDepot({
      nom: 'x',
      fichiers: [{ nom: 'a.js', contenu: '1' }, { nom: 'a.js', contenu: '2' }],
    })).toBe(null)
  })
})
