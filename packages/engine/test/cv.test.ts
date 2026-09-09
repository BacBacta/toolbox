import { describe, expect, it } from 'vitest'
import {
  GABARITS, INTITULES, SIGNES_PAR_PAGE, controleCv, cv, cvCard, cvSchema, cvShare,
  debordeUnePage, signesCv, valider,
} from '../src/index.js'
import type { EtatCv, RenderContext } from '../src/index.js'

const CTX: RenderContext = { lien: 'atl.cm/a/ZBV3', maintenant: new Date('2026-09-09T07:45:00.000Z') }

const REMPLI: EtatCv = {
  ...cv.defaults,
  identite: {
    nom: 'Adèle Ngo Bell',
    titre: 'Magasinière — gestion de stock',
    tel: '+237 6 99 00 00 00',
    mail: 'adele@mail.cm',
    ville: 'Douala',
  },
  resume: 'Six ans en entrepôt.',
  postes: [
    {
      intitule: 'Magasinière principale',
      employeur: 'Quincaillerie Bépanda',
      periode: '2022 – 2026',
      points: ['Écarts d’inventaire ramenés de 12 % à 3 %'],
    },
  ],
  diplomes: [{ intitule: 'Baccalauréat série G2', etablissement: 'Lycée de Bonabéri', annee: '2019' }],
  competences: ['Inventaire tournant', 'Sage Gescom'],
  langues: ['Français — courant', 'Duala — maternelle'],
}

describe('le curriculum vitæ', () => {
  it('part vide, et valide', () => {
    expect(valider(cvSchema, cv.defaults)).toEqual([])
    expect(cv.defaults.identite.nom).toBe('')
    expect(cv.defaults.postes).toEqual([])
  })

  it('ne porte le nom de personne dans ses valeurs de départ', () => {
    // Le prototype livrait le CV de Serge Mbarga. Ouvrir un CV neuf et trouver
    // la carrière d'un inconnu à effacer est pire que de trouver une page vide.
    const json = JSON.stringify(cv.defaults)
    for (const nom of ['Mbarga', 'Serge', 'Bépanda', 'Kamdem', 'Bonabéri']) {
      expect(json).not.toContain(nom)
    }
  })

  it('n’a ni numéro ni date d’émission : personne ne l’archive', () => {
    expect(cv.defaults).not.toHaveProperty('emisLe')
    expect(cv.defaults).not.toHaveProperty('numero')
    expect(cv.defaults).not.toHaveProperty('emetteur')
    expect(cv.initialiser).toBeUndefined()
  })

  it('réclame les quatre choses sans lesquelles un recruteur ne peut rien faire', () => {
    const manque = controleCv(cv.defaults).map((m) => m.libelle)
    expect(manque).toEqual([
      'ton nom',
      'le poste que tu vises',
      'un téléphone ou une adresse mail',
      'au moins une expérience ou un diplôme',
    ])
    expect(controleCv(REMPLI)).toEqual([])
  })

  it('se contente d’un seul moyen d’être rappelé', () => {
    // Beaucoup n'ont pas d'adresse mail ; personne n'est sans téléphone.
    // Exiger les deux écarterait la moitié des gens.
    const parTel = { ...REMPLI, identite: { ...REMPLI.identite, mail: '' } }
    const parMail = { ...REMPLI, identite: { ...REMPLI.identite, tel: '' } }
    expect(controleCv(parTel)).toEqual([])
    expect(controleCv(parMail)).toEqual([])
    const sansRien = { ...REMPLI, identite: { ...REMPLI.identite, tel: '', mail: '' } }
    expect(controleCv(sansRien).map((m) => m.champ)).toEqual(['$.identite.tel'])
  })

  it('accepte un CV sans expérience mais avec un diplôme, et l’inverse', () => {
    expect(controleCv({ ...REMPLI, postes: [] })).toEqual([])
    expect(controleCv({ ...REMPLI, diplomes: [] })).toEqual([])
  })

  it('ne traduit que les intitulés de section, jamais le contenu', () => {
    // Le prototype basculait aussi le texte — il ne pouvait le faire que pour
    // le CV d'exemple qu'il portait en dur. Promettre une traduction qu'on ne
    // sait pas faire est pire que ne rien promettre.
    expect(INTITULES.fr.experience).toBe('Expérience professionnelle')
    expect(INTITULES.en.experience).toBe('Experience')
    expect(Object.keys(INTITULES.fr).sort()).toEqual(Object.keys(INTITULES.en).sort())
  })

  it('compte les signes pour prévenir du débordement, sans rien garantir', () => {
    expect(signesCv(cv.defaults)).toBe(0)
    expect(debordeUnePage(cv.defaults)).toBe(false)
    const long: EtatCv = { ...REMPLI, resume: 'x'.repeat(SIGNES_PAR_PAGE + 1) }
    expect(debordeUnePage(long)).toBe(true)
    // Le mode compact recule le seuil : c'est précisément ce qu'il sert à faire.
    expect(debordeUnePage({ ...long, dense: true })).toBe(false)
  })

  it('offre les quatre gabarits, et le schéma les connaît tous', () => {
    expect(GABARITS).toEqual(['notaire', 'executif', 'editorial', 'bloc'])
    const objet = cvSchema as { properties: Record<string, { enum?: readonly string[] }> }
    expect(objet.properties.gabarit?.enum).toEqual([...GABARITS])
    for (const g of GABARITS) expect(valider(cvSchema, { ...cv.defaults, gabarit: g })).toEqual([])
  })

  it('refuse un gabarit inventé', () => {
    expect(valider(cvSchema, { ...cv.defaults, gabarit: 'flamboyant' }).length).toBeGreaterThan(0)
  })

  it('met les compétences sur la carte, pas la carrière', () => {
    const carte = cvCard(REMPLI, CTX)
    expect(carte.title).toBe('Adèle Ngo Bell')
    expect(carte.items.map((i) => i.n)).toEqual(['Inventaire tournant', 'Sage Gescom'])
    // Le nombre de postes, pas des années : additionner « 2022 – 2026 » et
    // « depuis mars » à la main donnerait un chiffre faux.
    expect(carte.big).toBe('1')
    expect(cvCard(cv.defaults, CTX).big).toBe('—')
  })

  it('suit la langue jusque sur la carte', () => {
    expect(cvCard({ ...REMPLI, langue: 'en' }, CTX).bigLabel).toBe('EXPERIENCE')
    expect(cvCard({ ...REMPLI, langue: 'en' }, CTX).listTitle).toBe('Skills')
  })

  it('ne se diffuse jamais dans un groupe', () => {
    // Diffuser un CV dans un groupe, c'est laisser son numéro de téléphone à
    // des gens qui ne recrutent pas.
    const partage = cvShare(REMPLI, CTX)
    expect(partage.relances).toEqual([])
    expect(partage.broad).toBeNull()
    expect(partage.warn).toBeNull()
  })

  it('prévient par écrit quand il part incomplet', () => {
    const partage = cvShare(cv.defaults, CTX)
    expect(partage.warn).toContain('ton nom')
    expect(partage.name).toBe('cv-sans-nom')
  })

  it('tire un nom de fichier sans accent ni espace, sans avaler la lettre', () => {
    // « Adèle » donnait « ad-le » : couper sur [^a-z0-9] avant d'avoir plié
    // les accents mange la lettre accentuée au lieu de la remplacer.
    expect(cvShare(REMPLI, CTX).name).toBe('cv-adele-ngo-bell')
  })
})
