import { describe, expect, it } from 'vitest'
import { couter } from '../src/cout.js'
import type { DemandeModele, Fournisseur } from '../src/fournisseur.js'
import { traiter } from '../src/traiter.js'

/**
 * Aucun appel réseau ici. Un faux fournisseur rend les réponses qu'on lui
 * donne — y compris les mauvaises, qui sont celles qui comptent : c'est la
 * sortie de modèle abîmée qu'il faut arrêter, pas la bonne.
 */

const BON = JSON.stringify({
  titre: 'Suivi des livraisons',
  kicker: 'SUIVI DES LIVRAISONS',
  titreNom: 'Nom du dépôt',
  colonnes: [
    { clef: 'client', titre: 'Client', type: 'texte' },
    { clef: 'montant', titre: 'Montant (F CFA)', type: 'montant' },
  ],
  libelleVide: 'Aucune livraison pour l’instant.',
  libelleAjout: 'Ajouter une livraison',
  relancesVides: 'Un suivi se consulte, il ne se relance pas.',
})

const MAUVAIS = JSON.stringify({ ...JSON.parse(BON), total: { type: 'somme', clef: 'inconnue', libelle: 'Total', unite: 'F' } })

function faux(reponses: readonly string[]): Fournisseur & { vus: DemandeModele[] } {
  const vus: DemandeModele[] = []
  return {
    nom: 'faux',
    prix: { entree: 0.1, sortie: 0.4 },
    vus,
    appeler: (d) => {
      vus.push(d)
      return Promise.resolve({
        texte: reponses[vus.length - 1] ?? '',
        jetonsEntree: 1_500,
        jetonsSortie: 500,
      })
    },
  }
}

describe('le chemin qui marche', () => {
  it('rend la configuration au premier essai', async () => {
    const f = faux([BON])
    const r = await traiter('je veux suivre mes livraisons', f, 600)
    expect(r.sorte).toBe('reussi')
    if (r.sorte !== 'reussi') return
    expect(r.essais).toBe(1)
    expect(r.registre.colonnes).toHaveLength(2)
    expect(f.vus).toHaveLength(1)
  })

  it('tient le budget du brief : moins d’un franc la génération', async () => {
    // 1 500 jetons en entrée, 500 en sortie, au tarif Flash-Lite (§ 5).
    const r = await traiter('un registre', faux([BON]), 600)
    expect(r.cout.fcfa).toBeLessThan(1)
  })

  it('déshabille un bloc de code, faute de forme et non de fond', async () => {
    const r = await traiter('un registre', faux(['```json\n' + BON + '\n```']), 600)
    expect(r.sorte).toBe('reussi')
  })
})

describe('la reprise, une seule fois', () => {
  it('reprend après une sortie invalide, et réussit', async () => {
    const f = faux([MAUVAIS, BON])
    const r = await traiter('je veux suivre mes livraisons', f, 600)
    expect(r.sorte).toBe('reussi')
    if (r.sorte === 'reussi') expect(r.essais).toBe(2)

    // La reprise porte ce que le modèle a dit et pourquoi c'était faux : sans
    // le reproche nommé, il recommencerait au hasard.
    const reprise = f.vus[1]?.reprise
    expect(reprise?.sortie).toBe(MAUVAIS)
    expect(reprise?.reproches).toContain('ne désigne aucune colonne')
  })

  it('abandonne après le deuxième échec, sans boucler', async () => {
    const f = faux([MAUVAIS, MAUVAIS, BON])
    const r = await traiter('un registre', f, 600)
    expect(r.sorte).toBe('invalide')
    // Trois appels brûleraient le budget d'un compte sur une demande perdue.
    expect(f.vus).toHaveLength(2)
  })

  it('compte les deux tours dans le coût, même quand ça rate', async () => {
    const r = await traiter('un registre', faux([MAUVAIS, MAUVAIS]), 600)
    const unTour = couter({ entree: 1_500, sortie: 500 }, { entree: 0.1, sortie: 0.4 }, 600)
    expect(r.cout.fcfa).toBeCloseTo(unTour.fcfa * 2, 2)
  })
})

describe('ce qui ne doit jamais atteindre l’écran', () => {
  it.each([
    ['du HTML', '<div onclick="alert(1)">Registre</div>'],
    ['du JavaScript', 'fetch("https://ailleurs").then(r => r.json())'],
    ['des politesses', 'Bien sûr ! Voici votre registre.'],
    ['rien', ''],
  ])('refuse %s, deux fois de suite', async (_quoi, sortie) => {
    const r = await traiter('un registre', faux([sortie, sortie]), 600)
    expect(r.sorte).toBe('invalide')
  })

  it('refuse un JSON bien formé qui décrit autre chose', async () => {
    // C'est le cas dangereux : la forme est bonne, le fond ne l'est pas.
    const r = await traiter('un registre', faux([
      JSON.stringify({ html: '<script>x</script>' }),
      JSON.stringify({ html: '<script>x</script>' }),
    ]), 600)
    expect(r.sorte).toBe('invalide')
  })
})
