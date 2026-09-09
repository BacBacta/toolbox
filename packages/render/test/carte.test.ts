// @vitest-environment happy-dom
import type { CardSpec, CardItem } from '@a237/engine'
import { MAX_ITEMS_CARTE } from '@a237/engine'
import { describe, expect, it } from 'vitest'
import { cartePng, dessiner, dessinerCarte, mesureurDe } from '../src/carte/canvas.js'
import type { ContexteDessin } from '../src/carte/canvas.js'
import {
  ajusterTaille, composerCarte, hauteurCarte, HAUTEUR_MAX, HAUTEUR_MIN,
  largeurInterlettree, LARGEUR_CARTE, tronquer,
} from '../src/carte/geometrie.js'
import type { Mesureur, Primitive } from '../src/carte/geometrie.js'
import { COULEURS, COULEURS_CARTE } from '../src/jetons.js'

/**
 * Un mesureur déterministe : chaque lettre fait la moitié de la taille de la
 * police. Ce n'est pas la vraie métrique d'une police système — c'en est une
 * qui se calcule de tête, ce qui permet de vérifier les positions au pixel.
 */
const MESUREUR: Mesureur = {
  largeur(texte, police) {
    const taille = Number(/(\d+(?:\.\d+)?)px/.exec(police)?.[1] ?? 10)
    return [...texte].length * taille * 0.5
  },
}

function item(n: string, p: Partial<CardItem> = {}): CardItem {
  return { n, ok: false, warn: false, val: null, ...p }
}

const CARTE: CardSpec = {
  kicker: 'CARNET DE NJANGI',
  title: 'Njangi Nkolbisson',
  sub: 'Cotisation 5 000 F · 4 membres',
  tag: 'S36',
  bigLabel: 'COLLECTÉ CETTE SEMAINE',
  big: '10 000 F',
  pct: 0.5,
  subline: '2 sur 4 ont versé · reste 10 000 F',
  listTitle: 'ÉTAT DES VERSEMENTS',
  items: [
    item('Mama Céline', { ok: true, val: '5 000 F' }),
    item('Ernest — reçoit ce tour', { ok: true, val: '5 000 F' }),
    item('Adèle', { warn: true, val: '—' }),
    item('Serge', { warn: true, val: '—' }),
  ],
  link: 'atl.cm/n/ZBV3?t=36',
  stamp: 'Arrêté le 9 septembre 2026 à 08h45',
}

function composer(spec: CardSpec = CARTE) {
  return composerCarte(spec, MESUREUR)
}

type PrimitiveTexte = Extract<Primitive, { type: 'texte' }>
type PrimitiveRect = Extract<Primitive, { type: 'rect' }>
type PrimitiveCercle = Extract<Primitive, { type: 'cercle' }>

const estTexte = (p: Primitive): p is PrimitiveTexte => p.type === 'texte'
const estRect = (p: Primitive): p is PrimitiveRect => p.type === 'rect'
const estCercle = (p: Primitive): p is PrimitiveCercle => p.type === 'cercle'

function textes(primitives: readonly Primitive[]): string[] {
  return primitives.filter(estTexte).map((p) => p.texte)
}

/** Le texte cherché, ou une erreur claire : un `undefined` ne dit rien. */
function texteDit(primitives: readonly Primitive[], texte: string): PrimitiveTexte {
  const trouve = primitives.filter(estTexte).find((p) => p.texte === texte)
  if (trouve === undefined) throw new Error(`aucune primitive ne dit « ${texte} »`)
  return trouve
}

/** Les deux rectangles de la barre d'avancement, reconnaissables à leur hauteur. */
function barres(primitives: readonly Primitive[]): PrimitiveRect[] {
  return primitives.filter(estRect).filter((r) => r.h === 20)
}

describe('ajusterTaille', () => {
  it('laisse la taille demandée quand le texte tient', () => {
    expect(ajusterTaille(MESUREUR, 'court', 1000, 60, 'serif', 700)).toBe(60)
  })

  it('réduit par pas de 2 jusqu’à ce que ça tienne', () => {
    // 20 lettres × taille × 0,5 ≤ 400 → taille ≤ 40
    expect(ajusterTaille(MESUREUR, 'x'.repeat(20), 400, 60, 'serif', 700)).toBe(40)
  })

  it('ne descend jamais sous 20 px, même si ça déborde', () => {
    expect(ajusterTaille(MESUREUR, 'x'.repeat(500), 100, 60, 'serif', 700)).toBe(20)
  })
})

