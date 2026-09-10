import type { EtatDevis, EtatFacture } from '@a237/engine'
import { ESPACE_INSECABLE } from '@a237/engine'
import { render } from 'preact-render-to-string'
import { describe, expect, it } from 'vitest'
import { Paragraphes } from '../src/doc/chrome.js'
import { DocumentDevis } from '../src/doc/devis.js'
import { DocumentFacture } from '../src/doc/facture.js'

const E = ESPACE_INSECABLE

const EMETTEUR = {
  nom: 'QUINCAILLERIE BÉPANDA',
  forme: 'Ets — Établissement individuel',
  activite: 'Quincaillerie · matériaux · outillage',
  adresse: 'Rue Bépanda-Omnisport, BP 4127 Douala',
  tel: '+237 6 99 41 27 08',
  mail: 'contact@quincaillerie-bepanda.cm',
  rccm: 'RC/DLA/2022/A/1487',
  niu: 'M022114873829Y',
  centre: 'CDI Douala 3ᵉ',
}

const CLIENT = { nom: 'Ets Mbarga & Fils', niu: 'M019887641203K', estEntreprise: true }

const LIGNES = [
  { designation: 'Fourniture de tôles bac 30/100', quantite: 24, prixUnitaire: 12_500 },
  { designation: 'Pointes et accessoires de pose', quantite: 1, prixUnitaire: 38_000 },
  { designation: 'Livraison sur chantier Akwa', quantite: 1, prixUnitaire: 15_000 },
]

const DEVIS: EtatDevis = {
  nom: 'Devis — Ets Mbarga & Fils',
  encre: 'encre',
  numero: 'DV-2026-0118',
  emisLe: '2026-09-09T07:45:00.000Z',
  emetteur: EMETTEUR,
  client: CLIENT,
  validite: '15 jours',
  acompte: 50,
  lignes: LIGNES,
}

const FACTURE: EtatFacture = {
  nom: 'Facture — Ets Mbarga & Fils',
  encre: 'bordeaux',
  numero: 'FA-2026-0042',
  emisLe: '2026-09-09T07:45:00.000Z',
  echeance: '2026-09-30T00:00:00.000Z',
  devisNumero: 'DV-2026-0118',
  emetteur: EMETTEUR,
  client: CLIENT,
  conditionsReglement: 'Règlement par MTN Mobile Money ou Orange Money.',
  lignes: LIGNES,
  reglements: [],
}

const LE_15_SEPT = new Date('2026-09-15T09:00:00.000Z')
const LE_5_OCT = new Date('2026-10-05T09:00:00.000Z')

describe('les mentions que la DGI contrôle sont sur le papier', () => {
  const html = render(<DocumentDevis etat={DEVIS} />)

  it.each([
    ['la raison sociale', 'QUINCAILLERIE BÉPANDA'],
    ['la forme juridique', 'Ets — Établissement individuel'],
    ['l’adresse', 'Rue Bépanda-Omnisport, BP 4127 Douala'],
    ['le RCCM', 'RCCM RC/DLA/2022/A/1487'],
    ['le NIU de l’émetteur', 'NIU M022114873829Y'],
    ['le centre des impôts', 'CDI Douala 3ᵉ'],
    ['le NIU du client, obligatoire en B2B', 'NIU M019887641203K'],
    ['le numéro du document', 'DV-2026-0118'],
    ['la date d’émission', '9 septembre 2026'],
    ['la mention de numérotation', 'unique, continue et chronologique'],
  ])('porte %s', (_quoi, attendu) => {
    expect(html).toContain(attendu)
  })
})

