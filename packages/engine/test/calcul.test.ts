import { describe, expect, it } from 'vitest'
import { MAX_ENTREES, verifierCalcul } from '../src/calcul.js'
import type { CalculDemande } from '../src/calcul.js'

/**
 * Le contrat de la calculatrice, qui est la frontière.
 *
 * La formule est un **arbre déclaré**, jamais du code : c'est ce qui permet au
 * modèle de décrire un calcul sans jamais obtenir le droit d'en exécuter un
 * (invariant § 2.1). Ce fichier vérifie les incohérences que le schéma ne sait
 * pas dire, et la première est la plus dangereuse — une formule qui parle d'un
 * champ inexistant rendrait zéro sans rien dire, et un zéro ressemble à une
 * réponse.
 */

const BON: CalculDemande = {
  titre: 'Reste à payer',
  kicker: 'RESTE À PAYER',
  titreNom: 'Nom de l’élève',
  entrees: [
    { clef: 'total', titre: 'Total dû', defaut: 0, unite: 'F' },
    { clef: 'verse', titre: 'Déjà versé', defaut: 0, unite: 'F' },
  ],
  sortie: {
    libelle: 'Reste à payer',
    unite: 'F',
    formule: { op: 'moins', gauche: { ref: 'total' }, droite: { ref: 'verse' } },
  },
}

describe('une calculatrice bien composée', () => {
  it('passe', () => {
    expect(verifierCalcul(BON)).toEqual([])
  })

  it('accepte le souligné dans une clef, comme les registres', () => {
    // Une génération réelle est morte sur `nom_poule`, qui ne casse rien : la
    // clef ne sert que de propriété d'objet, jamais d'adresse.
    const avec = {
      ...BON,
      entrees: [{ clef: 'prix_unitaire', titre: 'Prix', defaut: 0, unite: 'F' as const }],
      sortie: { ...BON.sortie, formule: { ref: 'prix_unitaire' } },
    }
    expect(verifierCalcul(avec)).toEqual([])
  })
})

describe('les incohérences que le schéma ne sait pas dire', () => {
  it('refuse une formule qui parle d’un champ inexistant', () => {
    // Elle rendrait zéro sans rien dire — le pire résultat pour une
    // calculatrice, parce qu'un zéro ressemble à une réponse.
    const erreurs = verifierCalcul({ ...BON, sortie: { ...BON.sortie, formule: { ref: 'benefice' } } })
    expect(erreurs.length).toBeGreaterThan(0)
    expect(erreurs[0]?.chemin).toContain('$.sortie.formule')
  })

  it('refuse une clef qui n’en est pas une', () => {
    const erreurs = verifierCalcul({
      ...BON,
      entrees: [{ clef: 'Total dû', titre: 'Total', defaut: 0, unite: 'F' }],
      sortie: { ...BON.sortie, formule: { nombre: 0 } },
    })
    expect(erreurs[0]?.chemin).toBe('$.entrees[0].clef')
    expect(erreurs[0]?.message).toContain('minuscule')
  })

  it('refuse deux clefs identiques', () => {
    const erreurs = verifierCalcul({
      ...BON,
      entrees: [
        { clef: 'total', titre: 'Total dû', defaut: 0, unite: 'F' },
        { clef: 'total', titre: 'Total payé', defaut: 0, unite: 'F' },
      ],
    })
    expect(erreurs.some((e) => e.message.includes('deux fois'))).toBe(true)
  })

  it('refuse plus de champs qu’on n’en remplit sur un téléphone', () => {
    const trop = {
      ...BON,
      entrees: Array.from({ length: MAX_ENTREES + 1 }, (_, i) => ({
        clef: `c${i}`, titre: `Champ ${i}`, defaut: 0, unite: 'F' as const,
      })),
    }
    expect(verifierCalcul(trop).length).toBeGreaterThan(0)
  })

  it('ne cherche pas d’incohérence dans ce qui n’a pas la bonne forme', () => {
    // Le schéma tranche d'abord : chercher une clef en double dans un objet
    // sans `entrees` jetterait au lieu de rapporter.
    expect(verifierCalcul({ titre: 'x' }).length).toBeGreaterThan(0)
    expect(verifierCalcul(null).length).toBeGreaterThan(0)
  })
})