describe('tronquer', () => {
  it('laisse passer ce qui tient', () => {
    expect(tronquer(MESUREUR, 'court', 1000, '500 20px sans-serif')).toBe('court')
  })

  it('coupe et pose une ellipse', () => {
    const coupe = tronquer(MESUREUR, 'abcdefghij', 30, '500 10px sans-serif')
    expect(coupe.endsWith('…')).toBe(true)
    expect(coupe.length).toBeLessThan('abcdefghij'.length)
  })

  it('garde au moins une lettre', () => {
    expect(tronquer(MESUREUR, 'abcdef', 1, '500 10px sans-serif')).toBe('a…')
  })
})

describe('largeurInterlettree', () => {
  it('ajoute l’espacement entre les lettres, pas après la dernière', () => {
    // 3 lettres × 10 × 0,5 = 15, plus 2 intervalles de 4 = 23
    expect(largeurInterlettree(MESUREUR, 'abc', '800 10px sans-serif', 4)).toBe(23)
  })

  it('rend zéro sur une chaîne vide', () => {
    expect(largeurInterlettree(MESUREUR, '', '800 10px sans-serif', 4)).toBe(0)
  })
})

describe('hauteurCarte — elle grandit avec la liste, entre deux bornes', () => {
  it('tient le plancher carré sur une liste courte', () => {
    // 660 + 26 + n × 52 + 40 + 150 : en dessous de quatre entrées, le plancher gagne.
    expect(hauteurCarte(0, false)).toBe(HAUTEUR_MIN)
    expect(hauteurCarte(3, false)).toBe(HAUTEUR_MIN)
  })

  it('grandit dès la quatrième entrée', () => {
    expect(hauteurCarte(4, false)).toBe(1084)
    expect(hauteurCarte(9, false)).toBeGreaterThan(hauteurCarte(4, false))
  })

  it('compte la ligne « + N autres » dans sa hauteur', () => {
    expect(hauteurCarte(4, true)).toBe(hauteurCarte(4, false) + 46)
  })

  it('ne dépasse pas le plafond, qui tient le budget de 200 Ko', () => {
    expect(hauteurCarte(MAX_ITEMS_CARTE, true)).toBeLessThanOrEqual(HAUTEUR_MAX)
    expect(hauteurCarte(99, true)).toBe(HAUTEUR_MAX)
  })
})

describe('composerCarte', () => {
  const { largeur, hauteur, primitives } = composer()

  it('rend une carte de 1080 de large, haute de ce qu’il faut', () => {
    expect(largeur).toBe(LARGEUR_CARTE)
    expect(hauteur).toBe(hauteurCarte(4, false))
  })

  it('pose le fond avant tout le reste', () => {
    expect(primitives[0]).toEqual({ type: 'fond', couleur: COULEURS.fond })
  })

  it('écrit tous les textes de la spécification', () => {
    const t = textes(primitives)
    expect(t).toContain('CARNET DE NJANGI')
    expect(t).toContain('Njangi Nkolbisson')
    expect(t).toContain('S36')
    expect(t).toContain('COLLECTÉ CETTE SEMAINE')
    expect(t).toContain('10 000 F')
    expect(t).toContain('ÉTAT DES VERSEMENTS')
    expect(t).toContain('atl.cm/n/ZBV3?t=36')
    expect(t).toContain('Arrêté le 9 septembre 2026 à 08h45')
    expect(t).toContain('ATELIER 237')
  })

  it('coche ce qui est versé et cercle ce qui manque', () => {
    const cercles = primitives.filter(estCercle)
    expect(cercles.filter((c) => c.rempli)).toHaveLength(2)
    expect(cercles.filter((c) => !c.rempli && c.couleur === COULEURS.alerte)).toHaveLength(2)
  })

  it('colore le nom d’un retardataire en alerte', () => {
    expect(texteDit(primitives, 'Adèle').couleur).toBe(COULEURS.alerte)
  })

  it('aligne la valeur à droite de la marge', () => {
    const valeurs = primitives.filter(estTexte).filter((p) => p.texte === '5 000 F')
    expect(valeurs).toHaveLength(2)
    for (const v of valeurs) {
      // 7 caractères × 28 × 0,5 = 98 ; 1080 − 68 − 98 = 914
      expect(v.x).toBe(914)
    }
  })

  it('signe la carte en bas à droite', () => {
    const signature = texteDit(primitives, 'ATELIER 237')
    expect(signature).toMatchObject({ couleur: COULEURS_CARTE.filigrane, interlettre: 4 })
    expect(signature.x).toBeLessThan(LARGEUR_CARTE - 68)
  })
})

