import { describe, expect, it } from 'vitest'
import {
  beneficiaireDuTour, classementFiabilite, collecte, fiabilite, prochainTour,
} from '../src/compute/njangi.js'
import type { EtatNjangi, MembreNjangi } from '../src/compute/njangi.js'

function membre(nom: string, p: Partial<MembreNjangi> = {}): MembreNjangi {
  return {
    nom, aVerse: false, aRecu: false, estAuTour: false,
    versements: 0, tours: 0, ...p,
  }
}

/** Le carnet du prototype : six membres, 5 000 F, semaine 36. */
const CARNET: EtatNjangi = {
  nom: 'Njangi Nkolbisson',
  cotisation: 5_000,
  periode: 'semaine',
  tour: 36,
  historique: [
    { tour: 33, collecte: 30_000 },
    { tour: 34, collecte: 25_000 },
    { tour: 35, collecte: 30_000 },
  ],
  membres: [
    membre('Mama Céline', { aVerse: true, aRecu: true, versements: 12, tours: 12 }),
    membre('Ernest', { aVerse: true, estAuTour: true, versements: 11, tours: 12 }),
    membre('Adèle', { versements: 7, tours: 12 }),
    membre('Jean-Marie', { aVerse: true, versements: 12, tours: 12 }),
    membre('Pauline', { aVerse: true, aRecu: true, versements: 10, tours: 12 }),
    membre('Serge', { versements: 9, tours: 12 }),
  ],
}

describe('collecte', () => {
  const c = collecte(CARNET)

  it('compte ce qui est attendu et ce qui est rentré', () => {
    expect(c.attendu).toBe(30_000)
    expect(c.collecte).toBe(20_000)
    expect(c.reste).toBe(10_000)
    expect(c.nbVerse).toBe(4)
    expect(c.nbMembres).toBe(6)
    expect(c.taux).toBeCloseTo(4 / 6, 10)
  })

  it('nomme les retardataires', () => {
    expect(c.retardataires.map((m) => m.nom)).toEqual(['Adèle', 'Serge'])
  })

  it('ne divise pas par zéro sur un njangi vide', () => {
    const vide = { ...CARNET, membres: [] }
    expect(collecte(vide)).toMatchObject({ attendu: 0, collecte: 0, taux: 0, nbMembres: 0 })
  })

  it('atteint 1 quand tout le monde a versé', () => {
    const tous = { ...CARNET, membres: CARNET.membres.map((m) => ({ ...m, aVerse: true })) }
    expect(collecte(tous).taux).toBe(1)
    expect(collecte(tous).retardataires).toEqual([])
  })
})

describe('fiabilité', () => {
  it('rapporte les versements aux tours vécus', () => {
    expect(fiabilite(membre('x', { versements: 7, tours: 12 }))).toBeCloseTo(7 / 12, 10)
    expect(fiabilite(membre('x', { versements: 12, tours: 12 }))).toBe(1)
  })

  it('n’invente pas de réputation à un nouveau', () => {
    expect(fiabilite(membre('nouvelle'))).toBeNull()
  })

  it('classe du moins fiable au plus fiable, les nouveaux en dernier', () => {
    const etat = {
      ...CARNET,
      membres: [...CARNET.membres, membre('Nouvelle')],
    }
    expect(classementFiabilite(etat).map((m) => m.nom)).toEqual([
      'Adèle', 'Serge', 'Pauline', 'Ernest', 'Mama Céline', 'Jean-Marie', 'Nouvelle',
    ])
  })
})

describe('bénéficiaire du tour', () => {
  it('est celui qui porte le drapeau', () => {
    expect(beneficiaireDuTour(CARNET)?.nom).toBe('Ernest')
  })

  it('est null quand personne ne le porte', () => {
    const sans = { ...CARNET, membres: CARNET.membres.map((m) => ({ ...m, estAuTour: false })) }
    expect(beneficiaireDuTour(sans)).toBeNull()
  })
})

describe('prochainTour — ce que le prototype ne faisait pas', () => {
  const suivant = prochainTour(CARNET)

  it('archive la collecte du tour clos', () => {
    expect(suivant.historique).toHaveLength(4)
    expect(suivant.historique[3]).toEqual({ tour: 36, collecte: 20_000 })
  })

  it('remet les versements à zéro — sinon tout le monde reste marqué « a versé »', () => {
    expect(suivant.membres.every((m) => !m.aVerse)).toBe(true)
  })

  it('fait avancer la fiabilité : un tour vécu pour tous, un versement pour ceux qui ont payé', () => {
    const parNom = new Map(suivant.membres.map((m) => [m.nom, m]))
    expect(parNom.get('Jean-Marie')).toMatchObject({ versements: 13, tours: 13 })
    expect(parNom.get('Adèle')).toMatchObject({ versements: 7, tours: 13 })
  })

  it('marque le sortant comme ayant reçu, et passe la main au suivant qui n’a pas reçu', () => {
    const parNom = new Map(suivant.membres.map((m) => [m.nom, m]))
    expect(parNom.get('Ernest')).toMatchObject({ aRecu: true, estAuTour: false })
    expect(beneficiaireDuTour(suivant)?.nom).toBe('Adèle')
  })

  it('incrémente le numéro de tour', () => {
    expect(suivant.tour).toBe(37)
  })

  it('ne modifie pas l’état qu’on lui passe', () => {
    expect(CARNET.tour).toBe(36)
    expect(CARNET.membres[1]?.estAuTour).toBe(true)
    expect(CARNET.historique).toHaveLength(3)
  })
})

describe('prochainTour — la fin d’un cycle', () => {
  it('rouvre un cycle quand tout le monde a reçu, et rend la main au premier', () => {
    const dernierTour: EtatNjangi = {
      ...CARNET,
      membres: [
        membre('A', { aRecu: true, aVerse: true }),
        membre('B', { aRecu: true, aVerse: true }),
        membre('C', { aRecu: false, aVerse: true, estAuTour: true }),
      ],
    }
    const neuf = prochainTour(dernierTour)
    expect(neuf.membres.every((m) => !m.aRecu)).toBe(true)
    expect(beneficiaireDuTour(neuf)?.nom).toBe('A')
  })

  it('boucle sur le début de liste quand le sortant est le dernier', () => {
    const etat: EtatNjangi = {
      ...CARNET,
      membres: [
        membre('A', { aRecu: false }),
        membre('B', { aRecu: true, estAuTour: true }),
      ],
    }
    expect(beneficiaireDuTour(prochainTour(etat))?.nom).toBe('A')
  })

  it('démarre au premier qui n’a pas reçu quand personne ne porte le drapeau', () => {
    const etat = { ...CARNET, membres: [membre('A'), membre('B')] }
    expect(beneficiaireDuTour(prochainTour(etat))?.nom).toBe('A')
  })

  it('saute ceux qui ont déjà reçu quand le drapeau est perdu', () => {
    const etat = { ...CARNET, membres: [membre('A', { aRecu: true }), membre('B')] }
    expect(beneficiaireDuTour(prochainTour(etat))?.nom).toBe('B')
  })

  it('refuse de faire tourner un njangi sans membre', () => {
    expect(() => prochainTour({ ...CARNET, membres: [] })).toThrow(RangeError)
  })
})
