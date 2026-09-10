import { describe, expect, it } from 'vitest'
import {
  MAX_LIGNES_SECTION, MAX_SECTIONS, avecSommaire, carteDePage, partageDePage, sectionsAncrees,
  verifierPage,
} from '../src/page.js'
import type { PageDemande } from '../src/page.js'

/**
 * Le contrat de la page, qui est la frontière.
 *
 * Rien de ce que le modèle a dit n'atteint l'écran sans passer ici. Une page
 * composée ne peut pas contenir de script, non parce qu'on le filtre, mais
 * parce qu'aucun champ de ce contrat n'en accepte : le modèle remplit des
 * chaînes courtes, et c'est du code écrit à la main qui les dessine.
 */

const BONNE: PageDemande = {
  titre: 'Quincaillerie Bépanda',
  kicker: 'QUINCAILLERIE',
  accroche: 'Tôles, ciment et outillage, à Bépanda depuis 2012.',
  sections: [
    { titre: 'Ce que je vends', sorte: 'liste', lignes: [{ nom: 'Tôles bac 30/100' }, { nom: 'Ciment' }] },
    {
      titre: 'Quelques prix',
      sorte: 'prix',
      lignes: [{ nom: 'Tôle bac 30/100', valeur: '12 500 F', detail: 'la feuille' }],
    },
    { titre: 'La livraison', sorte: 'texte', texte: 'Nous livrons sur tout Douala, du lundi au samedi.' },
  ],
  telephone: '+237 6 99 41 27 08',
  adresse: 'Rue Bépanda-Omnisport, Douala',
  horaires: 'Lundi à samedi, 7 h – 19 h',
}

describe('une page que le modèle a bien composée', () => {
  it('passe', () => {
    expect(verifierPage(BONNE)).toEqual([])
  })

  it('même sans numéro, adresse ni horaires : on n’invente pas ce qu’on ignore', () => {
    const { telephone, adresse, horaires, ...sans } = BONNE
    void telephone
    void adresse
    void horaires
    expect(verifierPage(sans)).toEqual([])
  })
})

describe('ce que le contrat refuse', () => {
  it('une section « prix » sans lignes : un titre suivi de rien', () => {
    const erreurs = verifierPage({ ...BONNE, sections: [{ titre: 'Mes prix', sorte: 'prix' }] })
    expect(erreurs).toHaveLength(1)
    expect(erreurs[0]?.chemin).toBe('$.sections[0].lignes')
  })

  it('et une section « texte » sans texte', () => {
    const erreurs = verifierPage({ ...BONNE, sections: [{ titre: 'La livraison', sorte: 'texte', texte: '  ' }] })
    expect(erreurs[0]?.chemin).toBe('$.sections[0].texte')
  })

  it('une sorte de section qui n’existe pas', () => {
    // Le modèle n'a que trois formes. Une quatrième serait une invention, et
    // une invention n'a pas de dessin écrit à la main derrière elle.
    expect(verifierPage({ ...BONNE, sections: [{ titre: 'Vidéo', sorte: 'video' }] }).length).toBeGreaterThan(0)
  })

  it('un champ que le contrat ne prévoit pas', () => {
    /*
     * `additionalProperties: false` est ce qui rend l'invariant § 2.1 vrai et
     * non promis : un `html` ou un `script` glissé dans la configuration est
     * refusé par le contrat, pas par un filtre qu'on aurait pu oublier.
     */
    expect(verifierPage({ ...BONNE, html: '<script>alert(1)</script>' }).length).toBeGreaterThan(0)
    expect(verifierPage({ ...BONNE, sections: [{ ...BONNE.sections[0], script: 'x' }] }).length).toBeGreaterThan(0)
  })

  it('une page sans aucune section', () => {
    expect(verifierPage({ ...BONNE, sections: [] }).length).toBeGreaterThan(0)
  })

  it('et une page qui déborde de ce qu’un pouce parcourt', () => {
    // Six sections et huit lignes : au-delà ce n'est plus une vitrine, c'est un
    // catalogue — et un catalogue est un registre, que l'atelier sait déjà faire.
    const trop = Array.from({ length: MAX_SECTIONS + 1 }, () => BONNE.sections[0])
    expect(verifierPage({ ...BONNE, sections: trop }).length).toBeGreaterThan(0)

    const longue = {
      titre: 'Prix',
      sorte: 'prix' as const,
      lignes: Array.from({ length: MAX_LIGNES_SECTION + 1 }, () => ({ nom: 'Tôle', valeur: '1 F' })),
    }
    expect(verifierPage({ ...BONNE, sections: [longue] }).length).toBeGreaterThan(0)
  })

  it('ce qui n’est pas une page du tout', () => {
    for (const rien of [null, undefined, 'une page', 42, []]) {
      expect(verifierPage(rien).length, String(rien)).toBeGreaterThan(0)
    }
  })
})