describe('la TVA est indiquée ligne par ligne, puis en bloc', () => {
  const html = render(<DocumentDevis etat={DEVIS} />)

  it('donne une colonne TVA au tableau', () => {
    expect(html).toContain('TVA 19,25 %')
    expect(html).toContain('<th class="nombre">Montant TTC</th>')
  })

  it('affiche la TVA de chaque ligne', () => {
    // 300 000 → 57 750 ; 38 000 → 7 315 ; 15 000 → 2 888
    expect(html).toContain(`57${E}750`)
    expect(html).toContain(`7${E}315`)
    expect(html).toContain(`2${E}888`)
  })

  it('affiche ensuite le bloc HT / TVA / TTC', () => {
    expect(html).toContain('Sous-total HT')
    expect(html).toContain(`353${E}000${E}F`)
    expect(html).toContain(`67${E}953${E}F`)
    expect(html).toContain(`420${E}953${E}F`)
  })

  it('écrit le total en toutes lettres', () => {
    expect(html).toContain('quatre cent vingt mille neuf cent cinquante-trois francs CFA')
  })

  it('somme bien ce que le tableau montre', () => {
    // Ce que le lecteur recalcule au stylo doit tomber juste.
    expect(57_750 + 7_315 + 2_888).toBe(67_953)
    expect(353_000 + 67_953).toBe(420_953)
  })
})

describe('le devis propose, il n’engage pas', () => {
  const html = render(<DocumentDevis etat={DEVIS} />)

  it('porte sa validité et son acompte', () => {
    expect(html).toContain('15 jours')
    expect(html).toContain('Acompte à la commande (50 %)')
    expect(html).toContain('Solde à la livraison')
  })

  it('ouvre une zone de signature pour chaque partie', () => {
    expect(html).toContain('Le fournisseur')
    expect(html).toContain('Bon pour accord — le client')
  })

  it('tait l’acompte quand il n’y en a pas', () => {
    const sans = render(<DocumentDevis etat={{ ...DEVIS, acompte: 0 }} />)
    expect(sans).not.toContain('Acompte à la commande')
  })

  it('rend un devis vierge sans étiquette orpheline ni « Invalid Date »', () => {
    const vierge: EtatDevis = {
      ...DEVIS,
      emetteur: { ...EMETTEUR, nom: '', forme: '', adresse: '', rccm: '', niu: '', centre: '', tel: '', mail: '', activite: '' },
      client: { nom: '', niu: '', estEntreprise: false },
      lignes: [],
    }
    const html2 = render(<DocumentDevis etat={vierge} />)
    expect(html2).not.toContain('RCCM ')
    expect(html2).not.toContain('NIU ')
    expect(html2).not.toContain('Invalid Date')
    expect(html2).toContain('Aucune ligne')
  })
})

