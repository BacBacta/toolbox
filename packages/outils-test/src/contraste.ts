/**
 * Contraste WCAG, pour que « lisible » soit une mesure et non une impression.
 *
 * La cible est un Android d'entrée de gamme, souvent tenu en plein soleil, par
 * quelqu'un qui compte de l'argent. Un gris qui « fait joli » sur un écran de
 * bureau bien calibré peut y devenir illisible. Le rapport de contraste est le
 * seul garde-fou objectif qu'on ait.
 *
 * Seuils WCAG 2.1 niveau AA : 4,5 pour le texte courant, 3 pour le grand texte
 * (18,66 px en gras, ou 24 px) et pour les éléments d'interface — bordures de
 * champs, icônes porteuses de sens.
 */

export const AA_TEXTE = 4.5
export const AA_GRAND_TEXTE = 3
export const AA_INTERFACE = 3

/** `#1B5E43` → `[27, 94, 67]`. Accepte la forme courte `#abc`. */
export function composantes(hex: string): readonly [number, number, number] {
  const propre = hex.trim().replace('#', '')
  const complet =
    propre.length === 3
      ? propre
          .split('')
          .map((c) => c + c)
          .join('')
      : propre
  if (!/^[0-9a-fA-F]{6}$/.test(complet)) {
    throw new RangeError(`couleur illisible : « ${hex} »`)
  }
  return [
    Number.parseInt(complet.slice(0, 2), 16),
    Number.parseInt(complet.slice(2, 4), 16),
    Number.parseInt(complet.slice(4, 6), 16),
  ]
}

/** Luminance relative, formule WCAG. */
export function luminance(hex: string): number {
  const canal = (v: number): number => {
    const s = v / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const [r, v, b] = composantes(hex)
  return 0.2126 * canal(r) + 0.7152 * canal(v) + 0.0722 * canal(b)
}

/** Rapport de contraste entre deux couleurs, de 1 (identiques) à 21. */
export function contraste(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const clair = Math.max(la, lb)
  const sombre = Math.min(la, lb)
  return (clair + 0.05) / (sombre + 0.05)
}

/** Arrondi à une décimale, pour des messages d'échec lisibles. */
export function contrasteArrondi(a: string, b: string): number {
  return Math.round(contraste(a, b) * 10) / 10
}