describe('la barre d’avancement', () => {
  it('n’est dessinée que quand la progression a un sens', () => {
    expect(barres(composer().primitives)).toHaveLength(2)
    expect(barres(composer({ ...CARTE, pct: null }).primitives)).toHaveLength(0)
  })

  it('remplit la moitié à 50 %', () => {
    const [fond, avance] = barres(composer().primitives)
    expect(fond?.l).toBe(944)
    expect(avance?.l).toBe(472)
  })

  it('reste visible à 1 %, et ne déborde pas au-delà de 100 %', () => {
    expect(barres(composer({ ...CARTE, pct: 0.001 }).primitives)[1]?.l).toBe(20)
    expect(barres(composer({ ...CARTE, pct: 3 }).primitives)[1]?.l).toBe(944)
  })
})

describe('la pastille de tour', () => {
  it('n’apparaît pas quand il n’y a pas de tour', () => {
    expect(textes(composer({ ...CARTE, tag: null }).primitives)).not.toContain('S36')
  })

  it('s’élargit avec son contenu', () => {
    const pastille = composer().primitives.filter(estRect).find((r) => r.r === 27)
    // 3 caractères × 27 × 0,5 = 40,5, plus 44 de marge
    expect(pastille?.l).toBeCloseTo(84.5, 5)
  })
})

describe('la liste est plafonnée', () => {
  const beaucoup: CardSpec = {
    ...CARTE,
    items: Array.from({ length: 23 }, (_, i) => item(`Membre ${i + 1}`, { ok: true, val: '5 000 F' })),
  }

  it('ne dessine que dix entrées', () => {
    const { primitives } = composer(beaucoup)
    const t = textes(primitives)
    expect(t).toContain('Membre 1')
    expect(t).toContain(`Membre ${MAX_ITEMS_CARTE}`)
    expect(t).not.toContain(`Membre ${MAX_ITEMS_CARTE + 1}`)
  })

  it('annonce le reste au lieu de le taire', () => {
    expect(textes(composer(beaucoup).primitives)).toContain('+ 13 autres')
  })

  it('n’annonce rien quand tout tient', () => {
    expect(textes(composer().primitives).some((t) => t.startsWith('+ '))).toBe(false)
  })
})

describe('les débordements de texte', () => {
  it('rapetissent un titre trop long plutôt que de le couper', () => {
    const long = 'Njangi des vendeuses du marché central de Nkolbisson et environs'
    const titre = texteDit(composer({ ...CARTE, title: long }).primitives, long)
    expect(/(\d+)px/.exec(titre.police)?.[1]).not.toBe('60')
  })

  it('tronquent un nom de membre trop long', () => {
    const long = 'Marie-Claire Épouse Ngo Bell Née Manga Bekombo Du Quartier'
    const t = textes(composer({ ...CARTE, items: [item(long, { val: '5 000 F' })] }).primitives)
    expect(t).not.toContain(long)
    expect(t.some((x) => x.startsWith('Marie-Claire') && x.endsWith('…'))).toBe(true)
  })

  it('tronquent un lien trop long', () => {
    const long = `atl.cm/n/${'x'.repeat(200)}`
    expect(textes(composer({ ...CARTE, link: long }).primitives)).not.toContain(long)
  })
})

describe('aucune coordonnée n’est absurde', () => {
  it.each([
    ['carte pleine', CARTE],
    ['carte vide', { ...CARTE, items: [], tag: null, pct: null }],
    ['tout à zéro', { ...CARTE, big: '0 F', pct: 0, items: [item('Seule')] }],
  ] as const)('%s : que des nombres finis, dans la carte', (_cas, spec) => {
    const { largeur, hauteur, primitives } = composer(spec)
    for (const o of primitives) {
      for (const [clef, valeur] of Object.entries(o)) {
        if (typeof valeur !== 'number') continue
        expect(Number.isFinite(valeur), `${o.type}.${clef}`).toBe(true)
      }
      if (o.type === 'rect') {
        expect(o.l).toBeGreaterThanOrEqual(0)
        expect(o.h).toBeGreaterThanOrEqual(0)
      }
      if (o.type === 'texte') {
        expect(o.x).toBeGreaterThanOrEqual(0)
        expect(o.y).toBeGreaterThan(0)
        expect(o.y).toBeLessThanOrEqual(hauteur)
        expect(o.x).toBeLessThan(largeur)
      }
    }
  })
})

