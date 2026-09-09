import type { CardSpec } from '@a237/engine'
import { limiterItems, texteReste } from '@a237/engine'
import { COULEURS_CARTE } from '../jetons.js'

/**
 * La carte partagée, en ordres de dessin.
 *
 * Le prototype dessinait directement dans le contexte canvas
 * (`reference/atelier-prototype.html:1181`) : cent vingt lignes où la
 * géométrie, les couleurs et les appels de dessin sont mélangés, et que rien
 * ne peut vérifier sans navigateur.
 *
 * Ici tout le calcul est pur et rend une liste de primitives. Le canvas n'a
 * plus qu'à les exécuter (`canvas.ts`, une quarantaine de lignes triviales).
 * Résultat : les positions, les troncatures, la hauteur variable et le
 * plafonnement de la liste sont testés sans navigateur, et l'unique chose qui
 * ne l'est pas est la boucle d'exécution.
 *
 * La mesure du texte reste au canvas — c'est lui qui connaît les polices — mais
 * elle passe par une interface, donc les tests injectent leur propre règle.
 */

/** Ce que la géométrie a besoin de savoir du texte. */
export interface Mesureur {
  /** Largeur en pixels de `texte` rendu avec la police CSS `police`. */
  largeur(texte: string, police: string): number
}

export type Primitive =
  | { readonly type: 'fond'; readonly couleur: string }
  | {
      readonly type: 'rect'
      readonly x: number
      readonly y: number
      readonly l: number
      readonly h: number
      readonly couleur: string
      /** Rayon des coins. Absent ou 0 : coins droits. */
      readonly r?: number
    }
  | {
      readonly type: 'cercle'
      readonly x: number
      readonly y: number
      readonly r: number
      readonly couleur: string
      readonly rempli: boolean
      readonly epaisseur?: number
    }
  | {
      readonly type: 'trait'
      readonly points: readonly (readonly [number, number])[]
      readonly couleur: string
      readonly epaisseur: number
    }
  | {
      readonly type: 'texte'
      readonly x: number
      readonly y: number
      readonly texte: string
      readonly police: string
      readonly couleur: string
      /** Espacement supplémentaire entre les lettres, en pixels. */
      readonly interlettre?: number
    }

// ─────────────────────────────── constantes ───────────────────────────────

/**
 * Aucune police web : on prend ce que le téléphone a déjà (invariant § 2.6).
 * Le prototype chargeait Figtree, Fraunces et DM Mono — trois requêtes et
 * plusieurs dizaines de kilo-octets pour une image qu'on veut sous 200 Ko.
 */
export const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
export const SERIF = 'Georgia, "Times New Roman", serif'
export const MONO = 'ui-monospace, "DejaVu Sans Mono", monospace'

export const LARGEUR_CARTE = 1080
export const HAUTEUR_MIN = 1080
export const HAUTEUR_MAX = 1400

const M = 68
const HAUT_BANDEAU = 300
const DEPART_LISTE = 660
const HAUT_RANGEE = 52
const HAUT_PIED = 150
/** Place réservée à droite du titre pour la pastille de tour. */
const RESERVE_PASTILLE = 160

function police(graisse: number, taille: number, famille: string): string {
  return `${graisse} ${taille}px ${famille}`
}

/**
 * Réduit la taille jusqu'à ce que le texte tienne, sans descendre sous 20 px :
 * en deçà c'est illisible sur un écran de téléphone, mieux vaut déborder que
 * mentir sur la lisibilité.
 */
export function ajusterTaille(
  mesureur: Mesureur,
  texte: string,
  largeurMax: number,
  taille: number,
  famille: string,
  graisse: number,
): number {
  let t = taille
  while (t > 20 && mesureur.largeur(texte, police(graisse, t, famille)) > largeurMax) {
    t -= 2
  }
  return t
}

/** Coupe et suffixe d'une ellipse ce qui déborde. */
export function tronquer(
  mesureur: Mesureur,
  texte: string,
  largeurMax: number,
  policeCss: string,
): string {
  if (mesureur.largeur(texte, policeCss) <= largeurMax) return texte
  let court = texte
  while (court.length > 1 && mesureur.largeur(`${court}…`, policeCss) > largeurMax) {
    court = court.slice(0, -1)
  }
  return `${court}…`
}

/** Largeur d'un texte dessiné lettre à lettre avec un interlettrage. */
export function largeurInterlettree(
  mesureur: Mesureur,
  texte: string,
  policeCss: string,
  interlettre: number,
): number {
  if (texte === '') return 0
  const lettres = [...texte].reduce((a, l) => a + mesureur.largeur(l, policeCss), 0)
  return lettres + interlettre * ([...texte].length - 1)
}

