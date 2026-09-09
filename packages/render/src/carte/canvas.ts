import type { CardSpec } from '@a237/engine'
import { composerCarte } from './geometrie.js'
import type { Mesureur, Primitive } from './geometrie.js'

/**
 * L'exécution des ordres de dessin.
 *
 * Tout le calcul est dans `geometrie.ts`. Ce fichier ne décide de rien : il
 * traduit des primitives en appels canvas. C'est la seule partie du rendu de
 * carte qu'aucun test ne peut couvrir sans navigateur — d'où le soin à la
 * garder aussi bête que possible, et à la faire passer par une interface que
 * les tests peuvent doubler.
 *
 * La carte est dessinée **sur le téléphone du propriétaire**, jamais sur le
 * serveur (BRIEF.md § 3.1) : pas de rendu d'image côté serveur, pas de Satori,
 * pas de navigateur sans tête.
 */

/**
 * Le sous-ensemble de `CanvasRenderingContext2D` que le dessin emploie.
 *
 * `fillStyle` et `strokeStyle` gardent le type large du DOM — on n'y met jamais
 * que des chaînes, mais les restreindre ici empêcherait de passer un vrai
 * contexte, une propriété modifiable étant invariante.
 */
export interface ContexteDessin {
  fillStyle: string | CanvasGradient | CanvasPattern
  strokeStyle: string | CanvasGradient | CanvasPattern
  lineWidth: number
  lineCap: CanvasLineCap
  lineJoin: CanvasLineJoin
  font: string
  textBaseline: CanvasTextBaseline
  textAlign: CanvasTextAlign
  fillRect(x: number, y: number, l: number, h: number): void
  beginPath(): void
  closePath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  arc(x: number, y: number, r: number, debut: number, fin: number): void
  arcTo(x1: number, y1: number, x2: number, y2: number, r: number): void
  fill(): void
  stroke(): void
  fillText(texte: string, x: number, y: number): void
  measureText(texte: string): { readonly width: number }
}

/** Un mesureur adossé à un contexte canvas. */
export function mesureurDe(ctx: ContexteDessin): Mesureur {
  return {
    largeur(texte, police) {
      ctx.font = police
      return ctx.measureText(texte).width
    },
  }
}

function cheminRectArrondi(
  ctx: ContexteDessin,
  x: number,
  y: number,
  l: number,
  h: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + l, y, x + l, y + h, r)
  ctx.arcTo(x + l, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + l, y, r)
  ctx.closePath()
}

/** Exécute une liste d'ordres de dessin. */
export function dessiner(
  ctx: ContexteDessin,
  largeur: number,
  hauteur: number,
  primitives: readonly Primitive[],
): void {
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (const o of primitives) {
    switch (o.type) {
      case 'fond':
        ctx.fillStyle = o.couleur
        ctx.fillRect(0, 0, largeur, hauteur)
        break

      case 'rect':
        ctx.fillStyle = o.couleur
        if (o.r === undefined || o.r === 0) {
          ctx.fillRect(o.x, o.y, o.l, o.h)
        } else {
          cheminRectArrondi(ctx, o.x, o.y, o.l, o.h, o.r)
          ctx.fill()
        }
        break

      case 'cercle':
        ctx.beginPath()
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2)
        if (o.rempli) {
          ctx.fillStyle = o.couleur
          ctx.fill()
        } else {
          ctx.strokeStyle = o.couleur
          ctx.lineWidth = o.epaisseur ?? 1
          ctx.stroke()
        }
        break

      case 'trait': {
        const [depart, ...suite] = o.points
        if (depart === undefined) break
        ctx.strokeStyle = o.couleur
        ctx.lineWidth = o.epaisseur
        ctx.beginPath()
        ctx.moveTo(depart[0], depart[1])
        for (const [x, y] of suite) ctx.lineTo(x, y)
        ctx.stroke()
        break
      }

      case 'texte':
        ctx.font = o.police
        ctx.fillStyle = o.couleur
        if (o.interlettre === undefined || o.interlettre === 0) {
          ctx.fillText(o.texte, o.x, o.y)
        } else {
          // Le canvas ne sait pas interlettrer : on pose lettre par lettre.
          let x = o.x
          for (const lettre of o.texte) {
            ctx.fillText(lettre, x, o.y)
            x += ctx.measureText(lettre).width + o.interlettre
          }
        }
        break
    }
  }
}

/**
 * Dessine la carte dans un canvas, qu'elle redimensionne à ses besoins.
 *
 * @throws Error si le contexte 2D n'est pas disponible — mieux vaut le dire que
 *   rendre un canvas vide et publier une carte blanche.
 */
export function dessinerCarte(canvas: HTMLCanvasElement, spec: CardSpec): void {
  const ctx = canvas.getContext('2d')
  if (ctx === null) throw new Error('contexte 2D indisponible')

  const { largeur, hauteur, primitives } = composerCarte(spec, mesureurDe(ctx))
  // Fixer la taille remet le contexte à zéro : on le fait avant de dessiner.
  canvas.width = largeur
  canvas.height = hauteur
  dessiner(ctx, largeur, hauteur, primitives)
}

/**
 * Le PNG de la carte, prêt à être téléversé dans R2 puis pointé par `og:image`.
 *
 * @throws Error si le navigateur ne rend pas de blob.
 */
export async function cartePng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resoudre, rejeter) => {
    canvas.toBlob((blob) => {
      if (blob === null) rejeter(new Error('encodage PNG impossible'))
      else resoudre(blob)
    }, 'image/png')
  })
}
