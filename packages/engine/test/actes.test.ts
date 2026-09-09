import { describe, expect, it } from 'vitest'
import { controleDette, totauxRecu } from '../src/compute/actes.js'
import type { EtatDette, EtatRecu } from '../src/compute/actes.js'
import { montantEnLettres } from '../src/lettres.js'
import { attestation, dette, motivation, recu } from '../src/skeletons/actes.js'
import { valider } from '../src/valider.js'

/**
 * Les quatre actes. Ce qu'on vérifie ici n'est pas la mise en page — c'est ce
 * qui rend un papier recevable, et ce qui se passe quand il ne l'est pas.
 */

const CTX = { lien: '', maintenant: new Date('2026-09-09T07:45:00.000Z') }

describe('un acte neuf est vide, et valide', () => {
  it.each([
    ['attestation', attestation],
    ['reçu', recu],
    ['reconnaissance de dette', dette],
    ['lettre de motivation', motivation],
  ] as const)('« %s » : ses valeurs par défaut passent son schéma', (_nom, s) => {
    expect(valider(s.schema, s.defaults)).toEqual([])
  })

  it.each([
    ['attestation', attestation],
    ['reçu', recu],
    ['reconnaissance de dette', dette],
    ['lettre de motivation', motivation],
  ] as const)('« %s » : l’état initialisé passe aussi', (_nom, s) => {
    const neuf = s.initialiser?.(CTX) ?? s.defaults
    expect(valider(s.schema, neuf)).toEqual([])
  })

  it('ne porte le nom de personne', () => {
    // Le prototype est peuplé de Serge Mbarga et de la Quincaillerie Bépanda.
    // Quelqu'un qui ouvre une attestation ne doit pas trouver un inconnu dedans.
    const tout = JSON.stringify([
      attestation.defaults, recu.defaults, dette.defaults, motivation.defaults,
    ])
    for (const nom of ['Mbarga', 'Bépanda', 'Serge', 'Fotso', 'Ngo Bell']) {
      expect(tout).not.toContain(nom)
    }
  })
})

describe('le reçu compte juste', () => {
  const base: EtatRecu = {
    ...recu.defaults,
    lignes: [
      { designation: 'Ensemble pagne', montant: 18_000 },
      { designation: 'Retouche veste', montant: 6_000 },
    ],
    avance: 10_000,
  }

  it('additionne, retire l’avance, et rend le reste', () => {
    expect(totauxRecu(base)).toEqual({ total: 24_000, avance: 10_000, reste: 14_000 })
  })

  it('ne rend jamais un reste négatif', () => {
    // Quelqu'un qui verse plus que dû a un crédit, pas une dette négative.
    // « −5 000 F à payer » sur un papier signé ne s'explique plus.
    expect(totauxRecu({ ...base, avance: 30_000 }).reste).toBe(0)
  })

  it('tient un reçu vide sans se plaindre', () => {
    expect(totauxRecu(recu.defaults)).toEqual({ total: 0, avance: 0, reste: 0 })
  })

  it('écrit la somme reçue en toutes lettres sur le partage', () => {
    const p = recu.share({ ...base, recuDe: 'M. Fotso' }, CTX)
    expect(p.txt).toContain('10 000'.replace(/ /g, ' '))
    expect(p.card.bigLabel).toBe('SOMME REÇUE')
  })
})

describe('la reconnaissance de dette, ce que le brief exige', () => {
  const acte: EtatDette = {
    ...dette.defaults,
    emprunteur: { nom: 'Adèle', piece: 'CNI n° 204 776 331' },
    preteur: { nom: 'Ernest', piece: 'CNI n° 118 442 907' },
    montant: 150_000,
    echeance: '31 décembre 2026',
    lieu: 'Douala',
  }

  it('porte le montant en toutes lettres — § 5 du brief', () => {
    // Un « 1 » devient « 100 000 » d'un trait de stylo après signature ;
    // « cent cinquante mille francs » ne se rallonge pas.
    const p = dette.share(acte, CTX)
    expect(p.txt).toContain(montantEnLettres(150_000))
    expect(p.card.subline).toContain(montantEnLettres(150_000))
  })

  it('exige l’identité des deux parties, un montant, une échéance et un lieu', () => {
    expect(controleDette(acte)).toEqual([])
    expect(controleDette({ ...acte, montant: 0 }).map((m) => m.champ)).toContain('$.montant')
    expect(controleDette({ ...acte, echeance: '' }).map((m) => m.champ)).toContain('$.echeance')
    expect(controleDette({ ...acte, lieu: '' }).map((m) => m.champ)).toContain('$.lieu')
  })

  it('refuse une partie sans pièce d’identité', () => {
    // Sans la pièce, la partie n'est pas identifiée : l'acte ne vaut rien.
    const sansPiece = { ...acte, emprunteur: { nom: 'Adèle', piece: '' } }
    expect(controleDette(sansPiece).map((m) => m.champ)).toContain('$.emprunteur.piece')
  })

  it('signale les manques sur le partage plutôt que de laisser croire que c’est bon', () => {
    expect(dette.share(dette.defaults, CTX).warn).toContain('nom de l’emprunteur')
  })

  it('ne relance personne : un acte se signe, il ne se réclame pas', () => {
    expect(dette.share(acte, CTX).relances).toEqual([])
  })
})

describe('l’attestation et la lettre', () => {
  it('l’attestation ne met pas son corps sur la carte', () => {
    // Ce qu'une attestation certifie regarde son destinataire, pas un groupe.
    const etat = { ...attestation.defaults, texte: 'Nous certifions que…' }
    const carte = attestation.card(etat, CTX)
    expect(carte.items).toEqual([])
    expect(JSON.stringify(carte)).not.toContain('certifions')
  })

  it('l’attestation signale un entête légal absent', () => {
    expect(attestation.share(attestation.defaults, CTX).warn).toContain('NIU')
  })

  it('la lettre dit ce qui lui manque pour être envoyée', () => {
    const w = motivation.share(motivation.defaults, CTX).warn
    expect(w).toContain('ton nom')
    expect(w).toContain('le corps de la lettre')
  })
})
