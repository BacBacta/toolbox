import { describe, expect, it } from 'vitest'
import {
  AVERTISSEMENT_ARDOISE, JOURS_RETARD, ajouterDette, ardoise, ardoiseCard, ardoiseShare,
  basculerReglee, chercher, joursOuverts, ordonner, retirerDette, totaux, valider,
  vieillissement, vueDettes,
} from '../src/index.js'
import { ESPACE_INSECABLE, montantF } from '../src/index.js'
import type { EtatArdoise, RenderContext } from '../src/index.js'

const LE_9_SEPT = new Date('2026-09-09T07:45:00.000Z')
const CTX: RenderContext = { lien: 'atl.cm/a/ZBV3', maintenant: LE_9_SEPT }

/** Une date à `n` jours avant le 9 septembre. */
function ilYA(n: number): string {
  return new Date(LE_9_SEPT.getTime() - n * 86_400_000).toISOString()
}

const BOUTIQUE: EtatArdoise = {
  ...ardoise.defaults,
  boutique: 'Quincaillerie Bépanda',
  dettes: [
    { client: 'Adèle Ngo Bell', montant: 45_000, depuis: ilYA(62), tel: '699410277', regle: false },
    { client: 'Ernest Fotso', montant: 12_000, depuis: ilYA(9), regle: false },
    { client: 'Rosalie Mbia', montant: 30_000, depuis: ilYA(21), regle: false },
    { client: 'Théodore Kamdem', montant: 8_000, depuis: ilYA(40), regle: true },
  ],
}

