import { describe, expect, it } from 'vitest'
import { CATALOGUE } from '../src/catalogue.js'
import { comprendre } from '../src/comprendre.js'
import { extraire } from '../src/extraire.js'
import { devis, njangi } from '../src/skeletons/index.js'

/**
 * L'étage 1 doit répondre à environ sept demandes sur dix (BRIEF.md § 4).
 * Ce fichier est la mesure de cette promesse, pas une illustration : les
 * phrases sont écrites comme quelqu'un les tape, et si la couverture retombe
 * sous le seuil, le test le dit.
 */

const c = (demande: string) => comprendre(demande, CATALOGUE)

describe('les demandes claires ouvrent le bon outil', () => {
  it.each([
    ['il me faut un devis', 'devis'],
    ['je veux faire une pro forma', 'devis'],
    ['facture pour mon client', 'facture'],
    ['noter le njangi de la semaine', 'njangi'],
    ['on fait un djangi tous les mois', 'njangi'],
    ['ma tontine', 'njangi'],
    ['liste de prix de la boutique', 'prix'],
    ['je note mes recettes et mes depenses', 'caisse'],
    ['inventaire du magasin', 'stock'],
    ['ce qui me reste en marchandise', 'stock'],
    ['carnet d adresses de mes clients', 'clients'],
    ['frais de scolarite de la rentree', 'scolarite'],
    ['partager la course de benskin', 'course'],
    ['une attestation de travail', 'attestation'],
    ['j ai recu un acompte, il me faut un recu', 'recu'],
    ['une reconnaissance de dette pour mon pret', 'dette'],
    ['une lettre de motivation pour postuler', 'motivation'],
  ])('« %s » → %s', (demande, id) => {
    const r = c(demande)
    expect(r.sorte).toBe('sur')
    if (r.sorte === 'sur') expect(r.fiche.id).toBe(id)
  })
})

describe('ce que la phrase disait est retenu', () => {
  it('garde la cotisation et la période d’un njangi', () => {
    const r = c('njangi de 20 000 F par mois')
    expect(r.sorte).toBe('sur')
    if (r.sorte !== 'sur') return
    expect(r.fiche.id).toBe('njangi')
    expect(r.extrait.montants).toEqual([20_000])
    expect(r.extrait.periode).toBe('mois')
  })

  it('compte les membres sans les confondre avec de l’argent', () => {
    const r = c('tontine a 12 membres de 5 000 F la semaine')
    expect(r.sorte).toBe('sur')
    if (r.sorte !== 'sur') return
    expect(r.extrait.compte).toBe(12)
    expect(r.extrait.montants).toEqual([5_000])
    expect(r.extrait.periode).toBe('semaine')
  })
})

describe('on demande plutôt que de parier', () => {
  it('propose les deux quand devis et facture sont dans la phrase', () => {
    const r = c('je veux un devis puis une facture')
    expect(r.sorte).toBe('ambigu')
    if (r.sorte === 'ambigu') {
      expect(r.fiches.map((f) => f.id)).toContain('devis')
      expect(r.fiches.map((f) => f.id)).toContain('facture')
    }
  })

  it('ne propose jamais une grille entière', () => {
    const r = c('je veux un devis une facture un stock et des clients')
    if (r.sorte === 'ambigu') expect(r.fiches.length).toBeLessThanOrEqual(4)
  })
})

describe('ce que l’étage 1 ne sait pas faire, il le dit', () => {
  it.each([
    'il me faut un contrat de bail',
    'un pacte d actionnaires',
  ])('« %s » sort de sa portée', (demande) => {
    expect(c(demande).sorte).toBe('hors-portee')
  })

  it('« je veux faire un cv » ne sort plus de sa portée : l’atelier en fait un', () => {
    // Cette demande était hors-portée tant que le CV n'existait pas. Le test
    // suit le catalogue : ce qui devient possible cesse d'être refusé.
    const r = c('je veux faire un cv')
    expect(r.sorte).toBe('sur')
    if (r.sorte === 'sur') expect(r.fiche.id).toBe('cv')
  })

  it('une demande vide ne déclenche rien', () => {
    expect(c('   ').sorte).toBe('vide')
  })
})

