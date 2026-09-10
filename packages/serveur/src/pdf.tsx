import type { Instantane, RenderContext } from '@a237/engine'
import { render as enChaine } from 'preact-render-to-string'
import a4Css from '@a237/render/styles/a4.css?raw'
import { sansCommentaires } from './feuille.js'
import { documentDe } from './rendu.js'

/**
 * La page telle qu'elle part à l'imprimante, et rien d'autre.
 *
 * Ce n'est pas la page de lecture. Celle-là met la feuille à l'échelle de
 * l'écran, l'entoure d'un pied et d'une marque, et dit « document en lecture
 * seule » — trois choses qui n'ont rien à faire sur un papier qu'on remet à un
 * client. Ici, la feuille A4 à sa taille vraie, seule.
 *
 * Le rendu se fait **une fois, sur le serveur**. C'est ce qui répond au critère
 * du § 7 — « un même devis produit un PDF identique sur Windows, macOS et
 * Android » : le fichier porte les glyphes, et la machine qui l'ouvre n'a plus
 * rien à décider.
 *
 * La police est **nommée** et non devinée. À l'écran, `system-ui` est le bon
 * choix : c'est la police que le téléphone a déjà, elle ne se télécharge pas et
 * elle se lit comme le reste de l'appareil. Sur le serveur, `system-ui` est ce
 * que l'image du jour contient — aujourd'hui DejaVu Sans, demain autre chose,
 * et tous les devis changeraient d'allure sans que personne ait rien demandé.
 * On nomme donc la chaîne, en s'arrêtant sur des polices de mêmes métriques.
 */

const CSS = sansCommentaires(a4Css)

/**
 * `@page` dit à l'imprimante la taille de la feuille.
 *
 * Sans lui, le moteur choisit le format par défaut de sa locale — A4 ici,
 * Letter ailleurs — et une feuille dessinée en 210 × 297 mm se retrouve
 * recadrée. La marge est à zéro parce que la feuille porte déjà les siennes :
 * en ajouter une deuxième les additionnerait.
 */
const IMPRESSION = `
@page { size: 210mm 297mm; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
.a4 { font-family: "DejaVu Sans", "Liberation Sans", Arial, sans-serif; }
`

export interface PageImprimable {
  readonly html: string
  readonly nomFichier: string
}

/** Ce qui apparaît dans la boîte « enregistrer sous ». */
export function nomFichier(instantane: Instantane): string {
  const etat = instantane.etat as { numero?: unknown } | null
  const numero = typeof etat?.numero === 'string' ? etat.numero : ''
  /*
   * Le numéro plutôt que le nom, quand il y en a un : c'est lui qui distingue
   * deux devis du même client, et c'est lui qu'on cherche dans un dossier.
   */
  const base = numero !== '' ? `${instantane.skeleton}-${numero}` : instantane.skeleton
  /*
   * Le numéro vient de quelqu'un, donc il peut contenir n'importe quoi. Ce nom
   * ne sert qu'à la boîte « enregistrer sous », mais un `..` ou une barre
   * oblique y mettent mal à l'aise certains clients — on n'en laisse aucun.
   */
  const propre = base
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/^[-.]+|[-.]+$/g, '')
  return `${propre === '' ? 'document' : propre}.pdf`
}

/**
 * Rend `null` pour ce qui ne s'imprime pas.
 *
 * Les registres n'ont pas de feuille : leur lien mène à une carte, qui est un
 * résumé d'écran. Un PDF d'un résumé serait un papier qui ne sert à rien —
 * ni preuve, ni pièce comptable, ni chose qu'on classe.
 */
export function pageAImprimer(instantane: Instantane, ctx: RenderContext): PageImprimable | null {
  const document = documentDe(instantane, ctx)
  if (document === null) return null

  return {
    html:
      '<!doctype html><html lang="fr"><head><meta charset="utf-8">' +
      `<style>${CSS}${IMPRESSION}</style></head><body>${enChaine(document)}</body></html>`,
    nomFichier: nomFichier(instantane),
  }
}