describe('l’ardoise', () => {
  it('part vide, valide, et sans la dette de personne', () => {
    expect(valider(ardoise.schema, ardoise.defaults)).toEqual([])
    expect(ardoise.defaults.dettes).toEqual([])
    const json = JSON.stringify(ardoise.defaults)
    for (const nom of ['Bépanda', 'Mbarga', 'Fotso', 'Rosalie']) expect(json).not.toContain(nom)
  })

  it('calcule l’ancienneté au lieu de la stocker', () => {
    // Le prototype gardait un nombre de jours dans l'état : il n'aurait jamais
    // bougé, et une dette de trois mois se serait affichée « depuis 4 jours »
    // pour toujours.
    expect(ardoise.schema).not.toHaveProperty('properties.dettes.items.properties.jours')
    const vues = vueDettes(BOUTIQUE, LE_9_SEPT)
    expect(vues.map((v) => v.jours)).toEqual([62, 9, 21, 0])
    // Un mois plus tard, sans qu'on ait touché à l'état.
    const plusTard = new Date(LE_9_SEPT.getTime() + 30 * 86_400_000)
    expect(vueDettes(BOUTIQUE, plusTard)[0]?.jours).toBe(92)
  })

  it('marque le retard au-delà de trente jours, jamais avant', () => {
    const vues = vueDettes(BOUTIQUE, LE_9_SEPT)
    expect(vues.map((v) => v.enRetard)).toEqual([true, false, false, false])
    const pile = { ...BOUTIQUE, dettes: [{ ...BOUTIQUE.dettes[0]!, depuis: ilYA(JOURS_RETARD) }] }
    expect(vueDettes(pile, LE_9_SEPT)[0]?.enRetard).toBe(false)
    const unDePlus = { ...BOUTIQUE, dettes: [{ ...BOUTIQUE.dettes[0]!, depuis: ilYA(31) }] }
    expect(vueDettes(unDePlus, LE_9_SEPT)[0]?.enRetard).toBe(true)
  })

  it('ne compte pas les jours d’une dette réglée', () => {
    expect(joursOuverts(BOUTIQUE.dettes[3]!, LE_9_SEPT)).toBe(0)
  })

  it('range ce qui est dû d’abord, le plus vieux en tête', () => {
    // Une ardoise se lit pour savoir qui relancer, pas pour retrouver un nom.
    const ordre = ordonner(vueDettes(BOUTIQUE, LE_9_SEPT)).map((v) => v.client)
    expect(ordre).toEqual(['Adèle Ngo Bell', 'Rosalie Mbia', 'Ernest Fotso', 'Théodore Kamdem'])
  })

  it('additionne l’encours, le recouvré et les clients ouverts', () => {
    const t = totaux(vueDettes(BOUTIQUE, LE_9_SEPT))
    expect(t.encours).toBe(87_000)
    expect(t.recouvre).toBe(8_000)
    expect(t.ouverts).toBe(3)
    expect(t.enRetard).toBe(1)
    expect(t.part).toBeCloseTo(8_000 / 95_000, 6)
  })

  it('ne divise pas par zéro sur une ardoise vide', () => {
    expect(totaux([])).toEqual({ encours: 0, recouvre: 0, ouverts: 0, enRetard: 0, part: 0 })
  })

  it('répartit l’encours en trois tranches d’ancienneté', () => {
    const tr = vieillissement(vueDettes(BOUTIQUE, LE_9_SEPT))
    expect(tr.map((t) => [t.libelle, t.montant, t.clients])).toEqual([
      ['0–15 j', 12_000, 1],
      ['16–30 j', 30_000, 1],
      ['+30 j', 45_000, 1],
    ])
    // Les tranches couvrent l'encours, sans trou ni recouvrement.
    expect(tr.reduce((a, t) => a + t.montant, 0)).toBe(87_000)
  })

  it('cherche sans accent ni casse', () => {
    const vues = vueDettes(BOUTIQUE, LE_9_SEPT)
    expect(chercher(vues, 'adele').map((v) => v.client)).toEqual(['Adèle Ngo Bell'])
    expect(chercher(vues, 'MBIA').map((v) => v.client)).toEqual(['Rosalie Mbia'])
    expect(chercher(vues, '').length).toBe(4)
    expect(chercher(vues, 'zzz')).toEqual([])
  })

  it('rouvre une dette à la date d’aujourd’hui, pas à l’ancienne', () => {
    // Une dette soldée puis rouverte n'a pas traîné entre-temps : lui rendre
    // ses soixante-deux jours ferait mentir la tranche « +30 j ».
    const soldee = basculerReglee(BOUTIQUE, 0, LE_9_SEPT)
    expect(soldee.dettes[0]?.regle).toBe(true)
    expect(soldee.dettes[0]?.depuis).toBe(BOUTIQUE.dettes[0]?.depuis)
    const rouverte = basculerReglee(soldee, 0, LE_9_SEPT)
    expect(rouverte.dettes[0]?.regle).toBe(false)
    expect(joursOuverts(rouverte.dettes[0]!, LE_9_SEPT)).toBe(0)
  })

  it('ignore un index qui ne désigne rien', () => {
    expect(basculerReglee(BOUTIQUE, 99, LE_9_SEPT)).toBe(BOUTIQUE)
  })

  it('ajoute et retire une dette', () => {
    const plus = ajouterDette(ardoise.defaults, ' Serge ', 5_000, LE_9_SEPT, ' 690112233 ')
    expect(plus.dettes).toEqual([
      { client: 'Serge', montant: 5_000, depuis: LE_9_SEPT.toISOString(), regle: false, tel: '690112233' },
    ])
    expect(valider(ardoise.schema, plus)).toEqual([])
    expect(retirerDette(plus, 0).dettes).toEqual([])
    // Un nom vide n'ouvre rien, et un téléphone vide ne s'écrit pas.
    expect(ajouterDette(ardoise.defaults, '  ', 5_000, LE_9_SEPT).dettes).toEqual([])
    expect(ajouterDette(ardoise.defaults, 'X', 5_000, LE_9_SEPT).dettes[0]).not.toHaveProperty('tel')
  })

  it('porte l’avertissement du brief § 5.2, mot pour mot', () => {
    // Le seul endroit où l'atelier dit non à ce que l'utilisateur s'apprête à
    // faire, et pour une raison qui n'est pas technique.
    const partage = ardoiseShare(BOUTIQUE, CTX)
    expect(partage.warn).toBe(AVERTISSEMENT_ARDOISE)
    expect(partage.warn).toContain('pour toi, pas pour un groupe')
    expect(partage.warn).toContain('humiliation')
    expect(partage.warn).toContain('relances individuelles')
    // Il ne disparaît jamais, pas même quand tout est réglé.
    const tout = { ...BOUTIQUE, dettes: BOUTIQUE.dettes.map((d) => ({ ...d, regle: true })) }
    expect(ardoiseShare(tout, CTX).warn).toBe(AVERTISSEMENT_ARDOISE)
    // Et il n'y a pas de variante de diffusion large.
    expect(partage.broad).toBeNull()
  })

  it('relance chaque client à part, du plus vieux au plus récent', () => {
    const partage = ardoiseShare(BOUTIQUE, CTX)
    expect(partage.relances.map((r) => r.nom)).toEqual([
      'Adèle Ngo Bell', 'Rosalie Mbia', 'Ernest Fotso',
    ])
    expect(partage.relances[0]?.tel).toBe('699410277')
    // Sans numéro, la relance se copie : le moteur le dit par un null.
    expect(partage.relances[1]?.tel).toBeNull()
    expect(partage.relances[0]?.message).toContain(montantF(45_000))
    expect(partage.relances[0]?.message).toContain('62 jours')
    expect(partage.relances[0]?.message).toContain('Quincaillerie Bépanda')
    expect(partage.relances[0]?.message).toContain('atl.cm/a/ZBV3')
  })

  it('ne relance pas quelqu’un qui a réglé', () => {
    expect(ardoiseShare(BOUTIQUE, CTX).relances.map((r) => r.nom)).not.toContain('Théodore Kamdem')
    const tout = { ...BOUTIQUE, dettes: BOUTIQUE.dettes.map((d) => ({ ...d, regle: true })) }
    expect(ardoiseShare(tout, CTX).relances).toEqual([])
    expect(ardoiseShare(tout, CTX).relancesVides).toContain('tout est réglé')
  })

  it('met l’encours sur la carte, et l’âge à côté de chaque nom', () => {
    const carte = ardoiseCard(BOUTIQUE, CTX)
    expect(carte.kicker).toBe('ARDOISE CLIENTS')
    expect(carte.title).toBe('Quincaillerie Bépanda')
    expect(carte.big).toBe(montantF(87_000))
    // Le séparateur de milliers est insécable : « 87 000 F » ne doit jamais
    // se couper en fin de ligne sur une carte.
    expect(carte.big).toContain(ESPACE_INSECABLE)
    expect(carte.items[0]?.n).toBe('Adèle Ngo Bell · 62 j')
    expect(carte.items[0]?.warn).toBe(true)
    // Un client réglé n'a plus d'âge à afficher, et une dette ouverte le matin
    // même n'en a pas encore : « · 0 j » est du bruit dans les deux cas.
    expect(carte.items[3]?.n).toBe('Théodore Kamdem')
    expect(carte.items[3]?.ok).toBe(true)
    const dujour = ajouterDette(ardoise.defaults, 'Rosalie', 5_000, LE_9_SEPT)
    expect(ardoiseCard(dujour, CTX).items[0]?.n).toBe('Rosalie')
  })

  it('retombe sur le nom de l’outil quand la boutique n’est pas nommée', () => {
    const anonyme = { ...BOUTIQUE, boutique: '' }
    expect(ardoiseCard(anonyme, CTX).title).toBe('Ardoise clients')
    expect(ardoiseShare(anonyme, CTX).relances[0]?.message).toContain('Ardoise clients')
  })
})