/** Les ancres seules, pour les éprouver sans traîner les sections. */
const ancres = (sections: PageDemande['sections']): string[] =>
  sectionsAncrees(sections).map((x) => x.ancre)

describe('les ancres du sommaire', () => {
  it('se dérivent du titre, pas d’un rang', () => {
    // Une ancre numérotée change de cible dès qu'on insère une section, et un
    // lien déjà envoyé tombe alors sur autre chose.
    expect(ancres(BONNE.sections)).toEqual([
      'ce-que-je-vends', 'quelques-prix', 'la-livraison',
    ])
  })

  it('déplient les accents plutôt que de les jeter', () => {
    expect(ancres([{ titre: 'Où me trouver', sorte: 'texte', texte: 'x' }])).toEqual([
      'ou-me-trouver',
    ])
  })

  it('départagent deux titres qui se réduisent au même', () => {
    // Un identifiant en double fait sauter le menu au premier des deux, et la
    // deuxième entrée devient un lien mort qui ne bouge pas la page.
    const doublons = [
      { titre: 'Nos prix', sorte: 'liste' as const, lignes: [{ nom: 'a' }] },
      { titre: 'Nos prix !', sorte: 'liste' as const, lignes: [{ nom: 'b' }] },
    ]
    const doubles = ancres(doublons)
    expect(new Set(doubles).size).toBe(2)
  })

  it('donnent un rang à un titre qui ne laisse aucune lettre', () => {
    expect(ancres([{ titre: '★★', sorte: 'texte', texte: 'x' }])).toEqual(['section-1'])
  })
})

describe('le sommaire', () => {
  it('ne s’affiche pas sur deux sections : il répéterait ce qui est à l’écran', () => {
    expect(avecSommaire({ ...BONNE, sommaire: true, sections: BONNE.sections.slice(0, 2) })).toBe(false)
  })

  it('s’affiche à partir de trois, quand la demande disait « un site »', () => {
    expect(avecSommaire({ ...BONNE, sommaire: true })).toBe(true)
  })

  it('reste absent quand on a demandé une page', () => {
    expect(avecSommaire(BONNE)).toBe(false)
  })
})

