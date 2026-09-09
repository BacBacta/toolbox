import { describe, expect, it } from 'vitest'
import { CATALOGUE } from '../src/catalogue.js'
import { etageDe } from '../src/etage.js'

/**
 * Le classement décide qui paie quoi, et il décide **avant** d'appeler qui que
 * ce soit. Deux erreurs, très inégales.
 *
 * Sous-estimer coûte quelques centimes : on compose ce qu'on aurait dû faire
 * payer. Sur-estimer envoie vers un abonnement quelqu'un qui voulait un seul
 * carnet — c'est refuser de vendre à quelqu'un qui payait, et il ne revient
 * pas. Le doute penche donc du côté le moins cher.
 */

const e = (d: string) => etageDe(d, CATALOGUE)

describe('ce qui ne coûte rien', () => {
  it.each([
    'il me faut un devis',
    'noter le njangi du quartier',
    'liste de prix de ma boutique',
    'inventaire du magasin',
    'frais de scolarite',
    '',
  ])('« %s » reste à l’étage 1', (d) => {
    expect(e(d)).toBe(1)
  })
})

describe('ce qui se compose, à quelques centimes', () => {
  it.each([
    'je veux suivre mes livraisons de gaz',
    'ma marge sur chaque vente de telephone',
    'un carnet pour mes poules',
  ])('« %s » passe à l’étage 2', (d) => {
    expect(e(d)).toBe(2)
  })
})

describe('ce qui demande un abonnement', () => {
  it.each([
    'il me faut tout ce qu il faut pour ma boutique',
    'tout pour gerer mon commerce',
    'je veux plusieurs outils',
    'gerer toute ma boutique',
    'un systeme complet',
  ])('« %s » monte à l’étage 3', (d) => {
    expect(e(d)).toBe(3)
  })

  it('reconnaît une liste de courses', () => {
    // Trois familles qui mordent à parts égales, ce n'est plus une hésitation
    // entre deux outils : c'est trois générations.
    expect(e('un njangi, une liste de prix et un inventaire')).toBe(3)
  })
})

describe('le doute penche du côté le moins cher', () => {
  it('ne monte pas à l’étage 3 pour une hésitation entre deux outils', () => {
    // « devis ou facture ? » se tranche par une question, pas par un abonnement.
    expect(e('je veux un devis puis une facture')).toBeLessThan(3)
  })

  it('ne monte pas pour un mot au pluriel', () => {
    expect(e('noter mes ventes')).toBeLessThan(3)
    expect(e('mes clients')).toBeLessThan(3)
  })

  it('ne monte pas pour une phrase longue mais unique', () => {
    expect(e('je veux suivre les livraisons de gaz avec le nom du client, le montant et si c est paye'))
      .toBeLessThan(3)
  })
})
