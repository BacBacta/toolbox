import { describe, expect, it } from 'vitest'
import { chiffrer, controleLegal, dateEmission } from '../src/compute/devis.js'
import type { EtatDevis } from '../src/compute/devis.js'
import { devis, devisCard, devisShare, PREFIXE_DEVIS } from '../src/skeletons/devis.js'
import type { RenderContext } from '../src/types.js'

const DEVIS: EtatDevis = {
  nom: 'Devis — Ets Mbarga & Fils',
  encre: 'encre',
  numero: 'DV-2026-0118',
  emisLe: '2026-09-09T07:45:00.000Z',
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
  validite: '15 jours',
  acompte: 50,
  lignes: [
    { designation: 'Fourniture de tôles bac 30/100', quantite: 24, prixUnitaire: 12_500 },
    { designation: 'Pointes et accessoires de pose', quantite: 1, prixUnitaire: 38_000 },
    { designation: 'Livraison sur chantier Akwa', quantite: 1, prixUnitaire: 15_000 },
  ],
}

const CTX: RenderContext = {
  lien: 'atl.cm/d/ZBV3',
  maintenant: new Date('2026-09-09T07:45:00.000Z'),
}

describe('chiffrer', () => {
  const c = chiffrer(DEVIS)

  it('donne les totaux du devis du prototype', () => {
    expect(c.totalHT).toBe(353_000)
    expect(c.totalTVA).toBe(67_953)
    expect(c.totalTTC).toBe(420_953)
  })

  it('découpe l’acompte et le solde', () => {
    expect(c.acompteDu).toBe(210_477)
    expect(c.soldeDu).toBe(210_476)
    expect(c.acompteDu + c.soldeDu).toBe(c.totalTTC)
  })

  it('tient sur un devis sans ligne', () => {
    const c0 = chiffrer({ ...DEVIS, lignes: [] })
    expect(c0).toMatchObject({ totalTTC: 0, acompteDu: 0, soldeDu: 0 })
  })
})

describe('dateEmission', () => {
  it('est figée dans l’état, pas prise à l’horloge', () => {
    expect(dateEmission(DEVIS).toISOString()).toBe('2026-09-09T07:45:00.000Z')
  })

  it('refuse une date illisible', () => {
    expect(() => dateEmission({ ...DEVIS, emisLe: 'la semaine dernière' })).toThrow(RangeError)
  })
})

describe('controleLegal', () => {
  it('ne trouve rien à redire à un devis complet', () => {
    expect(controleLegal(DEVIS)).toEqual([])
  })

  it('bloque un client entreprise sans NIU', () => {
    const m = controleLegal({ ...DEVIS, client: { ...DEVIS.client, niu: '' } })
    expect(m.map((x) => x.champ)).toContain('client.niu')
  })
})

describe('la carte du devis', () => {
  const carte = devisCard(DEVIS, CTX)

  it('met le client en titre et le TTC en gros', () => {
    expect(carte.kicker).toBe('DEVIS')
    expect(carte.title).toBe('Ets Mbarga & Fils')
    expect(carte.bigLabel).toBe('TOTAL TTC')
    expect(carte.big).toContain('420')
  })

  it('n’affiche pas de barre de progression : un devis n’avance pas', () => {
    expect(carte.pct).toBeNull()
  })

  it('rappelle le HT, la TVA et la validité', () => {
    expect(carte.subline).toContain('TVA 19,25 %')
    expect(carte.subline).toContain('15 jours')
  })

  it('liste une entrée par ligne, avec la quantité quand elle dépasse 1', () => {
    expect(carte.items).toHaveLength(3)
    expect(carte.items[0]?.n).toContain('× 24')
    expect(carte.items[1]?.n).toBe('Pointes et accessoires de pose')
  })

  it('porte le lien et l’horodatage passés en contexte, pas l’horloge', () => {
    expect(carte.link).toBe('atl.cm/d/ZBV3')
    expect(carte.stamp).toBe('Arrêté le 9 septembre 2026 à 08h45')
  })

  it('retombe sur le nom de l’outil quand le client n’est pas renseigné', () => {
    expect(devisCard({ ...DEVIS, client: { ...DEVIS.client, nom: '' } }, CTX).title).toBe(DEVIS.nom)
  })
})