describe('la carte d’une page, celle que WhatsApp montre', () => {
  const CTX = { lien: 'a237.pages.dev/d/K7M2XQ4BN9PZ', maintenant: new Date('2026-09-10T08:00:00Z') }

  it('met en grand le numéro : c’est ce qui fait écrire', () => {
    const carte = carteDePage(BONNE, CTX)
    expect(carte.bigLabel).toBe('WHATSAPP')
    expect(carte.big).toBe('+237 6 99 41 27 08')
  })

  it('met le premier prix quand il n’y a pas de numéro', () => {
    // Une vitrine ne totalise rien : sans un chiffre au milieu, la carte se lit
    // comme un outil vide.
    const { telephone, ...sans } = BONNE
    void telephone
    const carte = carteDePage(sans, CTX)
    expect(carte.bigLabel).toBe('TÔLE BAC 30/100')
    expect(carte.big).toBe('12 500 F')
  })

  it('liste les prix plutôt que la première section venue', () => {
    const carte = carteDePage(BONNE, CTX)
    expect(carte.listTitle).toBe('QUELQUES PRIX')
    expect(carte.items.map((i) => i.n)).toEqual(['Tôle bac 30/100'])
  })

  it('ne dessine aucune barre : une vitrine ne mesure aucune avance', () => {
    expect(carteDePage(BONNE, CTX).pct).toBeNull()
  })

  it('rabat sur le sur-titre quand il n’y a ni numéro ni prix', () => {
    // Une carte avec un blanc au milieu se lit comme un outil vide. Le
    // sur-titre ne dit pas grand-chose, mais il dit quelque chose.
    const carte = carteDePage(
      {
        titre: 'Atelier de couture Awa',
        kicker: 'COUTURE SUR MESURE',
        accroche: 'Boubous, tailleurs et retouches.',
        sections: [{ titre: 'Ce que je fais', sorte: 'texte', texte: 'Sur rendez-vous.' }],
      },
      CTX,
    )
    expect(carte.bigLabel).toBe('')
    expect(carte.big).toBe('COUTURE SUR MESURE')
    expect(carte.items).toEqual([])
    expect(carte.listTitle).toBe('')
  })

  it('ignore un numéro que personne ne saurait composer', () => {
    // « à demander au comptoir » n'est pas un numéro : le mettre en grand
    // ferait une carte qui invite à écrire à personne.
    const carte = carteDePage({ ...BONNE, telephone: 'au comptoir' }, CTX)
    expect(carte.bigLabel).toBe('TÔLE BAC 30/100')
  })

  it('prend la liste quand il n’y a pas de prix à montrer', () => {
    const sansPrix = { ...BONNE, sections: BONNE.sections.filter((s) => s.sorte !== 'prix') }
    const carte = carteDePage(sansPrix, CTX)
    expect(carte.listTitle).toBe('CE QUE JE VENDS')
    expect(carte.items.map((i) => i.val)).toEqual([null, null])
  })

  it('saute une ligne de prix sans montant pour trouver la suivante', () => {
    const { telephone, ...sansTel } = BONNE
    void telephone
    const carte = carteDePage(
      {
        ...sansTel,
        sections: [
          {
            titre: 'Quelques prix',
            sorte: 'prix',
            lignes: [{ nom: 'Sur devis' }, { nom: 'Sac de ciment', valeur: '5 800 F' }],
          },
        ],
      },
      CTX,
    )
    expect(carte.big).toBe('5 800 F')
  })

  it('ne met ni adresse ni horaires quand la demande ne les donnait pas', () => {
    const { adresse, horaires, ...sans } = BONNE
    void adresse
    void horaires
    expect(carteDePage(sans, CTX).subline).toBe('')
  })
})

describe('ce qui part dans une discussion', () => {
  const CTX = { lien: 'a237.pages.dev/d/K7M2XQ4BN9PZ', maintenant: new Date('2026-09-10T08:00:00Z') }

  it('dit qui, quoi et comment joindre, avant même que l’aperçu se dessine', () => {
    const txt = partageDePage(BONNE, CTX).txt
    expect(txt).toContain('QUINCAILLERIE BÉPANDA')
    expect(txt).toContain('Tôle bac 30/100 — 12 500 F')
    expect(txt).toContain('WhatsApp : +237 6 99 41 27 08')
    expect(txt).toContain(CTX.lien)
  })

  it('se réduit au nécessaire quand la page ne donne que l’essentiel', () => {
    const txt = partageDePage(
      {
        titre: 'Atelier de couture Awa',
        kicker: 'COUTURE',
        accroche: 'Boubous et retouches.',
        sections: [{ titre: 'Ce que je fais', sorte: 'texte', texte: 'Sur rendez-vous.' }],
      },
      CTX,
    ).txt
    expect(txt).not.toContain('Où :')
    expect(txt).not.toContain('WhatsApp :')
    expect(txt).toContain(CTX.lien)
  })

  it('ne promet pas de relancer qui que ce soit', () => {
    // Une vitrine ne connaît pas ses lecteurs, et c'est voulu : rien de ce
    // qu'elle publie n'identifie qui l'a ouverte.
    expect(partageDePage(BONNE, CTX).relances).toEqual([])
  })
})
