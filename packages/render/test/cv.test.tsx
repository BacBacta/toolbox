import { GABARITS, cv } from '@a237/engine'
import type { EtatCv } from '@a237/engine'
import { describe, expect, it } from 'vitest'
import { render as enChaine } from 'preact-render-to-string'
import { DocumentCv } from '../src/doc/cv.js'

/**
 * Ce que le recruteur voit. Pas la mise en page — ce qui doit s'y retrouver
 * quel que soit le gabarit, et ce qui ne doit jamais s'y trouver.
 */

const REMPLI: EtatCv = {
  ...cv.defaults,
  identite: {
    nom: 'Adèle Ngo Bell',
    titre: 'Magasinière — gestion de stock',
    tel: '+237 6 99 00 00 00',
    mail: 'adele@mail.cm',
    ville: 'Douala',
  },
  resume: 'Six ans en entrepôt et magasin de pièces détachées.',
  postes: [
    {
      intitule: 'Magasinière principale',
      employeur: 'Quincaillerie Bépanda',
      periode: '2022 – 2026',
      points: ['Écarts d’inventaire ramenés de 12 % à 3 %', ''],
    },
  ],
  diplomes: [{ intitule: 'Baccalauréat série G2', etablissement: 'Lycée de Bonabéri', annee: '2019' }],
  competences: ['Inventaire tournant', 'Sage Gescom'],
  langues: ['Français — courant', 'Duala — maternelle'],
}

describe('le CV sur A4', () => {
  it.each(GABARITS)('le gabarit « %s » porte tout le contenu', (gabarit) => {
    // Changer de gabarit change la forme, jamais ce qui est dit. Un contenu
    // qui disparaît d'une mise en page est un CV qu'on envoie amputé.
    const html = enChaine(<DocumentCv etat={{ ...REMPLI, gabarit }} />)
    for (const attendu of [
      'Adèle Ngo Bell',
      'Magasinière — gestion de stock',
      '+237 6 99 00 00 00',
      'adele@mail.cm',
      'Douala',
      'Six ans en entrepôt',
      'Magasinière principale',
      'Quincaillerie Bépanda',
      '2022 – 2026',
      'Écarts d’inventaire ramenés',
      'Baccalauréat série G2',
      'Lycée de Bonabéri',
      'Inventaire tournant',
      'Français — courant',
    ]) {
      expect(html).toContain(attendu)
    }
  })

  it.each(GABARITS)('le gabarit « %s » se reconnaît à sa classe', (gabarit) => {
    expect(enChaine(<DocumentCv etat={{ ...REMPLI, gabarit }} />)).toContain(`a4-cv ${gabarit}`)
  })

  it('ne réserve jamais de place pour une photo', () => {
    // Le prototype dessinait un carré marqué « photo ». À l'écran c'est une
    // intention ; à l'impression c'est un carré vide marqué « photo » sur la
    // feuille qu'on tend à un employeur.
    for (const gabarit of GABARITS) {
      const html = enChaine(<DocumentCv etat={{ ...REMPLI, gabarit }} />).toLowerCase()
      expect(html).not.toContain('photo')
    }
  })

  it('bascule les intitulés en anglais sans toucher au contenu', () => {
    const html = enChaine(<DocumentCv etat={{ ...REMPLI, langue: 'en' }} />)
    expect(html).toContain('Experience')
    expect(html).toContain('Education')
    expect(html).not.toContain('Expérience professionnelle')
    // Le texte écrit par la personne reste tel quel : on ne le traduit pas.
    expect(html).toContain('Six ans en entrepôt')
    expect(html).toContain('Magasinière principale')
  })

  it('n’affiche pas une section vide plutôt qu’un titre orphelin', () => {
    const html = enChaine(<DocumentCv etat={cv.defaults} />)
    expect(html).not.toContain('Expérience professionnelle')
    expect(html).not.toContain('Formation')
    expect(html).not.toContain('Compétences')
    expect(html).not.toContain('Profil')
  })

  it('ne laisse pas de puce sur une ligne vide', () => {
    // Le formulaire permet d'ajouter une ligne et de ne pas la remplir.
    const html = enChaine(<DocumentCv etat={REMPLI} />)
    expect(html.match(/cv-fait/g)?.length).toBe(1)
  })

  it('ne met la date en marge que dans le gabarit éditorial', () => {
    // En marge, la marge ne porte que la date : y mettre aussi l'employeur
    // produisait un pavé ferré à droite sur trois lignes face à un titre d'une.
    const edito = enChaine(<DocumentCv etat={{ ...REMPLI, gabarit: 'editorial' }} />)
    expect(edito).toContain('<div class="cv-marge">2022 – 2026</div>')
    expect(edito).toContain('<div class="cv-ou">Quincaillerie Bépanda</div>')
    // Ailleurs, tout tient sur une ligne, et la marge n'existe pas.
    const exec = enChaine(<DocumentCv etat={{ ...REMPLI, gabarit: 'executif' }} />)
    expect(exec).not.toContain('cv-marge')
    expect(exec).toContain('Quincaillerie Bépanda · 2022 – 2026')
    // Le notaire sépare au tiret cadratin, comme le prototype.
    expect(enChaine(<DocumentCv etat={{ ...REMPLI, gabarit: 'notaire' }} />))
      .toContain('Quincaillerie Bépanda — 2022 – 2026')
  })

  it('n’ouvre pas de marge vide quand la période n’est pas saisie', () => {
    const sansDate = {
      ...REMPLI,
      gabarit: 'editorial' as const,
      postes: [{ ...REMPLI.postes[0]!, periode: '' }],
      diplomes: [{ ...REMPLI.diplomes[0]!, annee: '' }],
    }
    expect(enChaine(<DocumentCv etat={sansDate} />)).not.toContain('cv-marge')
  })

  it('resserre la page en mode compact', () => {
    expect(enChaine(<DocumentCv etat={{ ...REMPLI, dense: true }} />)).toContain('dense')
    expect(enChaine(<DocumentCv etat={REMPLI} />)).not.toContain('dense')
  })

  it('ne porte ni entête d’entreprise, ni pied légal, ni signature', () => {
    // Un CV n'est pas un document d'affaires : ni RCCM, ni NIU, ni cachet.
    const html = enChaine(<DocumentCv etat={REMPLI} />)
    expect(html).not.toContain('a4-entete')
    expect(html).not.toContain('a4-pied')
    expect(html).not.toContain('a4-signatures')
  })

  it('n’injecte jamais de HTML, même si on en écrit dans un champ', () => {
    const piege = {
      ...REMPLI,
      resume: '<script>alert(1)</script>',
      competences: ['<b>gras</b>'],
    }
    const html = enChaine(<DocumentCv etat={piege} />)
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<b>gras</b>')
    // Preact échappe le chevron ouvrant ; le chevron fermant reste tel quel,
    // et c'est sans conséquence — seul « < » ouvre une balise.
    expect(html).toContain('&lt;script')
    expect(html).toContain('&lt;b')
  })
})