/**
 * Hauteur de la carte : elle grandit avec la liste, entre deux bornes.
 *
 * Le plancher tient le format carré que WhatsApp recadre proprement ; le
 * plafond empêche une carte de trente membres de dépasser le budget de 200 Ko.
 */
export function hauteurCarte(nbItems: number, avecReste: boolean): number {
  const brute = DEPART_LISTE + 26 + nbItems * HAUT_RANGEE + (avecReste ? 46 : 0) + 40 + HAUT_PIED
  return Math.max(HAUTEUR_MIN, Math.min(HAUTEUR_MAX, brute))
}

// ──────────────────────────────── composition ────────────────────────────────

/** Les ordres de dessin d'une carte, de l'arrière-plan au filigrane. */
export function composerCarte(spec: CardSpec, mesureur: Mesureur): {
  readonly largeur: number
  readonly hauteur: number
  readonly primitives: readonly Primitive[]
} {
  const { visibles, reste } = limiterItems(spec.items)
  const H = hauteurCarte(visibles.length, reste > 0)
  const W = LARGEUR_CARTE
  const p: Primitive[] = []

  p.push({ type: 'fond', couleur: COULEURS_CARTE.fond })

  // ── bandeau de tête ──
  p.push({ type: 'rect', x: 0, y: 0, l: W, h: HAUT_BANDEAU, couleur: COULEURS_CARTE.accent })
  p.push({ type: 'rect', x: 0, y: 0, l: 10, h: HAUT_BANDEAU, couleur: COULEURS_CARTE.accentSombre })

  p.push({
    type: 'texte',
    x: M,
    y: 86,
    texte: spec.kicker,
    police: police(800, 23, SANS),
    couleur: 'rgba(255,255,255,.60)',
    interlettre: 4.4,
  })

  const largeurTitre = W - M * 2 - RESERVE_PASTILLE
  const tailleTitre = ajusterTaille(mesureur, spec.title, largeurTitre, 60, SERIF, 700)
  p.push({
    type: 'texte',
    x: M,
    y: 172,
    texte: spec.title,
    police: police(700, tailleTitre, SERIF),
    couleur: '#FFFFFF',
  })

  const policeSous = police(500, 28, SANS)
  p.push({
    type: 'texte',
    x: M,
    y: 222,
    texte: tronquer(mesureur, spec.sub, largeurTitre, policeSous),
    police: policeSous,
    couleur: 'rgba(255,255,255,.82)',
  })

  if (spec.tag !== null) {
    const policeTag = police(700, 27, MONO)
    const largeur = mesureur.largeur(spec.tag, policeTag) + 44
    p.push({
      type: 'rect',
      x: W - M - largeur,
      y: 64,
      l: largeur,
      h: 54,
      r: 27,
      couleur: 'rgba(255,255,255,.17)',
    })
    p.push({
      type: 'texte',
      x: W - M - largeur / 2 - mesureur.largeur(spec.tag, policeTag) / 2,
      y: 101,
      texte: spec.tag,
      police: policeTag,
      couleur: '#FFFFFF',
    })
  }

  // ── le chiffre qui compte ──
  p.push({
    type: 'texte',
    x: M,
    y: 376,
    texte: spec.bigLabel,
    police: police(800, 22, SANS),
    couleur: COULEURS_CARTE.encre3,
    interlettre: 4.2,
  })

  /*
   * Le montant de tête est en linéale, pas en chasse fixe.
   *
   * La chasse fixe sert à aligner une colonne de chiffres — c'est pour ça que
   * les valeurs de lignes la gardent plus bas. Ici il n'y a qu'un nombre, seul
   * et grand : la chasse fixe lui met des blancs entre les chiffres et lui
   * donne l'air d'une sortie de terminal, à côté du serif du titre.
   */
  const tailleBig = ajusterTaille(mesureur, spec.big, W - M * 2, 112, SANS, 800)
  p.push({
    type: 'texte',
    x: M,
    y: 480,
    texte: spec.big,
    police: police(800, tailleBig, SANS),
    couleur: COULEURS_CARTE.accent,
    interlettre: -1.5,
  })

  if (spec.pct !== null) {
    const part = Math.max(0, Math.min(1, spec.pct))
    p.push({ type: 'rect', x: M, y: 516, l: W - M * 2, h: 20, r: 10, couleur: COULEURS_CARTE.trait })
    p.push({
      type: 'rect',
      x: M,
      y: 516,
      // Un minimum de 20 px : à 1 % une barre d'un pixel ne se voit pas.
      l: Math.max(20, (W - M * 2) * part),
      h: 20,
      r: 10,
      couleur: COULEURS_CARTE.accent,
    })
  }

  const policeSousLigne = police(500, 27, SANS)
  p.push({
    type: 'texte',
    x: M,
    y: 586,
    texte: tronquer(mesureur, spec.subline, W - M * 2, policeSousLigne),
    police: policeSousLigne,
    couleur: COULEURS_CARTE.encre2,
  })

  // ── la liste ──
  let y = DEPART_LISTE
  p.push({
    type: 'texte',
    x: M,
    y,
    texte: spec.listTitle,
    police: police(800, 21, SANS),
    couleur: COULEURS_CARTE.encre3,
    interlettre: 4.2,
  })
  y += 26

  const policeValeur = police(600, 28, MONO)
  for (const item of visibles) {
    p.push({
      type: 'trait',
      points: [
        [M, y + 0.5],
        [W - M, y + 0.5],
      ],
      couleur: COULEURS_CARTE.trait,
      epaisseur: 2,
    })
    y += HAUT_RANGEE - 8

    const cx = M + 17
    const cy = y - 16
    if (item.ok) {
      p.push({ type: 'cercle', x: cx, y: cy, r: 15, couleur: COULEURS_CARTE.accent, rempli: true })
      p.push({
        type: 'trait',
        points: [
          [cx - 6.5, cy + 0.5],
          [cx - 1.5, cy + 5.5],
          [cx + 7, cy - 5.5],
        ],
        couleur: '#FFFFFF',
        epaisseur: 4.5,
      })
    } else {
      p.push({
        type: 'cercle',
        x: cx,
        y: cy,
        r: 13,
        couleur: item.warn ? COULEURS_CARTE.alerte : COULEURS_CARTE.cercleVide,
        rempli: false,
        epaisseur: 3.5,
      })
    }

    const largeurValeur =
      item.val === null ? 0 : mesureur.largeur(item.val, policeValeur) + 34
    const policeNom = police(item.ok ? 600 : 500, 30, SANS)
    p.push({
      type: 'texte',
      x: M + 52,
      y: y - 6,
      texte: tronquer(mesureur, item.n, W - M * 2 - 52 - largeurValeur, policeNom),
      police: policeNom,
      couleur: item.ok ? COULEURS_CARTE.encre : item.warn ? COULEURS_CARTE.alerte : COULEURS_CARTE.encre2,
    })

    if (item.val !== null) {
      p.push({
        type: 'texte',
        x: W - M - mesureur.largeur(item.val, policeValeur),
        y: y - 6,
        texte: item.val,
        police: policeValeur,
        couleur: item.ok ? COULEURS_CARTE.accent : item.warn ? COULEURS_CARTE.alerte : COULEURS_CARTE.encre3,
      })
    }
    y += 8
  }

  p.push({
    type: 'trait',
    points: [
      [M, y + 0.5],
      [W - M, y + 0.5],
    ],
    couleur: COULEURS_CARTE.trait,
    epaisseur: 2,
  })

  const mentionReste = texteReste(reste)
  if (mentionReste !== null) {
    y += 42
    p.push({
      type: 'texte',
      x: M,
      y: y - 8,
      texte: mentionReste,
      police: police(500, 26, SANS),
      couleur: COULEURS_CARTE.encre3,
    })
  }

  // ── pied ──
  p.push({ type: 'rect', x: 0, y: H - HAUT_PIED, l: W, h: HAUT_PIED, couleur: COULEURS_CARTE.bandeau })
  p.push({ type: 'rect', x: 0, y: H - HAUT_PIED, l: W, h: 3, couleur: COULEURS_CARTE.bandeauTrait })

  // Un lien vide veut dire « pas encore publié ». On n'imprime pas une adresse
  // qui n'existe pas sur une image que quelqu'un va faire circuler.
  if (spec.link !== '') {
    const policeLien = police(700, 29, MONO)
    p.push({
      type: 'texte',
      x: M,
      y: H - 84,
      texte: tronquer(mesureur, spec.link, W - M * 2 - 240, policeLien),
      police: policeLien,
      couleur: COULEURS_CARTE.accent,
    })
  }

  const policeHorodatage = police(500, 23, SANS)
  p.push({
    type: 'texte',
    x: M,
    y: H - 42,
    texte: tronquer(mesureur, spec.stamp, W - M * 2 - 240, policeHorodatage),
    police: policeHorodatage,
    couleur: COULEURS_CARTE.encre3,
  })

  const policeFiligrane = police(800, 20, SANS)
  const filigrane = 'ATELIER 237'
  p.push({
    type: 'texte',
    x: W - M - largeurInterlettree(mesureur, filigrane, policeFiligrane, 4),
    y: H - 84,
    texte: filigrane,
    police: policeFiligrane,
    couleur: COULEURS_CARTE.filigrane,
    interlettre: 4,
  })

  return { largeur: W, hauteur: H, primitives: p }
}
