import { attestation, dette, motivation, recu } from '@a237/engine'
import type { EtatDette, EtatRecu } from '@a237/engine'
import { describe, expect, it } from 'vitest'
import { render as enChaine } from 'preact-render-to-string'
import {
  DocumentAttestation, DocumentDette, DocumentMotivation, DocumentRecu,
} from '../src/doc/actes.js'

/**
 * Ce qui doit se retrouver sur le papier. Pas la mise en page — ce qu'un
 * contrôleur, un recruteur ou un juge y cherche.
 */

describe('la reconnaissance de dette', () => {
  const acte: EtatDette = {
    ...dette.defaults,
    emprunteur: { nom: 'Adèle Ngo Bell', piece: 'CNI n° 204 776 331' },
    preteur: { nom: 'Ernest Fotso', piece: 'CNI n° 118 442 907' },
    montant: 150_000,
    echeance: '31 décembre 2026',
    lieu: 'Douala',
  }
  const html = enChaine(<DocumentDette etat={acte} />)

  it('porte « Lu et approuvé » — § 5 du brief', () => {
    expect(html).toContain('Lu et approuvé')
  })

  it('porte le montant en chiffres ET en toutes lettres', () => {
    expect(html).toContain('150')
    expect(html).toContain('cent cinquante mille')
  })

  it('nomme les deux parties avec leur pièce', () => {
    expect(html).toContain('Adèle Ngo Bell')
    expect(html).toContain('CNI n° 204 776 331')
    expect(html).toContain('Ernest Fotso')
  })

  it('dit qu’il est fait en deux exemplaires, et où', () => {
    expect(html).toContain('deux exemplaires')
    expect(html).toContain('Douala')
  })

  it('n’imprime ni deux-points ni « à » dans le vide quand rien n’est saisi', () => {
    // Un acte vierge sortait « Échéance de remboursement : » suivi de rien, et
    // « Fait à  le 9 septembre ». Ce qui manque se dit dans l'encart de
    // l'écran ; le papier, lui, se signe tel qu'il s'imprime.
    const vierge = enChaine(<DocumentDette etat={dette.defaults} />)
    expect(vierge).not.toContain('Échéance de remboursement')
    expect(vierge).not.toMatch(/Fait à\s+le/)
    expect(vierge).toContain('Fait le')
    // Renseignés, les deux reviennent.
    expect(html).toContain('Échéance de remboursement')
    expect(html).toContain('Fait à Douala le')
  })

  it('ne porte aucun entête d’entreprise', () => {
    // Un RCCM sur un acte entre deux personnes serait une faute de registre.
    expect(html).not.toContain('RCCM')
    expect(html).not.toContain('a4-entete')
  })
})

describe('le reçu', () => {
  const etat: EtatRecu = {
    ...recu.defaults,
    emetteur: { ...recu.defaults.emetteur, nom: 'Atelier Couture Akwa', niu: 'M022114873829Y' },
    recuDe: 'M. Fotso',
    lignes: [
      { designation: 'Ensemble pagne', montant: 18_000 },
      { designation: 'Retouche veste', montant: 6_000 },
    ],
    avance: 10_000,
  }
  const html = enChaine(<DocumentRecu etat={etat} />)

  it('n’imprime pas une ligne ajoutée puis laissée vide', () => {
    // Même défaut que sur le devis : une rangée « ​ 0 » sans désignation, sur
    // le reçu qu'on remet au client. La retirer ne change aucun total.
    const vide = { designation: '', montant: 0 }
    expect(enChaine(<DocumentRecu etat={{ ...etat, lignes: [...etat.lignes, vide] }} />)).toBe(html)
  })

  it('mais bien un poste offert, qui porte un nom', () => {
    const offert = { designation: 'Retouche offerte', montant: 0 }
    expect(enChaine(<DocumentRecu etat={{ ...etat, lignes: [...etat.lignes, offert] }} />))
      .toContain('Retouche offerte')
  })

  it('montre le total, la somme reçue et le reste', () => {
    expect(html).toContain('Total')
    expect(html).toContain('Somme reçue ce jour')
    expect(html).toContain('Reste à payer')
  })

  it('écrit la somme reçue en toutes lettres', () => {
    expect(html).toContain('dix mille')
  })

  it('dit qu’il ne remplace pas la facture', () => {
    // Le reçu atteste d'un paiement reçu ; la facture réclame un paiement dû.
    // Les confondre coûte cher au moment d'un contrôle.
    expect(html).toContain('ne remplace pas la facture')
  })

  it('ne porte aucune TVA : elle a été traitée sur la facture', () => {
    expect(html).not.toContain('19,25')
    expect(html).not.toContain('TVA')
  })

  it('n’accorde jamais un participe avec le montant', () => {
    // « Soit zéro franc CFA reçus ce jour » : le participe suivait le nombre
    // et se trompait à 0 comme à 1. La tournure nominale ne s'accorde avec
    // rien. Un reçu neuf, montant zéro, est le cas où ça se voyait.
    const neuf = enChaine(<DocumentRecu etat={recu.defaults} />)
    expect(neuf).toContain('zéro franc CFA')
    expect(neuf).not.toContain('reçus')
    expect(enChaine(<DocumentRecu etat={{ ...recu.defaults, avance: 1 }} />))
      .not.toContain('reçus')
  })
})

describe('l’attestation', () => {
  it('porte l’entête légal, son objet et son corps', () => {
    const html = enChaine(
      <DocumentAttestation
        etat={{
          ...attestation.defaults,
          emetteur: { ...attestation.defaults.emetteur, nom: 'Quincaillerie du Nord', rccm: 'RC/DLA/2022/A/1487' },
          texte: 'Nous certifions que l’intéressé a été employé du 3 janvier 2022 au 31 août 2026.',
        }}
      />,
    )
    expect(html).toContain('Quincaillerie du Nord')
    expect(html).toContain('RCCM')
    expect(html).toContain('Attestation de travail')
    expect(html).toContain('3 janvier 2022')
  })

  it('dit que le corps reste à écrire plutôt que d’imprimer du vide', () => {
    expect(enChaine(<DocumentAttestation etat={attestation.defaults} />))
      .toContain('reste à écrire')
  })
})

describe('la lettre de motivation', () => {
  const html = enChaine(
    <DocumentMotivation
      etat={{
        ...motivation.defaults,
        expediteur: { nom: 'Adèle Ngo Bell', tel: '699 44 55 66', mail: 'a@mail.cm', ville: 'Douala' },
        destinataire: 'À l’attention du Responsable RH\nSociété de Distribution\nBP 1284, Douala',
        objet: 'Objet : candidature au poste de magasinier',
        corps: 'Madame, Monsieur,\n\nVotre annonce a retenu mon attention.\n\nVeuillez agréer mes salutations.',
      }}
    />,
  )

  it('dispose l’expéditeur, le destinataire, le lieu et la date', () => {
    expect(html).toContain('Adèle Ngo Bell')
    expect(html).toContain('Responsable RH')
    expect(html).toContain('Douala, le')
  })

  it('découpe le corps en paragraphes, sans jamais injecter de HTML', () => {
    expect(html).toContain('Madame, Monsieur,')
    expect(html).toContain('Veuillez agréer')
    // Trois paragraphes séparés par des lignes vides.
    expect((html.match(/<p>/g) ?? []).length).toBe(3)
  })

  it('ne porte aucun entête d’entreprise', () => {
    expect(html).not.toContain('RCCM')
  })
})
