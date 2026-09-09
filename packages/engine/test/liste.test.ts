import { describe, expect, it } from 'vitest'
import {
  ajouterLigne, basculerLigne, booleenDe, colonneBascule, colonneIdentite,
  colonnesSecondaires, comptageBascule, lignesEnAlerte, ligneNeuve, nombreDe,
  retirerLigne, schemaListe, texteDe, totalListe,
} from '../src/compute/liste.js'
import type { ConfigListe, EtatListe } from '../src/compute/liste.js'
import { estValide, messageErreurs, valider } from '../src/valider.js'

const CAISSE: ConfigListe = {
  kicker: 'LIVRE DE CAISSE',
  colonnes: [
    { clef: 'libelle', titre: 'Libellé', type: 'texte' },
    { clef: 'entree', titre: 'Entrée (F CFA)', type: 'montant' },
    { clef: 'sortie', titre: 'Sortie (F CFA)', type: 'montant' },
  ],
  total: { type: 'difference', plus: 'entree', moins: 'sortie', libelle: 'Solde' },
  libelleVide: 'Aucune écriture.',
  libelleAjout: 'Ajouter une écriture',
  relancesVides: 'Un livre de caisse ne se relance pas.',
}

const PRIX: ConfigListe = {
  kicker: 'LISTE DE PRIX',
  colonnes: [
    { clef: 'article', titre: 'Article', type: 'texte' },
    { clef: 'prix', titre: 'Prix (F CFA)', type: 'montant' },
    { clef: 'disponible', titre: 'Disponible', type: 'bascule' },
  ],
  libelleVide: 'Aucun article.',
  libelleAjout: 'Ajouter un article',
  relancesVides: 'Une liste de prix se diffuse, elle ne se relance pas.',
}

const STOCK: ConfigListe = {
  kicker: 'INVENTAIRE',
  colonnes: [
    { clef: 'article', titre: 'Article', type: 'texte' },
    { clef: 'reste', titre: 'Reste', type: 'nombre' },
  ],
  total: { type: 'somme', clef: 'reste', libelle: 'Articles', unite: '' },
  alerte: { clef: 'reste', seuil: 5, libelle: 'à réapprovisionner' },
  libelleVide: 'Inventaire vide.',
  libelleAjout: 'Ajouter un article',
  relancesVides: 'Un inventaire ne se relance pas.',
}

const ECRITURES: EtatListe = {
  nom: 'Caisse de la boutique',
  lignes: [
    { libelle: 'Vente du matin', entree: 24_000, sortie: 0 },
    { libelle: 'Achat de sacs', entree: 0, sortie: 7_500 },
    { libelle: 'Vente du soir', entree: 18_000, sortie: 0 },
  ],
}

describe('lire une cellule sans jamais se casser', () => {
  it('rend une valeur par défaut quand le type ne correspond pas', () => {
    const ligne = { a: 'texte', b: 12, c: true }
    expect(texteDe(ligne, 'a')).toBe('texte')
    expect(texteDe(ligne, 'b')).toBe('')
    expect(texteDe(ligne, 'absent')).toBe('')
    expect(nombreDe(ligne, 'b')).toBe(12)
    expect(nombreDe(ligne, 'a')).toBe(0)
    expect(booleenDe(ligne, 'c')).toBe(true)
    expect(booleenDe(ligne, 'a')).toBe(false)
  })

  it('refuse un nombre non fini', () => {
    expect(nombreDe({ x: Number.NaN }, 'x')).toBe(0)
    expect(nombreDe({ x: Number.POSITIVE_INFINITY }, 'x')).toBe(0)
  })
})

describe('la configuration décrit la forme du registre', () => {
  it('nomme la colonne d’identité', () => {
    expect(colonneIdentite(CAISSE).clef).toBe('libelle')
  })

  it('trouve la colonne bascule, ou dit qu’il n’y en a pas', () => {
    expect(colonneBascule(PRIX)?.clef).toBe('disponible')
    expect(colonneBascule(CAISSE)).toBeNull()
  })

  it('sépare les colonnes secondaires de l’identité et de la bascule', () => {
    expect(colonnesSecondaires(PRIX).map((c) => c.clef)).toEqual(['prix'])
    expect(colonnesSecondaires(CAISSE).map((c) => c.clef)).toEqual(['entree', 'sortie'])
  })

  it('refuse une liste sans colonne plutôt que de rendre undefined', () => {
    expect(() => colonneIdentite({ ...CAISSE, colonnes: [] })).toThrow(RangeError)
  })
})

describe('totalListe', () => {
  it('fait la différence entre entrées et sorties', () => {
    expect(totalListe(CAISSE, ECRITURES)).toBe(34_500)
  })

  it('somme une colonne', () => {
    expect(totalListe(STOCK, { nom: 'Magasin', lignes: [{ article: 'a', reste: 12 }, { article: 'b', reste: 3 }] }))
      .toBe(15)
  })

  it('rend null quand la configuration n’en prévoit pas', () => {
    expect(totalListe(PRIX, { nom: 'Boutique', lignes: [] })).toBeNull()
  })

  it('rend zéro sur une liste vide plutôt que null', () => {
    expect(totalListe(CAISSE, { nom: 'Caisse', lignes: [] })).toBe(0)
  })
})

