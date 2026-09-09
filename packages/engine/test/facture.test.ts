import { describe, expect, it } from 'vitest'
import {
  chiffrerFacture, dateEcheance, joursDeRetard, LIBELLE_MOYEN, LIBELLE_STATUT, statutFacture,
} from '../src/compute/facture.js'
import type { EtatFacture } from '../src/compute/facture.js'
import { facture, factureCard, factureShare, PREFIXE_FACTURE } from '../src/skeletons/facture.js'
import type { RenderContext } from '../src/types.js'

const FACTURE: EtatFacture = {
  nom: 'Facture — Ets Mbarga & Fils',
  encre: 'encre',
  numero: 'FA-2026-0042',
  emisLe: '2026-09-09T07:45:00.000Z',
  echeance: '2026-09-30T00:00:00.000Z',
  devisNumero: 'DV-2026-0118',
  emetteur: {
    nom: 'QUINCAILLERIE BÉPANDA',
    forme: 'Ets — Établissement individuel',
    activite: 'Quincaillerie · matériaux · outillage',
    adresse: 'Rue Bépanda-Omnisport, BP 4127 Douala',
    tel: '+237 6 99 41 27 08',
    mail: 'contact@quincaillerie-bepanda.cm',
    rccm: 'RC/DLA/2022/A/1487',
    niu: 'M022114873829Y',
    centre: 'CDI Douala 3ᵉ',
  },
  client: { nom: 'Ets Mbarga & Fils', niu: 'M019887641203K', estEntreprise: true },
  conditionsReglement: 'Règlement par MTN Mobile Money ou Orange Money.',
  lignes: [
    { designation: 'Fourniture de tôles bac 30/100', quantite: 24, prixUnitaire: 12_500 },
    { designation: 'Pointes et accessoires de pose', quantite: 1, prixUnitaire: 38_000 },
    { designation: 'Livraison sur chantier Akwa', quantite: 1, prixUnitaire: 15_000 },
  ],
  reglements: [],
}

const AVANT_ECHEANCE = new Date('2026-09-15T09:00:00.000Z')
const APRES_ECHEANCE = new Date('2026-10-05T09:00:00.000Z')

function ctx(maintenant: Date): RenderContext {
  return { lien: 'atl.cm/f/ZBV3', maintenant }
}

const ACOMPTE = { date: '2026-09-12T10:00:00.000Z', montant: 210_477, moyen: 'momo' as const }

describe('chiffrerFacture', () => {
  it('reprend les totaux du devis dont elle découle', () => {
    const c = chiffrerFacture(FACTURE)
    expect(c.totalHT).toBe(353_000)
    expect(c.totalTVA).toBe(67_953)
    expect(c.totalTTC).toBe(420_953)
  })

  it('sans règlement, tout reste à payer', () => {
    const c = chiffrerFacture(FACTURE)
    expect(c).toMatchObject({ verse: 0, reste: 420_953, tropPercu: 0, estSoldee: false })
    expect(c.partReglee).toBe(0)
  })

  it('additionne les règlements enregistrés', () => {
    const c = chiffrerFacture({ ...FACTURE, reglements: [ACOMPTE, { ...ACOMPTE, montant: 100_000 }] })
    expect(c.verse).toBe(310_477)
    expect(c.reste).toBe(110_476)
    expect(c.partReglee).toBeCloseTo(310_477 / 420_953, 10)
  })

  it('solde la facture quand le compte y est', () => {
    const c = chiffrerFacture({ ...FACTURE, reglements: [{ ...ACOMPTE, montant: 420_953 }] })
    expect(c).toMatchObject({ reste: 0, estSoldee: true, tropPercu: 0 })
    expect(c.partReglee).toBe(1)
  })

  it('signale le trop-perçu sans jamais rendre un reste négatif', () => {
    const c = chiffrerFacture({ ...FACTURE, reglements: [{ ...ACOMPTE, montant: 500_000 }] })
    expect(c.reste).toBe(0)
    expect(c.tropPercu).toBe(79_047)
    expect(c.partReglee).toBe(1)
  })

  it('tient sur une facture à zéro franc', () => {
    const c = chiffrerFacture({ ...FACTURE, lignes: [] })
    expect(c).toMatchObject({ totalTTC: 0, reste: 0, estSoldee: true })
    expect(c.partReglee).toBe(1)
  })

  it('refuse un règlement négatif ou fractionnaire', () => {
    expect(() => chiffrerFacture({ ...FACTURE, reglements: [{ ...ACOMPTE, montant: -1 }] })).toThrow()
    expect(() => chiffrerFacture({ ...FACTURE, reglements: [{ ...ACOMPTE, montant: 1.5 }] })).toThrow()
  })
})