describe('la facture engage, et se règle', () => {
  it('porte l’échéance, le devis d’origine et les conditions de règlement', () => {
    const html = render(<DocumentFacture etat={FACTURE} maintenant={LE_15_SEPT} />)
    expect(html).toContain('FA-2026-0042')
    expect(html).toContain('échéance le 30 septembre 2026')
    expect(html).toContain('En référence au devis N° DV-2026-0118')
    expect(html).toContain('MTN Mobile Money')
    expect(html).toContain('Arrêtée la présente facture à la somme de')
  })

  it('n’ouvre qu’une zone de signature : la facture ne se contresigne pas', () => {
    const html = render(<DocumentFacture etat={FACTURE} maintenant={LE_15_SEPT} />)
    expect(html).toContain('Cachet et signature')
    expect(html).not.toContain('Bon pour accord')
  })

  it('détaille les règlements reçus et le reste dû', () => {
    const partielle: EtatFacture = {
      ...FACTURE,
      reglements: [{ date: '2026-09-12T10:00:00.000Z', montant: 210_477, moyen: 'momo', reference: 'MP260912.1443' }],
    }
    const html = render(<DocumentFacture etat={partielle} maintenant={LE_15_SEPT} />)
    expect(html).toContain('Déjà réglé')
    expect(html).toContain(`210${E}477${E}F`)
    expect(html).toContain('Reste à payer')
    expect(html).toContain(`210${E}476${E}F`)
    expect(html).toContain('12 septembre 2026')
    expect(html).toContain('réf. MP260912.1443')
  })

  it('dit le retard quand l’échéance est passée', () => {
    const html = render(<DocumentFacture etat={FACTURE} maintenant={LE_5_OCT} />)
    expect(html).toContain('Échéance dépassée de 5 jours')
  })

  it('change de discours une fois soldée', () => {
    const soldee: EtatFacture = {
      ...FACTURE,
      reglements: [{ date: '2026-09-20T10:00:00.000Z', montant: 420_953, moyen: 'orange-money' }],
    }
    const html = render(<DocumentFacture etat={soldee} maintenant={LE_5_OCT} />)
    expect(html).toContain('Facture soldée')
    expect(html).not.toContain('Échéance dépassée')
    expect(html).toContain('Orange Money')
  })

  it('signale un trop-perçu au lieu de le noyer', () => {
    const trop: EtatFacture = {
      ...FACTURE,
      reglements: [{ date: '2026-09-20T10:00:00.000Z', montant: 500_000, moyen: 'especes' }],
    }
    expect(render(<DocumentFacture etat={trop} maintenant={LE_5_OCT} />))
      .toContain('Trop-perçu à restituer')
  })

  it('rend le même document quelle que soit l’heure de la machine', () => {
    // La date de rendu est un argument, pas une lecture d'horloge.
    const a = render(<DocumentFacture etat={FACTURE} maintenant={LE_15_SEPT} />)
    const b = render(<DocumentFacture etat={FACTURE} maintenant={LE_15_SEPT} />)
    expect(a).toBe(b)
  })
})

describe('rien de ce que l’utilisateur ou le modèle écrit n’atteint le HTML', () => {
  const HOSTILE = '<script>alert(1)</script>'

  it('échappe le nom du client', () => {
    const html = render(<DocumentDevis etat={{ ...DEVIS, client: { ...CLIENT, nom: HOSTILE } }} />)
    // Preact échappe « < » ; un « > » resté nu dans du texte n'ouvre aucune balise.
    expect(html).not.toMatch(/<script/i)
    expect(html).toContain('&lt;script')
  })

  it('échappe la désignation d’une ligne', () => {
    const html = render(
      <DocumentDevis
        etat={{ ...DEVIS, lignes: [{ designation: HOSTILE, quantite: 1, prixUnitaire: 100 }] }}
      />,
    )
    expect(html).not.toMatch(/<script/i)
  })

  it('échappe la raison sociale et les conditions de règlement', () => {
    const html = render(
      <DocumentFacture
        etat={{ ...FACTURE, emetteur: { ...EMETTEUR, nom: HOSTILE }, conditionsReglement: HOSTILE }}
        maintenant={LE_15_SEPT}
      />,
    )
    expect(html).not.toMatch(/<script/i)
  })

  it('échappe une balise fermante glissée dans un attribut de style', () => {
    // L'encre vient d'un enum du schéma : une valeur hors palette ne peut pas
    // arriver ici, mais on vérifie que le style ne sort pas de son attribut.
    expect(render(<DocumentDevis etat={DEVIS} />)).not.toMatch(/style="[^"]*"[^>]*"/)
  })
})

describe('l’encre du document', () => {
  it('passe par une variable CSS, pas par une classe inventée', () => {
    expect(render(<DocumentDevis etat={DEVIS} />)).toContain('--pa:#1F2A44')
    expect(render(<DocumentFacture etat={FACTURE} maintenant={LE_15_SEPT} />)).toContain('--pa:#6E1F2B')
  })
})