// ───────────────────────── exécution des primitives ─────────────────────────

interface Appel {
  readonly nom: string
  readonly args: readonly unknown[]
}

function contexteEnregistreur(): ContexteDessin & { readonly appels: Appel[] } {
  const appels: Appel[] = []
  const noter = (nom: string) => (...args: unknown[]) => {
    appels.push({ nom, args })
  }
  return {
    appels,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineCap: 'butt',
    lineJoin: 'miter',
    font: '',
    textBaseline: 'alphabetic',
    textAlign: 'left',
    fillRect: noter('fillRect'),
    beginPath: noter('beginPath'),
    closePath: noter('closePath'),
    moveTo: noter('moveTo'),
    lineTo: noter('lineTo'),
    arc: noter('arc'),
    arcTo: noter('arcTo'),
    fill: noter('fill'),
    stroke: noter('stroke'),
    fillText: (texte: string, x: number, y: number) => {
      appels.push({ nom: 'fillText', args: [texte, x, y] })
    },
    measureText: (texte: string) => ({ width: [...texte].length * 5 }),
  }
}

describe('dessiner exécute les ordres, et rien de plus', () => {
  it('remplit le fond sur toute la surface', () => {
    const ctx = contexteEnregistreur()
    dessiner(ctx, 1080, 1080, [{ type: 'fond', couleur: '#FFF' }])
    expect(ctx.appels).toEqual([{ nom: 'fillRect', args: [0, 0, 1080, 1080] }])
  })

  it('trace un rectangle droit sans passer par un chemin', () => {
    const ctx = contexteEnregistreur()
    dessiner(ctx, 10, 10, [{ type: 'rect', x: 1, y: 2, l: 3, h: 4, couleur: '#000' }])
    expect(ctx.appels.map((a) => a.nom)).toEqual(['fillRect'])
  })

  it('passe par un chemin pour un rectangle arrondi', () => {
    const ctx = contexteEnregistreur()
    dessiner(ctx, 10, 10, [{ type: 'rect', x: 1, y: 2, l: 3, h: 4, r: 2, couleur: '#000' }])
    expect(ctx.appels.map((a) => a.nom)).toEqual([
      'beginPath', 'moveTo', 'arcTo', 'arcTo', 'arcTo', 'arcTo', 'closePath', 'fill',
    ])
  })

  it('remplit ou contourne un cercle selon la demande', () => {
    const plein = contexteEnregistreur()
    dessiner(plein, 10, 10, [{ type: 'cercle', x: 1, y: 1, r: 5, couleur: '#000', rempli: true }])
    expect(plein.appels.map((a) => a.nom)).toEqual(['beginPath', 'arc', 'fill'])

    const vide = contexteEnregistreur()
    dessiner(vide, 10, 10, [
      { type: 'cercle', x: 1, y: 1, r: 5, couleur: '#000', rempli: false, epaisseur: 3 },
    ])
    expect(vide.appels.map((a) => a.nom)).toEqual(['beginPath', 'arc', 'stroke'])
    expect(vide.lineWidth).toBe(3)
  })

  it('relie les points d’un trait', () => {
    const ctx = contexteEnregistreur()
    dessiner(ctx, 10, 10, [
      { type: 'trait', points: [[0, 0], [1, 1], [2, 0]], couleur: '#000', epaisseur: 2 },
    ])
    expect(ctx.appels.map((a) => a.nom)).toEqual(['beginPath', 'moveTo', 'lineTo', 'lineTo', 'stroke'])
  })

  it('ignore un trait sans point plutôt que de casser', () => {
    const ctx = contexteEnregistreur()
    dessiner(ctx, 10, 10, [{ type: 'trait', points: [], couleur: '#000', epaisseur: 2 }])
    expect(ctx.appels).toEqual([])
  })

  it('pose un texte ordinaire d’un seul appel', () => {
    const ctx = contexteEnregistreur()
    dessiner(ctx, 10, 10, [
      { type: 'texte', x: 5, y: 9, texte: 'abc', police: '500 10px sans-serif', couleur: '#000' },
    ])
    expect(ctx.appels).toEqual([{ nom: 'fillText', args: ['abc', 5, 9] }])
    expect(ctx.font).toBe('500 10px sans-serif')
  })

  it('pose un texte interlettré lettre par lettre', () => {
    const ctx = contexteEnregistreur()
    dessiner(ctx, 10, 10, [
      {
        type: 'texte', x: 0, y: 9, texte: 'abc', police: '800 10px sans-serif',
        couleur: '#000', interlettre: 4,
      },
    ])
    expect(ctx.appels.map((a) => a.args)).toEqual([
      ['a', 0, 9],
      ['b', 9, 9],
      ['c', 18, 9],
    ])
  })

  it('règle la ligne de base et l’alignement une seule fois', () => {
    const ctx = contexteEnregistreur()
    dessiner(ctx, 10, 10, [])
    expect(ctx.textBaseline).toBe('alphabetic')
    expect(ctx.textAlign).toBe('left')
    expect(ctx.appels).toEqual([])
  })

  it('exécute une carte entière sans lever', () => {
    const ctx = contexteEnregistreur()
    const { largeur, hauteur, primitives } = composer()
    expect(() => dessiner(ctx, largeur, hauteur, primitives)).not.toThrow()
    expect(ctx.appels.length).toBeGreaterThan(40)
  })
})

