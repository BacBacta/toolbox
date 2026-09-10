import { describe, expect, it } from 'vitest'
import { lireReponseModele } from '../src/composition.js'
import { MAX_REFUS } from '../src/registre.js'

/**
 * La frontière : rien de ce que le modèle a dit n'atteint l'écran sans passer
 * ici.
 *
 * L'aiguillage se fait sur **la forme**, et non sur un champ « type » que le
 * modèle devrait penser à remplir : un champ de discrimination de plus, c'est
 * une occasion de plus de se tromper, et une reprise coûte un tour.
 */

const REGISTRE = {
  titre: 'Suivi des livraisons',
  kicker: 'SUIVI DES LIVRAISONS',
  titreNom: 'Nom du dépôt',
  colonnes: [{ clef: 'client', titre: 'Client', type: 'texte' }],
  libelleVide: 'Aucune livraison.',
  libelleAjout: 'Ajouter',
  relancesVides: 'Un suivi ne se relance pas.',
}

const CALCUL = {
  titre: 'Marge', kicker: 'MARGE', titreNom: 'Nom du produit',
  entrees: [
    { clef: 'achat', titre: 'Prix d’achat', defaut: 0, unite: 'F' },
    { clef: 'vente', titre: 'Prix de vente', defaut: 0, unite: 'F' },
  ],
  sortie: {
    libelle: 'Marge', unite: 'F',
    formule: { op: 'moins', gauche: { ref: 'vente' }, droite: { ref: 'achat' } },
  },
}

const PAGE = {
  titre: 'Quincaillerie', kicker: 'QUINCAILLERIE', accroche: 'Tôles et ciment.',
  sections: [{ titre: 'Nos prix', sorte: 'prix', lignes: [{ nom: 'Ciment', valeur: '5 800 F' }] }],
}

const FORMULAIRE = {
  titre: 'Commandes', kicker: 'TRAITEUR', accroche: 'Commande avant vendredi.',
  champs: [{ clef: 'nom', titre: 'Ton nom', sorte: 'texte' }],
  bouton: 'Envoyer', merci: 'C’est noté.',
}

describe('la forme dit la famille', () => {
  it.each([
    ['un registre', REGISTRE, 'registre'],
    ['une calculatrice', CALCUL, 'calcul'],
    ['une page', PAGE, 'page'],
    ['un formulaire', FORMULAIRE, 'formulaire'],
    ['un refus', { impossible: 'Un logo se dessine, il ne se tient pas en lignes.' }, 'refus'],
  ])('%s se reconnaît', (_nom, valeur, attendue) => {
    expect(lireReponseModele(valeur).sorte).toBe(attendue)
  })

  it('reconnaît le refus avant tout le reste', () => {
    // Un modèle qui dit « je ne peux pas » a bien travaillé ; le reprendre pour
    // non-conformité brûlerait un tour à lui faire inventer ce qu'il vient de
    // refuser d'inventer.
    expect(lireReponseModele({ impossible: 'Non, je ne peux pas.', colonnes: [] }).sorte).toBe('refus')
  })

  it('rapporte les reproches quand la forme est bonne et le contenu faux', () => {
    const lu = lireReponseModele({ ...REGISTRE, colonnes: [] })
    expect(lu.sorte).toBe('invalide')
    expect(lu.sorte === 'invalide' && lu.erreurs.length).toBeGreaterThan(0)
  })

  it('refuse ce qui n’est pas un objet', () => {
    for (const valeur of [null, 'bonjour', 42, undefined]) {
      expect(lireReponseModele(valeur).sorte).toBe('invalide')
    }
  })
})

describe('le schéma renvoyé au lieu d’un objet qui le respecte', () => {
  /*
   * Mesuré en production : une demande sur dix recevait notre propre schéma,
   * renvoyé tel quel. Il est long, il se fait couper en route, et le reproche
   * qui suivait — « la réponse n'est pas du JSON » — ne disait rien de ce qui
   * s'était passé. La reprise repartait au hasard, et coûtait un tour pour
   * rien.
   */
  it('se reconnaît, et le reproche dit quoi faire', () => {
    const lu = lireReponseModele({ type: 'object', properties: { titre: { type: 'string' } } })
    expect(lu.sorte).toBe('invalide')
    expect(lu.sorte === 'invalide' && lu.erreurs[0]?.message).toContain('renvoyé le schéma')
  })

  it('ne se déclenche pas sur une colonne qui s’appelle « type »', () => {
    // Un registre de motos en a une. Mais elle vit dans `colonnes`, pas à la
    // racine.
    const motos = {
      ...REGISTRE,
      colonnes: [{ clef: 'type', titre: 'Type', type: 'texte' }],
    }
    expect(lireReponseModele(motos).sorte).toBe('registre')
  })
})

describe('un refus trop long', () => {
  it('se coupe à un mot, plutôt que d’être jeté', () => {
    /*
     * Mesuré en production : un refus de cent quatre-vingt-onze caractères a
     * été jugé invalide, le modèle repris — donc payé deux fois — puis
     * abandonné. La personne a dépensé un crédit pour lire « le modèle n'a pas
     * produit un registre utilisable » à la place d'une phrase qui répondait à
     * sa question.
     */
    const long = `${'Je ne peux pas faire cela, '.repeat(10)}désolé.`
    const lu = lireReponseModele({ impossible: long })
    expect(lu.sorte).toBe('refus')
    if (lu.sorte !== 'refus') return
    expect(lu.pourquoi.length).toBeLessThanOrEqual(MAX_REFUS)
    // Coupé à un mot : « je ne peux pas créer ce regis… » donne l'air d'une
    // panne plutôt que d'une phrase abrégée.
    expect(lu.pourquoi.endsWith('…')).toBe(true)
    expect(lu.pourquoi).not.toMatch(/\s…$/)
  })

  it('mais un refus vide n’est pas un refus', () => {
    expect(lireReponseModele({ impossible: '' }).sorte).toBe('invalide')
    expect(lireReponseModele({ impossible: 42 }).sorte).toBe('invalide')
  })
})
