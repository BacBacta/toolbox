import { nf } from '@a237/engine'
import type { JSX } from 'preact'

/**
 * Histogramme en SVG inline.
 *
 * Pas de bibliothèque de graphiques : l'invariant § 2.6 l'interdit, et il n'y a
 * rien ici qui ne tienne en quarante lignes. Porté depuis
 * `reference/atelier-prototype.html:563`, avec une correction : le prototype
 * allait chercher ses couleurs avec `getComputedStyle`, ce qui lit le DOM et
 * rend le composant intestable.
 *
 * Les couleurs passent par des variables CSS. Un `fill="var(--accent)"` est
 * résolu par le navigateur dans le SVG comme ailleurs : le graphique suit donc
 * le thème clair ou sombre sans une ligne de JavaScript, et le composant reste
 * testable puisqu'il ne lit rien.
 *
 * Le SVG a un `viewBox` et pas de dimensions fixes : il s'adapte à la largeur
 * du téléphone sans calcul.
 */

export interface BarreGraphique {
  readonly etiquette: string
  readonly valeur: number
}

export function Histogramme(props: {
  readonly donnees: readonly BarreGraphique[]
  readonly titre: string
  readonly hauteur?: number
}): JSX.Element | null {
  const donnees = props.donnees
  if (donnees.length === 0) return null

  const L = 6
  const R = 6
  const HAUT = 16
  const BAS = 18
  const W = 320
  const H = props.hauteur ?? 106

  // Le maximum ne descend jamais sous 1 : sinon une série entièrement nulle
  // diviserait par zéro et toutes les barres monteraient au plafond.
  const max = Math.max(1, ...donnees.map((d) => d.valeur))
  const creneau = (W - L - R) / donnees.length
  const largeur = Math.min(30, creneau * 0.58)

  return (
    <svg
      class="outil-graphique"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={props.titre}
      preserveAspectRatio="xMidYMid meet"
    >
      <line
        x1={L}
        y1={H - BAS}
        x2={W - R}
        y2={H - BAS}
        stroke="var(--trait)"
        stroke-width="1"
      />
      {donnees.map((d, i) => {
        const cx = L + creneau * i + creneau / 2
        const h = (H - HAUT - BAS) * (d.valeur / max)
        const y = H - BAS - h
        return (
          <g key={`${i}-${d.etiquette}`}>
            <rect
              x={(cx - largeur / 2).toFixed(1)}
              y={y.toFixed(1)}
              width={largeur.toFixed(1)}
              height={Math.max(2, h).toFixed(1)}
              rx="3"
              fill="var(--accent)"
            />
            {d.valeur > 0 && (
              <text
                x={cx.toFixed(1)}
                y={(y - 4).toFixed(1)}
                text-anchor="middle"
                font-size="8.5"
                fill="var(--encre)"
              >
                {nf(d.valeur)}
              </text>
            )}
            <text
              x={cx.toFixed(1)}
              y={H - 5}
              text-anchor="middle"
              font-size="8.5"
              fill="var(--encre-3)"
            >
              {d.etiquette}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
