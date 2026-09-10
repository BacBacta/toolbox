import { describe, expect, it } from 'vitest'
import { lireReponseModele } from '../src/composition.js'
import { clefPropre } from '../src/clefs.js'
import { redresserRegistre, verifierRegistre } from '../src/registre.js'
import { redresserCalcul, verifierCalcul } from '../src/calcul.js'
import { redresserFormulaire, verifierFormulaire } from '../src/formulaire.js'

/**
 * La clef d'une colonne est un nom interne, et le modèle écrit en français.
 *
 * « montantDû », « dateÉchéance » : deux générations réelles mortes là-dessus,
 * en production, sur la demande la plus courante qui soit — « je veux noter qui
 * me doit de l'argent ». La clef ne sert que de propriété d'objet et de nom de
 * champ, jamais d'adresse : son orthographe exacte n'intéresse personne. La
 * refuser coûtait un tour entier pour un accent.
 *
 * C'est la deuxième fois que cette règle tue une génération : `nom_poule` avait
 * déjà eu sa peau, et on avait alors élargi la règle. L'élargir encore à chaque
 * surprise ne finit pas ; plier ce qui arrive, si.
 */
describe('une clef qu’on peut plier', () => {
  it('perd ses accents', () => {
    expect(clefPropre('montantDû')).toBe('montantDu')
    expect(clefPropre('dateÉchéance')).toBe('dateEcheance')
  })

  it('perd ce que la règle ne prend pas, et sa majuscule initiale', () => {
    expect(clefPropre('prix unitaire')).toBe('prixunitaire')
    expect(clefPropre('prix-unitaire')).toBe('prixunitaire')
    expect(clefPropre("nom d'élève")).toBe('nomdeleve')
    expect(clefPropre('Montant')).toBe('montant')
  })

  it('mais ce qui ne commence pas par une lettre ne se plie pas : on n’invente pas de nom', () => {
    expect(clefPropre('123')).toBe(null)
    expect(clefPropre('_x')).toBe(null)
    expect(clefPropre('')).toBe(null)
    expect(clefPropre('€')).toBe(null)
    expect(clefPropre(7)).toBe(null)
  })

  it('et ce qui est déjà bon ressort identique', () => {
    expect(clefPropre('prixUnitaire')).toBe('prixUnitaire')
    expect(clefPropre('nom_poule')).toBe('nom_poule')
  })
})

const REGISTRE = {
  titre: 'Qui me doit',
  kicker: 'ARDOISE',
  titreNom: 'Client',
  colonnes: [
    { clef: 'montantDû', titre: 'Montant dû', type: 'montant' },
    { clef: 'déjàPayé', titre: 'Déjà payé', type: 'montant' },
  ],
  libelleVide: 'Personne ne te doit rien.',
  libelleAjout: 'Ajouter une dette',
  relancesVides: 'Ce registre ne se relance pas.',
}

describe('un registre dont les clefs portent des accents', () => {
  it('se plie et passe', () => {
    const rendu = redresserRegistre(REGISTRE)
    expect(verifierRegistre(rendu)).toEqual([])
    expect((rendu as typeof REGISTRE).colonnes.map((c) => c.clef)).toEqual(['montantDu', 'dejaPaye'])
  })

  it('et le total qui désignait l’ancienne clef désigne la nouvelle', () => {
    const rendu = redresserRegistre({
      ...REGISTRE,
      total: { type: 'somme', clef: 'montantDû', libelle: 'Total', unite: 'F' },
    })
    expect(verifierRegistre(rendu)).toEqual([])
  })

  it('une différence aussi, des deux côtés', () => {
    const rendu = redresserRegistre({
      ...REGISTRE,
      total: { type: 'difference', plus: 'montantDû', moins: 'déjàPayé', libelle: 'Reste' },
    })
    expect(verifierRegistre(rendu)).toEqual([])
  })

  it('mais deux clefs qui se plient sur la même restent refusées', () => {
    const rendu = redresserRegistre({
      ...REGISTRE,
      colonnes: [
        { clef: 'payé', titre: 'Payé', type: 'montant' },
        { clef: 'paye', titre: 'Paye', type: 'montant' },
      ],
    })
    expect(verifierRegistre(rendu).length).toBeGreaterThan(0)
  })

  it('et une clef qui ne se plie pas reste telle quelle, pour que le reproche la nomme', () => {
    const rendu = redresserRegistre({
      ...REGISTRE,
      colonnes: [{ clef: '2eVersement', titre: 'Deuxième', type: 'montant' }],
    }) as typeof REGISTRE
    expect(rendu.colonnes[0]?.clef).toBe('2eVersement')
    expect(verifierRegistre(rendu).length).toBeGreaterThan(0)
  })

  it('un registre déjà bon traverse sans être touché', () => {
    const bon = { ...REGISTRE, colonnes: [{ clef: 'montant', titre: 'Montant', type: 'montant' }] }
    expect(redresserRegistre(bon)).toBe(bon)
  })

  it('ce qui n’est pas un registre reste refusé, et rien ne s’invente à sa place', () => {
    expect(redresserRegistre(null)).toBe(null)
    const rendu = redresserRegistre({ colonnes: 'deux' }) as { colonnes: unknown }
    expect(rendu.colonnes).toBe('deux')
    expect(verifierRegistre(rendu).length).toBeGreaterThan(0)
  })
})