describe('lignesEnAlerte', () => {
  const magasin: EtatListe = {
    nom: 'Magasin',
    lignes: [{ article: 'Ciment', reste: 40 }, { article: 'Tôles', reste: 3 }, { article: 'Clous', reste: 5 }],
  }

  it('signale ce qui passe au seuil ou en dessous', () => {
    expect(lignesEnAlerte(STOCK, magasin)).toEqual([1, 2])
  })

  it('ne signale rien quand la configuration n’a pas d’alerte', () => {
    expect(lignesEnAlerte(CAISSE, ECRITURES)).toEqual([])
  })
})

describe('comptageBascule', () => {
  it('compte ce qui est disponible sur le total', () => {
    const boutique: EtatListe = {
      nom: 'Boutique',
      lignes: [
        { article: 'Riz', prix: 18_500, disponible: true },
        { article: 'Huile', prix: 7_200, disponible: true },
        { article: 'Savon', prix: 4_800, disponible: false },
      ],
    }
    expect(comptageBascule(PRIX, boutique)).toEqual({ oui: 2, total: 3 })
  })

  it('rend null sans colonne bascule', () => {
    expect(comptageBascule(CAISSE, ECRITURES)).toBeNull()
  })
})

describe('les transitions', () => {
  it('fabrique une ligne neuve conforme aux types des colonnes', () => {
    expect(ligneNeuve(PRIX)).toEqual({ article: '', prix: 0, disponible: false })
    expect(ligneNeuve(CAISSE)).toEqual({ libelle: '', entree: 0, sortie: 0 })
  })

  it('ajoute une ligne à la fin', () => {
    const apres = ajouterLigne(CAISSE, ECRITURES, { libelle: 'Taxi', entree: 0, sortie: 1_500 })
    expect(apres.lignes).toHaveLength(4)
    expect(totalListe(CAISSE, apres)).toBe(33_000)
  })

  it('refuse une ligne entièrement vide', () => {
    expect(() => ajouterLigne(CAISSE, ECRITURES, ligneNeuve(CAISSE))).toThrow(RangeError)
    expect(() => ajouterLigne(CAISSE, ECRITURES, { libelle: '   ', entree: 0, sortie: 0 })).toThrow()
  })

  it('accepte une ligne qui n’a qu’un montant', () => {
    expect(ajouterLigne(CAISSE, ECRITURES, { libelle: '', entree: 500, sortie: 0 }).lignes).toHaveLength(4)
  })

  it('retire la bonne ligne, sans toucher à l’original', () => {
    const apres = retirerLigne(ECRITURES, 1)
    expect(apres.lignes.map((l) => l['libelle'])).toEqual(['Vente du matin', 'Vente du soir'])
    expect(ECRITURES.lignes).toHaveLength(3)
  })

  it('bascule la bonne ligne', () => {
    const boutique: EtatListe = {
      nom: 'Boutique',
      lignes: [{ article: 'Riz', prix: 100, disponible: true }, { article: 'Huile', prix: 200, disponible: false }],
    }
    const apres = basculerLigne(PRIX, boutique, 1)
    expect(apres.lignes[1]?.['disponible']).toBe(true)
    expect(apres.lignes[0]?.['disponible']).toBe(true)
    expect(boutique.lignes[1]?.['disponible']).toBe(false)
  })

  it('refuse un index hors liste, et une bascule là où il n’y en a pas', () => {
    expect(() => retirerLigne(ECRITURES, 9)).toThrow(RangeError)
    expect(() => basculerLigne(PRIX, { nom: 'x', lignes: [] }, 0)).toThrow(RangeError)
    expect(() => basculerLigne(CAISSE, ECRITURES, 0)).toThrow(/colonne à basculer/)
  })
})

describe('le schéma se déduit des colonnes', () => {
  it('accepte un état conforme', () => {
    const erreurs = valider(schemaListe(CAISSE, 'Nom du registre'), ECRITURES)
    expect(messageErreurs(erreurs)).toBe('')
  })

  it('donne un type à chaque colonne selon sa nature', () => {
    const schema = schemaListe(PRIX, 'Nom')
    expect(estValide(schema, { nom: 'B', lignes: [{ article: 'Riz', prix: 100, disponible: true }] })).toBe(true)
    expect(estValide(schema, { nom: 'B', lignes: [{ article: 'Riz', prix: 100.5, disponible: true }] })).toBe(false)
    expect(estValide(schema, { nom: 'B', lignes: [{ article: 'Riz', prix: 100, disponible: 'oui' }] })).toBe(false)
    expect(estValide(schema, { nom: 'B', lignes: [{ article: 42, prix: 100, disponible: true }] })).toBe(false)
  })

  it('refuse une colonne que la configuration ne déclare pas', () => {
    const schema = schemaListe(STOCK, 'Nom')
    expect(estValide(schema, { nom: 'M', lignes: [{ article: 'a', reste: 1, secret: 'x' }] })).toBe(false)
  })

  it('refuse un montant négatif', () => {
    const schema = schemaListe(CAISSE, 'Nom')
    expect(estValide(schema, { nom: 'C', lignes: [{ libelle: 'a', entree: -1, sortie: 0 }] })).toBe(false)
  })

  it('porte les libellés des colonnes, pour que le formulaire les affiche', () => {
    const schema = schemaListe(CAISSE, 'Nom du registre')
    const lignes = schema.type === 'object' ? schema.properties['lignes'] : undefined
    const item = lignes?.type === 'array' ? lignes.items : undefined
    const entree = item?.type === 'object' ? item.properties['entree'] : undefined
    expect(entree?.title).toBe('Entrée (F CFA)')
  })
})