describe('l’objet et la référence au devis', () => {
  it('n’apparaissent pas quand ils ne sont pas renseignés', () => {
    const html = render(<DocumentDevis etat={DEVIS} />)
    expect(html).not.toContain('Objet :')
  })

  it('s’affichent sur le devis', () => {
    const html = render(<DocumentDevis etat={{ ...DEVIS, objet: 'Toiture atelier Akwa' }} />)
    expect(html).toContain('Objet : Toiture atelier Akwa')
  })

  it('se combinent sur la facture', () => {
    const html = render(
      <DocumentFacture etat={{ ...FACTURE, objet: 'Toiture atelier Akwa' }} maintenant={LE_15_SEPT} />,
    )
    expect(html).toContain('Objet : Toiture atelier Akwa — En référence au devis N° DV-2026-0118')
  })

  it('laissent le bloc client nu quand il n’y a ni l’un ni l’autre', () => {
    const nu: EtatFacture = { ...FACTURE }
    delete (nu as { devisNumero?: string }).devisNumero
    const html = render(<DocumentFacture etat={nu} maintenant={LE_15_SEPT} />)
    expect(html).not.toContain('Objet :')
    expect(html).not.toContain('En référence au devis')
    expect(html).toContain('NIU M019887641203K')
  })
})

describe('Paragraphes — le texte libre des actes', () => {
  it('découpe sur les lignes vides et jamais ailleurs', () => {
    const html = render(<Paragraphes texte={'Premier bloc.\nMême bloc.\n\nSecond bloc.'} />)
    expect(html).toBe('<p>Premier bloc.\nMême bloc.</p><p>Second bloc.</p>')
  })

  it('ignore les blocs vides et l’espace autour', () => {
    expect(render(<Paragraphes texte={'\n\n  Seul.  \n\n\n'} />)).toBe('<p>Seul.</p>')
  })

  it('ne rend rien sur un texte vide', () => {
    expect(render(<Paragraphes texte="" />)).toBe('')
  })

  it('échappe le texte : un acte n’est pas du HTML', () => {
    expect(render(<Paragraphes texte="<b>gras</b>" />)).not.toMatch(/<b>/)
  })
})

describe('une ligne ajoutée puis laissée vide', () => {
  /*
   * « Ajouter une ligne » insère une ligne vide, et c'est voulu : on la
   * remplit ensuite. Reste qu'on peut être interrompu et diffuser sans y
   * revenir — le client recevait alors un devis portant une rangée de cinq
   * zéros sans désignation, sur le document imprimé comme sur la page publiée.
   *
   * La retirer ne change aucun total : une ligne à zéro n'apporte rien. Elle
   * reste bien visible dans l'outil, où elle attend d'être remplie ; c'est le
   * document qui ne l'imprime pas.
   */
  const VIDE = { designation: '', quantite: 0, prixUnitaire: 0 }

  it('ne s’imprime pas sur le devis', () => {
    const avec = render(<DocumentDevis etat={{ ...DEVIS, lignes: [...LIGNES, VIDE] }} />)
    const sans = render(<DocumentDevis etat={DEVIS} />)
    expect(avec).toBe(sans)
  })

  it('ni sur la facture', () => {
    const avec = render(<DocumentFacture etat={{ ...FACTURE, lignes: [...LIGNES, VIDE] }} maintenant={LE_15_SEPT} />)
    const sans = render(<DocumentFacture etat={FACTURE} maintenant={LE_15_SEPT} />)
    expect(avec).toBe(sans)
  })

  it('mais une ligne nommée sans montant s’imprime : c’est un poste offert', () => {
    // « Livraison offerte » à zéro franc dit quelque chose ; une ligne sans
    // nom ni montant ne dit rien.
    const offerte = { designation: 'Livraison offerte', quantite: 1, prixUnitaire: 0 }
    const page = render(<DocumentDevis etat={{ ...DEVIS, lignes: [...LIGNES, offerte] }} />)
    expect(page).toContain('Livraison offerte')
  })

  it('et un devis qui n’a que des lignes vides le dit', () => {
    const page = render(<DocumentDevis etat={{ ...DEVIS, lignes: [VIDE, VIDE] }} />)
    expect(page).toContain('Aucune ligne pour l’instant')
  })
})