const CALCUL = {
  titre: 'Commission',
  kicker: 'COMMISSION',
  titreNom: 'Transfert',
  entrees: [
    { clef: 'montantEnvoyé', titre: 'Montant envoyé', defaut: 0, unite: 'F' },
    { clef: 'tauxAppliqué', titre: 'Taux (%)', defaut: 2, unite: '' },
  ],
  sortie: {
    libelle: 'Ta commission',
    unite: 'F',
    formule: {
      op: 'pourcent',
      gauche: { ref: 'montantEnvoyé' },
      droite: { ref: 'tauxAppliqué' },
    },
  },
}

describe('une calculatrice dont les clefs portent des accents', () => {
  it('se plie, formule comprise, jusqu’au fond de l’arbre', () => {
    const rendu = redresserCalcul(CALCUL) as typeof CALCUL
    expect(verifierCalcul(rendu)).toEqual([])
    expect(rendu.entrees.map((e) => e.clef)).toEqual(['montantEnvoye', 'tauxApplique'])
    expect(rendu.sortie.formule.gauche.ref).toBe('montantEnvoye')
    expect(rendu.sortie.formule.droite.ref).toBe('tauxApplique')
  })

  /*
   * Ce qui se plie est le nom interne, et lui seul. Le titre est ce que la
   * personne lit sur son téléphone : « Montant envoye » serait la faute
   * d'orthographe de quelqu'un d'autre, affichée sous son nom à lui.
   */
  it('mais le titre garde ses accents : c’est lui qu’on lit', () => {
    const rendu = redresserCalcul(CALCUL) as typeof CALCUL
    expect(rendu.entrees[0]?.titre).toBe('Montant envoyé')
  })

  it('une calculatrice déjà bonne traverse sans être touchée', () => {
    const bon = {
      ...CALCUL,
      entrees: [{ clef: 'montant', titre: 'Montant', defaut: 0, unite: 'F' }],
      sortie: { ...CALCUL.sortie, formule: { ref: 'montant' } },
    }
    expect(redresserCalcul(bon)).toBe(bon)
  })
})

const FORMULAIRE = {
  titre: 'Commandes du week-end',
  kicker: 'COMMANDES',
  accroche: 'Dis-moi ce que tu veux et quand tu passes le chercher.',
  champs: [
    { clef: 'nomDuClient', titre: 'Ton nom', sorte: 'texte', obligatoire: true },
    { clef: 'quantitéVoulue', titre: 'Combien ?', sorte: 'nombre' },
  ],
  bouton: 'Envoyer ma commande',
  merci: 'Merci ! Je te confirme par téléphone.',
}

describe('un formulaire dont les clefs portent des accents', () => {
  it('se plie et passe', () => {
    const rendu = redresserFormulaire(FORMULAIRE)
    expect(verifierFormulaire(rendu)).toEqual([])
    expect((rendu as typeof FORMULAIRE).champs[1]?.clef).toBe('quantiteVoulue')
  })
})