describe('mesureurDe', () => {
  it('règle la police avant de mesurer', () => {
    const ctx = contexteEnregistreur()
    const mesureur = mesureurDe(ctx)
    expect(mesureur.largeur('abcd', '700 29px monospace')).toBe(20)
    expect(ctx.font).toBe('700 29px monospace')
  })
})

describe('dessinerCarte et cartePng, sans vrai canvas', () => {
  /**
   * Un canvas de papier : il suffit à vérifier le câblage — obtention du
   * contexte, dimensionnement, encodage. Ce qui reste non couvert après ça,
   * c'est le moteur de rendu du navigateur, qu'aucun test ne remplace. La carte
   * devra être regardée à l'œil sur un vrai téléphone avant la phase 2.
   */
  function canvasDePapier(ctx: ContexteDessin | null) {
    return {
      width: 0,
      height: 0,
      getContext: () => ctx,
      toBlob: (rappel: (b: Blob | null) => void) => {
        rappel(new Blob(['png'], { type: 'image/png' }))
      },
    }
  }

  it('dimensionne le canvas à la carte, puis dessine', () => {
    const ctx = contexteEnregistreur()
    const canvas = canvasDePapier(ctx)
    dessinerCarte(canvas as unknown as HTMLCanvasElement, CARTE)
    expect(canvas.width).toBe(LARGEUR_CARTE)
    expect(canvas.height).toBe(hauteurCarte(4, false))
    expect(ctx.appels.length).toBeGreaterThan(40)
  })

  it('mesure avec le vrai contexte, donc avec les vraies polices', () => {
    const ctx = contexteEnregistreur()
    dessinerCarte(canvasDePapier(ctx) as unknown as HTMLCanvasElement, CARTE)
    // Le mesureur du contexte donne 5 px par lettre : la troncature s'y adapte.
    expect(ctx.appels.some((a) => a.nom === 'fillText')).toBe(true)
  })

  it('le dit au lieu de publier une carte blanche quand le contexte manque', () => {
    expect(() => dessinerCarte(canvasDePapier(null) as unknown as HTMLCanvasElement, CARTE))
      .toThrow('contexte 2D indisponible')
  })

  it('rend un blob PNG', async () => {
    const blob = await cartePng(canvasDePapier(contexteEnregistreur()) as unknown as HTMLCanvasElement)
    expect(blob.type).toBe('image/png')
  })

  it('rejette plutôt que de rendre un blob vide', async () => {
    const muet = {
      toBlob: (rappel: (b: Blob | null) => void) => {
        rappel(null)
      },
    }
    await expect(cartePng(muet as unknown as HTMLCanvasElement)).rejects.toThrow(
      'encodage PNG impossible',
    )
  })
})
