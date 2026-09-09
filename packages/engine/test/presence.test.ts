import { describe, expect, it } from 'vitest'
import {
  MAX_SEANCES, SEUIL_ASSIDUITE, ajouterNom, appel, assiduites, basculerPresence,
  decroche, derniereSeance, estPresent, nomSeance, nouvelleSeance, presence,
  presenceCard, presenceShare, retirerNom, valider,
} from '../src/index.js'
import type { EtatPresence, RenderContext } from '../src/index.js'

const CTX: RenderContext = {
  lien: 'atl.cm/s/ZBV3',
  maintenant: new Date('2026-09-09T07:45:00.000Z'),
}

const CLASSE: EtatPresence = {
  ...presence.defaults,
  nom: 'Cours du soir',
  noms: ['Adèle', 'Ernest', 'Rosalie'],
  seances: [
    { titre: '', presents: [true, true, true] },
    { titre: '12 mars', presents: [true, false, true] },
    // Rosalie a rejoint plus tard : sa case manque aux deux premières séances
    // dans le cas testé plus bas, pas ici.
    { titre: '', presents: [false, false, true] },
  ],
}

describe('la feuille de présence', () => {
  it('part vide, valide, et sans le nom de personne', () => {
    expect(valider(presence.schema, presence.defaults)).toEqual([])
    expect(presence.defaults.noms).toEqual([])
    expect(presence.defaults.seances).toEqual([])
  })

  it('est une matrice, pas une liste : le taux de chacun traverse les séances', () => {
    // C'est précisément ce que la fabrique de listes ne sait pas exprimer : une
    // liste par séance perdrait l'assiduité, qu'on ouvre la feuille pour voir.
    const a = assiduites(CLASSE)
    expect(a.map((x) => [x.nom, x.presences, x.seances])).toEqual([
      ['Adèle', 2, 3],
      ['Ernest', 1, 3],
      ['Rosalie', 3, 3],
    ])
  })

  it('ne compte pas comme absent quelqu’un qui n’était pas encore inscrit', () => {
    // Sans cette règle, le dernier inscrit ouvre la feuille à 20 % et n'y peut
    // rien.
    const tardif: EtatPresence = {
      ...CLASSE,
      noms: [...CLASSE.noms, 'Théodore'],
      // Les séances passées n'ont que trois cases : la quatrième est absente.
      seances: CLASSE.seances,
    }
    const avec = nouvelleSeance(tardif)
    const x = assiduites(avec).find((y) => y.nom === 'Théodore')
    expect(x?.seances).toBe(1)
    expect(x?.taux).toBe(1)
  })

  it('rend un taux nul, pas zéro, pour qui n’a vécu aucune séance', () => {
    const neuf = ajouterNom(presence.defaults, 'Adèle')
    const x = assiduites(neuf)[0]
    expect(x?.taux).toBeNull()
    expect(decroche(x!)).toBe(false)
  })

  it('signale qui décroche sous soixante pour cent', () => {
    const a = assiduites(CLASSE)
    expect(SEUIL_ASSIDUITE).toBe(0.6)
    expect(a.map(decroche)).toEqual([false, true, false])
  })

  it('fait l’appel d’une séance et nomme les absents', () => {
    const a = appel(CLASSE, 1)
    expect(a.presents).toBe(2)
    expect(a.total).toBe(3)
    expect(a.taux).toBeCloseTo(2 / 3, 6)
    expect(a.absents).toEqual(['Ernest'])
  })

  it('ne divise pas par zéro sur une feuille sans personne', () => {
    expect(appel(presence.defaults, 0)).toEqual({
      presents: 0, total: 0, taux: 0, absents: [],
    })
  })

  it('nomme une séance par son titre, ou par son rang', () => {
    expect(nomSeance(CLASSE, 0)).toBe('séance 1')
    expect(nomSeance(CLASSE, 1)).toBe('12 mars')
    expect(nomSeance(CLASSE, 9)).toBe('')
  })

  it('ouvre une séance avec tout le monde présent', () => {
    // Décocher les absents demande moins de gestes que cocher les présents :
    // l'assemblée est la règle, l'absence l'exception.
    const suivante = nouvelleSeance(CLASSE, ' 19 mars ')
    expect(suivante.seances).toHaveLength(4)
    expect(suivante.seances[3]).toEqual({ titre: '19 mars', presents: [true, true, true] })
    expect(derniereSeance(suivante)).toBe(3)
  })

  it('refuse d’ouvrir au-delà du plafond de séances', () => {
    const pleine: EtatPresence = {
      ...presence.defaults,
      seances: Array.from({ length: MAX_SEANCES }, () => ({ titre: '', presents: [] })),
    }
    expect(nouvelleSeance(pleine)).toBe(pleine)
  })

  it('bascule une présence sans toucher aux autres', () => {
    const apres = basculerPresence(CLASSE, 1, 1)
    expect(estPresent(apres, 1, 1)).toBe(true)
    expect(estPresent(apres, 1, 0)).toBe(true)
    expect(estPresent(apres, 0, 1)).toBe(true)
    // Un index qui ne désigne rien ne change rien.
    expect(basculerPresence(CLASSE, 9, 0)).toBe(CLASSE)
    expect(basculerPresence(CLASSE, 0, 9)).toBe(CLASSE)
  })

  it('retire un nom et sa colonne dans chaque séance', () => {
    // Sans ça, les cases glisseraient d'un cran et l'appel désignerait le
    // voisin de celui qu'on a pointé.
    const sansErnest = retirerNom(CLASSE, 1)
    expect(sansErnest.noms).toEqual(['Adèle', 'Rosalie'])
    expect(sansErnest.seances.map((s) => s.presents)).toEqual([
      [true, true],
      [true, true],
      [false, true],
    ])
    expect(retirerNom(CLASSE, 9)).toBe(CLASSE)
  })

  it('refuse un nom vide ou déjà présent, même écrit autrement', () => {
    expect(ajouterNom(CLASSE, '   ')).toBe(CLASSE)
    expect(ajouterNom(CLASSE, 'ADÈLE')).toBe(CLASSE)
    expect(ajouterNom(CLASSE, 'adele')).toBe(CLASSE)
    expect(ajouterNom(CLASSE, 'Théodore').noms).toHaveLength(4)
  })

  it('met l’appel du jour sur la carte, jamais l’assiduité de chacun', () => {
    // Une feuille qui déballerait le taux de chacun devant tout le monde ferait
    // le même tort qu'une ardoise publiée.
    const carte = presenceCard(CLASSE, CTX, 1)
    expect(carte.kicker).toBe('FEUILLE DE PRÉSENCE')
    expect(carte.big).toBe('2 / 3')
    expect(carte.tag).toBe('12 mars')
    expect(carte.items.map((i) => [i.n, i.val])).toEqual([
      ['Adèle', 'présent'],
      ['Ernest', 'absent'],
      ['Rosalie', 'présent'],
    ])
    // Le taux de la séance est public — tout le monde y était et sait qui
    // manquait. C'est le taux de chacun sur six mois qui ne sort pas.
    expect(carte.subline).toBe('67 % de présence à cette séance')
    expect(carte.items.some((i) => (i.val ?? '').includes('%'))).toBe(false)
    expect(JSON.stringify(carte.items)).not.toContain('séances')
  })

  it('relance les absents de la séance, un par un', () => {
    const partage = presenceShare(CLASSE, CTX, 1)
    expect(partage.relances.map((r) => r.nom)).toEqual(['Ernest'])
    expect(partage.relances[0]?.tel).toBeNull()
    expect(partage.relances[0]?.message).toContain('12 mars')
    expect(partage.relances[0]?.message).toContain('atl.cm/s/ZBV3')
    expect(partage.name).toBe('presence-s2')
  })

  it('n’a personne à relancer quand tout le monde est là', () => {
    const partage = presenceShare(CLASSE, CTX, 0)
    expect(partage.relances).toEqual([])
    expect(partage.relancesVides).toContain('Tout le monde était là')
  })

  it('prévient que la carte ne porte pas l’assiduité, quand elle compte', () => {
    expect(presenceShare(CLASSE, CTX, 1).warn).toContain('reste sur ton téléphone')
    // Sans personne en décrochage, il n'y a rien à protéger : pas d'encart.
    const assidus: EtatPresence = {
      ...CLASSE,
      seances: [{ titre: '', presents: [true, true, true] }],
    }
    expect(presenceShare(assidus, CTX, 0).warn).toBeNull()
  })
})