/**
 * Et tout cela n'existe que si la frontière s'en sert : c'est elle qui décide
 * ce qui atteint l'écran, et c'est le redressé qu'elle doit garder.
 */
describe('la frontière plie avant de juger, et garde ce qu’elle a plié', () => {
  it('pour un registre', () => {
    const lu = lireReponseModele(REGISTRE)
    expect(lu.sorte).toBe('registre')
    if (lu.sorte !== 'registre') return
    expect(lu.registre.colonnes[0]?.clef).toBe('montantDu')
  })

  it('pour une calculatrice', () => {
    const lu = lireReponseModele(CALCUL)
    expect(lu.sorte).toBe('calcul')
    if (lu.sorte !== 'calcul') return
    expect(lu.calcul.entrees[0]?.clef).toBe('montantEnvoye')
  })

  it('pour un formulaire', () => {
    const lu = lireReponseModele(FORMULAIRE)
    expect(lu.sorte).toBe('formulaire')
    if (lu.sorte !== 'formulaire') return
    expect(lu.formulaire.champs[1]?.clef).toBe('quantiteVoulue')
  })
})

/**
 * Les trois libellés d'ambiance, et pourquoi ils ne tuent plus un registre.
 *
 * Mesuré en production, deux fois sur trente, sur « je veux noter qui me doit
 * de l'argent » :
 *
 *     "relancesVides": { "total": { "type": "somme", "clef": "montantDû", … } }
 *
 * Le modèle avait rangé le total *dans* le libellé au lieu d'à côté. Colonnes
 * justes, titres justes, tout le reste bon — et le registre mourait sur une
 * phrase que personne n'avait demandée : « Pourquoi ce registre ne se relance
 * pas. » C'est l'écran vide de la relance, pas le travail de la personne.
 *
 * Les exiger du modèle, c'est mettre trois champs décoratifs sur le chemin de
 * chaque registre, dont un au nom trompeur. Ils restent proposés — le modèle
 * les écrit mieux que nous, « Ajouter une dette » vaut mieux qu'« Ajouter » —
 * mais leur absence, ou une glissade dedans, ne coûte plus l'outil entier.
 */
describe('les libellés d’ambiance d’un registre', () => {
  const SANS = {
    titre: 'Suivi des dettes',
    kicker: 'SUIVI DES DETTES',
    titreNom: 'Nom du client',
    colonnes: [{ clef: 'montant', titre: 'Montant dû', type: 'montant' }],
  }

  it('absents, ils se remplissent tout seuls', () => {
    const lu = lireReponseModele(SANS)
    expect(lu.sorte).toBe('registre')
    if (lu.sorte !== 'registre') return
    expect(lu.registre.libelleVide.length).toBeGreaterThan(3)
    expect(lu.registre.libelleAjout.length).toBeGreaterThan(3)
    expect(lu.registre.relancesVides.length).toBeGreaterThan(3)
  })

  it('glissés, ils se remplacent — le registre vaut mieux que sa phrase d’ambiance', () => {
    const lu = lireReponseModele({
      ...SANS,
      relancesVides: { total: { type: 'somme', clef: 'montant', libelle: 'Total', unite: 'F' } },
    })
    expect(lu.sorte).toBe('registre')
  })

  it('mais ce que le modèle a bien écrit lui reste', () => {
    const lu = lireReponseModele({ ...SANS, libelleAjout: 'Ajouter une dette' })
    expect(lu.sorte).toBe('registre')
    if (lu.sorte !== 'registre') return
    expect(lu.registre.libelleAjout).toBe('Ajouter une dette')
  })

  /*
   * La tolérance s'arrête aux libellés. Un registre sans colonnes est un
   * tableau sans rien dedans : lui inventer des colonnes serait inventer le
   * travail de quelqu'un.
   */
  it('et un registre sans colonnes ne devient pas un registre pour autant', () => {
    // Il ne porte rien : le tour se lit comme une question, et jamais comme un
    // tableau vide qu'on inviterait à ouvrir.
    expect(lireReponseModele({ ...SANS, colonnes: [] }).sorte).toBe('vide')
  })
})