describe('statutFacture — l’échéance prime sur l’acompte', () => {
  it('est « à payer » avant l’échéance, sans versement', () => {
    expect(statutFacture(FACTURE, AVANT_ECHEANCE)).toBe('a-payer')
  })

  it('est « partielle » avant l’échéance, avec un acompte', () => {
    expect(statutFacture({ ...FACTURE, reglements: [ACOMPTE] }, AVANT_ECHEANCE)).toBe('partielle')
  })

  it('est « en retard » après l’échéance, acompte ou pas', () => {
    expect(statutFacture(FACTURE, APRES_ECHEANCE)).toBe('en-retard')
    expect(statutFacture({ ...FACTURE, reglements: [ACOMPTE] }, APRES_ECHEANCE)).toBe('en-retard')
  })

  it('est « soldée » même en retard, une fois payée', () => {
    const payee = { ...FACTURE, reglements: [{ ...ACOMPTE, montant: 420_953 }] }
    expect(statutFacture(payee, APRES_ECHEANCE)).toBe('soldee')
  })

  it('a un libellé français pour chaque statut', () => {
    expect(LIBELLE_STATUT['en-retard']).toBe('En retard')
    expect(LIBELLE_MOYEN.momo).toBe('MTN Mobile Money')
  })
})

describe('joursDeRetard — comptés en jours civils de Douala', () => {
  it('est nul avant et le jour de l’échéance', () => {
    expect(joursDeRetard(FACTURE, AVANT_ECHEANCE)).toBe(0)
    expect(joursDeRetard(FACTURE, new Date('2026-09-30T18:00:00.000Z'))).toBe(0)
  })

  it('compte les jours passés', () => {
    expect(joursDeRetard(FACTURE, APRES_ECHEANCE)).toBe(5)
  })

  it('bascule à minuit heure de Douala, pas heure UTC', () => {
    // 30 septembre 23 h 30 UTC = 1ᵉʳ octobre 00 h 30 à Douala : un jour de retard.
    expect(joursDeRetard(FACTURE, new Date('2026-09-30T23:30:00.000Z'))).toBe(1)
  })

  it('refuse une échéance illisible', () => {
    expect(() => dateEcheance({ ...FACTURE, echeance: 'à la Saint-Glinglin' })).toThrow(RangeError)
  })
})

describe('la carte de la facture', () => {
  it('met le reste à payer en gros et le statut en pastille', () => {
    const carte = factureCard(FACTURE, ctx(AVANT_ECHEANCE))
    expect(carte.kicker).toBe('FACTURE')
    expect(carte.title).toBe('Ets Mbarga & Fils')
    expect(carte.sub).toBe('N° FA-2026-0042 · 9 septembre 2026')
    expect(carte.bigLabel).toBe('RESTE À PAYER')
    expect(carte.tag).toBe('À PAYER')
    expect(carte.pct).toBe(0)
  })

  it('affiche une barre qui avance, contrairement au devis', () => {
    const carte = factureCard({ ...FACTURE, reglements: [ACOMPTE] }, ctx(AVANT_ECHEANCE))
    expect(carte.pct).toBeCloseTo(0.5, 1)
    expect(carte.subline).toContain('versé')
    expect(carte.subline).toContain('échéance 30 septembre 2026')
  })

  it('remplace l’échéance par le retard une fois la date passée', () => {
    const carte = factureCard(FACTURE, ctx(APRES_ECHEANCE))
    expect(carte.tag).toBe('EN RETARD')
    expect(carte.subline).toContain('5 jours de retard')
    expect(carte.subline).not.toContain('échéance')
  })

  it('change de discours une fois soldée', () => {
    const payee = { ...FACTURE, reglements: [{ ...ACOMPTE, montant: 420_953 }] }
    const carte = factureCard(payee, ctx(APRES_ECHEANCE))
    expect(carte.tag).toBe('SOLDÉE')
    expect(carte.bigLabel).toBe('FACTURE RÉGLÉE')
    expect(carte.big).toContain('0')
    expect(carte.pct).toBe(1)
  })
})