describe('la couverture de l’étage 1, mesurée', () => {
  /*
   * Un échantillon de demandes plausibles. Ce n'est pas une preuve — seul du
   * vrai trafic le serait — mais c'est un plancher : si une modification des
   * mots-clefs fait retomber la couverture, le test échoue au lieu de laisser
   * l'étage 2 payer la différence en jetons.
   */
  const DEMANDES: readonly string[] = [
    'il me faut un devis', 'devis pour un chantier', 'une pro forma',
    'facture pour Ets Ngo Bassong', 'je dois facturer mon client',
    'on me doit de l argent', 'noter mon njangi', 'la tontine du quartier',
    'djangi de 10 000 par semaine', 'ma cagnotte', 'liste de prix',
    'combien coute mon sac de riz', 'le menu de mon restaurant',
    'mes recettes du jour', 'livre de compte', 'argent du jour',
    'inventaire', 'ce qui me reste au magasin', 'mes marchandises',
    'annuaire de mes clients', 'mes contacts', 'frais de scolarite',
    'la rentree des enfants', 'partager une course', 'diviser l addition',
    'chacun paye sa part', 'un taxi a plusieurs',
  ]

  it('répond à au moins 70 % de l’échantillon sans monter d’étage', () => {
    const repondues = DEMANDES.filter((d) => c(d).sorte === 'sur').length
    const part = repondues / DEMANDES.length
    expect(part).toBeGreaterThanOrEqual(0.7)
  })
})

describe('l’outil s’ouvre garni de ce que la phrase disait', () => {
  it('donne au njangi sa cotisation et sa période', () => {
    const etat = njangi.garnir?.(njangi.defaults, extraire('njangi de 20 000 F par mois'))
    expect(etat?.cotisation).toBe(20_000)
    expect(etat?.periode).toBe('mois')
  })

  it('ne prend pas l’effectif pour une cotisation', () => {
    // « 8 personnes de 20 000 » : l'ordre de grandeur sépare les deux.
    const etat = njangi.garnir?.(njangi.defaults, extraire('njangi à 8 personnes de 20 000'))
    expect(etat?.cotisation).toBe(20_000)
  })

  it('laisse la valeur par défaut quand la phrase ne dit rien', () => {
    const etat = njangi.garnir?.(njangi.defaults, extraire('noter mon njangi'))
    expect(etat?.cotisation).toBe(njangi.defaults.cotisation)
    expect(etat?.periode).toBe(njangi.defaults.periode)
  })

  it('donne au devis son acompte, et rien d’autre', () => {
    const etat = devis.garnir?.(devis.defaults, extraire('devis de 250 000 F, acompte de 30 %'))
    expect(etat?.acompte).toBe(30)
    // La somme ne dit pas ce qu'elle est : aucune ligne n'est inventée.
    expect(etat?.lignes).toEqual([])
  })
})

describe('une demande qui vaut plusieurs outils se dit telle quelle', () => {
  it.each([
    'il me faut tout ce qu il faut pour ma boutique',
    'un njangi, une liste de prix et un inventaire',
    'je veux plusieurs outils',
  ])('« %s » n’ouvre pas un outil au hasard', (demande) => {
    expect(c(demande).sorte).toBe('plusieurs')
  })

  it('ne répond pas au dixième de la question sans le dire', () => {
    // « Tout ce qu'il faut pour ma boutique » contient « boutique », donc se
    // classe très bien en liste de prix. Ouvrir la liste de prix serait une
    // réponse plausible à une question qu'on n'a pas écoutée.
    const r = c('il me faut tout ce qu il faut pour ma boutique')
    expect(r.sorte).not.toBe('sur')
  })
})