describe('le partage du devis', () => {
  const partage = devisShare(DEVIS, CTX)

  it('écrit un résumé collable dans une discussion', () => {
    expect(partage.txt).toContain('DEVIS N° DV-2026-0118')
    expect(partage.txt).toContain('Client : Ets Mbarga & Fils')
    expect(partage.txt).toContain('TVA 19,25 %')
    expect(partage.txt).toContain('Acompte à la commande : 50 %')
    expect(partage.txt).toContain('atl.cm/d/ZBV3')
  })

  it('omet la ligne d’acompte quand il n’y en a pas', () => {
    expect(devisShare({ ...DEVIS, acompte: 0 }, CTX).txt).not.toContain('Acompte')
  })

  it('n’avertit de rien quand le document est complet', () => {
    expect(partage.warn).toBeNull()
  })

  it('avertit, en texte simple, quand une mention obligatoire manque', () => {
    const p = devisShare({ ...DEVIS, emetteur: { ...DEVIS.emetteur, niu: '' } }, CTX)
    expect(p.warn).toContain('NIU')
    expect(p.warn).not.toContain('<')
  })

  it('prépare une relance pour le client, et une seule', () => {
    expect(partage.relances).toHaveLength(1)
    expect(partage.relances[0]?.nom).toBe('Ets Mbarga & Fils')
    expect(partage.relances[0]?.message).toContain('atl.cm/d/ZBV3')
  })

  it('rend tel à null quand on n’a pas le numéro du client', () => {
    expect(partage.relances[0]?.tel).toBeNull()
  })

  it('reprend le numéro du client quand on l’a', () => {
    const p = devisShare({ ...DEVIS, client: { ...DEVIS.client, tel: '699412708' } }, CTX)
    expect(p.relances[0]?.tel).toBe('699412708')
  })

  it('ne propose personne quand le client n’est pas renseigné', () => {
    const p = devisShare({ ...DEVIS, client: { ...DEVIS.client, nom: '' } }, CTX)
    expect(p.relances).toEqual([])
    expect(p.relancesVides).toContain('client')
  })
})

describe('initialiser — le numéro et la date ne sont pas figés dans defaults', () => {
  it('numérote sur l’année civile de Douala et date à l’instant', () => {
    const neuf = devis.initialiser?.({ lien: '', maintenant: new Date('2027-01-01T00:30:00Z') })
    expect(neuf?.numero).toBe('DV-2027-0001')
    expect(neuf?.emisLe).toBe('2027-01-01T00:30:00.000Z')
  })

  it('bascule d’année au réveillon, heure de Douala', () => {
    // 31 décembre 23 h 30 UTC = 1ᵉʳ janvier 00 h 30 à Douala.
    const neuf = devis.initialiser?.({ lien: '', maintenant: new Date('2026-12-31T23:30:00Z') })
    expect(neuf?.numero).toBe(`${PREFIXE_DEVIS}-2027-0001`)
  })

  it('ne livre pas la raison sociale du prototype comme valeur par défaut', () => {
    expect(devis.defaults.emetteur.nom).toBe('')
    expect(devis.defaults.emetteur.niu).toBe('')
  })
})

describe('sans publication, pas de lien mort', () => {
  const SANS_LIEN: RenderContext = { lien: '', maintenant: CTX.maintenant }

  it('le devis ne renvoie nulle part', () => {
    const p = devisShare(DEVIS, SANS_LIEN)
    expect(p.txt).not.toContain('atl.cm')
    expect(p.relances[0]?.message.endsWith('valable 15 jours.')).toBe(true)
  })
})