describe('le partage de la facture', () => {
  it('écrit un résumé complet, conditions de règlement comprises', () => {
    const p = factureShare(FACTURE, ctx(AVANT_ECHEANCE))
    expect(p.txt).toContain('FACTURE N° FA-2026-0042')
    expect(p.txt).toContain('TVA 19,25 %')
    expect(p.txt).toContain('Reste à payer')
    expect(p.txt).toContain('Échéance : 30 septembre 2026')
    expect(p.txt).toContain('MTN Mobile Money')
    expect(p.txt).toContain('atl.cm/f/ZBV3')
  })

  it('mentionne l’acompte reçu quand il y en a un', () => {
    const p = factureShare({ ...FACTURE, reglements: [ACOMPTE] }, ctx(AVANT_ECHEANCE))
    expect(p.txt).toContain('Déjà réglé')
  })

  it('remercie et n’annonce plus d’échéance une fois soldée', () => {
    const payee = { ...FACTURE, reglements: [{ ...ACOMPTE, montant: 420_953 }] }
    const p = factureShare(payee, ctx(AVANT_ECHEANCE))
    expect(p.txt).toContain('Facture soldée')
    expect(p.txt).not.toContain('Échéance')
    expect(p.relances).toEqual([])
    expect(p.relancesVides).toContain('soldée')
  })

  it('prépare une relance au client, et une seule', () => {
    const p = factureShare(FACTURE, ctx(AVANT_ECHEANCE))
    expect(p.relances).toHaveLength(1)
    expect(p.relances[0]?.message).toContain('à régler pour le 30 septembre 2026')
  })

  it('change le temps du verbe une fois l’échéance passée', () => {
    const p = factureShare(FACTURE, ctx(APRES_ECHEANCE))
    expect(p.relances[0]?.message).toContain('était à régler le 30 septembre 2026')
  })

  it('ne menace ni ne culpabilise personne', () => {
    const p = factureShare(FACTURE, ctx(APRES_ECHEANCE))
    expect(p.relances[0]?.message).not.toMatch(/pénalit|poursuit|mise en demeure|honte/i)
  })

  it('avertit, en texte simple, quand une mention obligatoire manque', () => {
    const p = factureShare({ ...FACTURE, emetteur: { ...FACTURE.emetteur, niu: '' } }, ctx(AVANT_ECHEANCE))
    expect(p.warn).toContain('NIU')
    expect(p.warn).toContain('déduire')
    expect(p.warn).not.toContain('<')
  })
})

describe('initialiser', () => {
  it('numérote sur l’année civile et date à l’instant', () => {
    const neuve = facture.initialiser?.({ lien: '', maintenant: new Date('2027-02-03T09:00:00Z') })
    expect(neuve?.numero).toBe(`${PREFIXE_FACTURE}-2027-0001`)
    expect(neuve?.emisLe).toBe('2027-02-03T09:00:00.000Z')
  })

  it('est payable à réception : on n’invente pas un délai de trente jours', () => {
    const neuve = facture.initialiser?.({ lien: '', maintenant: new Date('2027-02-03T09:00:00Z') })
    expect(neuve?.echeance).toBe(neuve?.emisLe)
  })

  it('ne livre pas la raison sociale du prototype comme valeur par défaut', () => {
    expect(facture.defaults.emetteur.niu).toBe('')
    expect(facture.defaults.reglements).toEqual([])
  })
})
