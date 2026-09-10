import { describe, expect, it } from 'vitest'
import {
  MAX_LIGNES_SECTION, MAX_SECTIONS, avecSommaire, carteDePage, direLeJour, partageDePage,
  sectionsAncrees,
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

/**
 * Un événement est une page datée, et c'est tout ce qui l'en sépare.
 *
 * Une annonce de mariage, une réunion de tontine, une vente de fin d'année ont
 * un nom, un lieu, un programme et une phrase — tout ce qu'une vitrine porte
 * déjà. Ce qu'elles ont en plus est une date, et une date que la machine
 * comprend permet à la page de dire elle-même dans combien de jours c'est.
 */
describe('le jour d’un événement, dit comme on le dirait', () => {
  const LE_9_SEPT = new Date('2026-09-09T08:00:00.000Z')

  it('nomme le jour de la semaine : c’est ce qui dit si on est libre', () => {
    const jour = direLeJour('2026-09-12', LE_9_SEPT)
    expect(jour?.quand).toBe('Samedi 12 septembre 2026')
  })

  it.each([
    ['2026-09-09', 'c’est aujourd’hui'],
    ['2026-09-10', 'c’est demain'],
    ['2026-09-12', 'dans 3 jours'],
    ['2026-09-18', 'dans une semaine'],
    ['2026-09-30', 'dans 3 semaines'],
    ['2026-12-09', 'dans 3 mois'],
    ['2026-09-08', 'c’était hier'],
    ['2026-08-30', 'c’est passé'],
  ])('%s se dit « %s »', (iso, attendu) => {
    expect(direLeJour(iso, LE_9_SEPT)?.delai).toBe(attendu)
  })

  it('n’écrit l’heure que si elle a été dite', () => {
    // Une date nue se lit comme minuit, et « à 00 h » sur une affiche de
    // mariage est une erreur qui se voit — celle de la machine.
    expect(direLeJour('2026-09-12', LE_9_SEPT)?.heure).toBe('')
    expect(direLeJour('2026-09-12T15:30', LE_9_SEPT)?.heure).toBe('à 15 h 30')
    // Ni « à 15 h 00 » : en français une heure ronde n'écrit pas ses minutes,
    // et les deux zéros donnent à une invitation l'air d'un horaire de train.
    expect(direLeJour('2026-09-12T15:00', LE_9_SEPT)?.heure).toBe('à 15 h')
    // Ni « à 09 h 30 » : personne ne dit « zéro neuf heures ».
    expect(direLeJour('2026-09-12T09:30', LE_9_SEPT)?.heure).toBe('à 9 h 30')
  })

  it('dit que c’est passé, pour que la page s’éteigne', () => {
    // Une affiche qui garde son air d'urgence après coup fait traverser la
    // ville pour rien.
    expect(direLeJour('2026-08-30', LE_9_SEPT)?.passe).toBe(true)
    expect(direLeJour('2026-09-09', LE_9_SEPT)?.passe).toBe(false)
  })

  it('rend rien plutôt qu’« Invalid Date » sous le nom de quelqu’un', () => {
    expect(direLeJour('samedi prochain', LE_9_SEPT)).toBeNull()
    expect(direLeJour('', LE_9_SEPT)).toBeNull()
  })

  it('compte en jours civils de Douala, et non en heures', () => {
    /*
     * Il est 23 h 30 à Douala le 9. Un événement du 10 est « demain », même
     * s'il commence dans une demi-heure : c'est le jour du calendrier qui
     * compte, comme sur une affiche.
     *
     * Un Worker qui vit en UTC est encore le 9 à 22 h 30 pour lui — et compte
     * pourtant les mêmes jours civils, parce que `joursEntre` ramène les deux
     * bouts à minuit à Douala.
     */
    const tard = new Date('2026-09-09T22:30:00.000Z')
    expect(direLeJour('2026-09-10', tard)?.delai).toBe('c’est demain')
    expect(direLeJour('2026-09-09', tard)?.delai).toBe('c’est aujourd’hui')
  })

  it('lit l’heure à Douala, et non à celle de la machine', () => {
    /*
     * Le défaut : `new Date('2026-09-12T15:00')` lit l'heure de la machine, et
     * un Worker vit en UTC. Un mariage annoncé à 15 h s'affichait à 16 h sur
     * la page publiée et à 15 h dans l'aperçu du téléphone qui l'avait écrite.
     * Personne n'aurait su lequel des deux croire.
     */
    expect(direLeJour('2026-09-12T15:00', LE_9_SEPT)?.heure).toBe('à 15 h')
  })

  it('respecte un fuseau quand il est écrit : qui l’écrit sait ce qu’il fait', () => {
    expect(direLeJour('2026-09-12T15:00:00Z', LE_9_SEPT)?.heure).toBe('à 16 h')
  })

  it('refuse un 31 février, que Date.UTC replierait sur le 3 mars', () => {
    expect(direLeJour('2026-02-31', LE_9_SEPT)).toBeNull()
  })
})

describe('une date que personne ne sait lire', () => {
  it('est refusée, avec la forme attendue dans le reproche', () => {
    // Sans ça, la page l'ignore en silence : l'affiche annonce un événement
    // sans jour, c'est-à-dire exactement ce que le modèle croyait avoir écrit.
    const erreurs = verifierPage({ ...BONNE, date: 'samedi prochain' })
    expect(erreurs.map((e) => e.chemin)).toContain('$.date')
    expect(erreurs[0]?.message).toContain('AAAA-MM-JJ')
  })

  it('laisse passer une page sans date : la plupart n’en ont pas', () => {
    expect(verifierPage(BONNE)).toEqual([])
  })
})

describe('la carte d’un événement', () => {
  const CTX = { lien: 'a237.pages.dev/d/K7M2XQ4BN9PZ', maintenant: new Date('2026-09-09T08:00:00Z') }
  const FETE: PageDemande = { ...BONNE, date: '2026-09-12T15:00', titre: 'Mariage d’Awa et Paul' }

  it('met le jour en grand, avant le numéro', () => {
    // Dans un groupe qui défile, la question n'est pas « comment les
    // joindre » mais « c'est quand ».
    const carte = carteDePage(FETE, CTX)
    expect(carte.bigLabel).toBe('DANS 3 JOURS')
    expect(carte.big).toBe('Samedi 12 septembre 2026 à 15 h')
  })

  it('garde le numéro sur la ligne du lieu', () => {
    // Une affiche d'événement doit encore dire à qui écrire.
    expect(carteDePage(FETE, CTX).subline).toContain('+237 6 99 41 27 08')
  })

  it('met le jour en tête de ce qui part dans une discussion', () => {
    const lignes = partageDePage(FETE, CTX).txt.split('\n')
    expect(lignes[2]).toBe('Samedi 12 septembre 2026 à 15 h — dans 3 jours')
  })
})
