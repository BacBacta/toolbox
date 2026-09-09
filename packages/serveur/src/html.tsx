import type { Instantane, RenderContext } from '@a237/engine'
import { squeletteParId } from '@a237/engine'
import { render as enChaine } from 'preact-render-to-string'
import a4Css from '@a237/render/styles/a4.css?raw'
import lectureCss from './lecture.css?raw'
import { PageIntrouvable, PiedLecture } from './page.js'
import type { MetaPage } from './page.js'
import { VueCarte, carteDe, documentDe } from './rendu.js'

/**
 * La page complète, en une chaîne.
 *
 * Le CSS est **inliné** : une feuille séparée serait une requête de plus sur
 * une connexion qui hoquette, pour trois kilo-octets. Il n'y a aucun script,
 * donc rien à charger après le premier octet — la page est finie quand elle
 * arrive.
 */

/** Échappe ce qui part dans un attribut de métadonnée. */
function attr(valeur: string): string {
  return valeur
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function entete(meta: MetaPage): string {
  const lignes = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    `<title>${attr(meta.titre)}</title>`,
    `<meta name="description" content="${attr(meta.description)}">`,
    // Ce que WhatsApp lit pour son aperçu : c'est là que le lien devient un
    // tableau de bord au lieu d'une ligne bleue.
    '<meta property="og:type" content="website">',
    `<meta property="og:title" content="${attr(meta.titre)}">`,
    `<meta property="og:description" content="${attr(meta.description)}">`,
    `<meta property="og:url" content="${attr(meta.lien)}">`,
    '<meta property="og:site_name" content="Atelier 237">',
    ...(meta.image === undefined
      ? ['<meta name="twitter:card" content="summary">']
      : [
          `<meta property="og:image" content="${attr(meta.image)}">`,
          '<meta property="og:image:width" content="1080">',
          '<meta property="og:image:height" content="1080">',
          '<meta name="twitter:card" content="summary_large_image">',
        ]),
    '<meta name="theme-color" content="#1B5E43">',
    '<meta name="robots" content="noindex">',
  ]
  return lignes.join('')
}

function envelopper(meta: MetaPage, css: string, corps: string): string {
  return `<!doctype html><html lang="fr"><head>${entete(meta)}<style>${css}</style></head><body>${corps}</body></html>`
}

/**
 * Ce que WhatsApp affichera : deux lignes tirées de la carte du squelette, et
 * l'image quand elle existe.
 *
 * `image` reste absente si la carte n'a pas été déposée. Annoncer une
 * `og:image` qui rend 404 ferait un aperçu cassé — pire qu'un aperçu sobre,
 * parce qu'il donne l'air d'un lien douteux.
 */
export function metaDe(
  instantane: Instantane,
  ctx: RenderContext,
  lien: string,
  image?: string,
): MetaPage {
  const carte = carteDe(instantane, ctx)
  return {
    titre: carte === null ? instantane.nom : carte.title,
    description: carte === null ? 'Document Atelier 237' : [carte.sub, carte.subline].filter((s) => s !== '').join(' · '),
    lien,
    ...(image === undefined ? {} : { image }),
  }
}

export function pageDeLecture(
  instantane: Instantane,
  ctx: RenderContext,
  lien: string,
  image?: string,
): string {
  const meta = metaDe(instantane, ctx, lien, image)
  const document = documentDe(instantane, ctx)

  if (document !== null) {
    // Un document A4 : on rend le document lui-même, celui que le client
    // aurait reçu imprimé.
    return envelopper(
      meta,
      a4Css + lectureCss,
      `<main class="lecture">${enChaine(document)}</main>${enChaine(<PiedLecture instantane={instantane} />)}`,
    )
  }

  const carte = carteDe(instantane, ctx)
  if (carte === null) return pageIntrouvable()

  return envelopper(
    meta,
    lectureCss,
    `<main class="lecture">${enChaine(<VueCarte carte={carte} />)}</main>${enChaine(<PiedLecture instantane={instantane} />)}`,
  )
}

export function pageIntrouvable(): string {
  return envelopper(
    { titre: 'Lien introuvable — Atelier 237', description: 'Ce document n’est plus publié.', lien: '' },
    lectureCss,
    enChaine(<PageIntrouvable />),
  )
}

/** Le squelette est-il connu de ce serveur ? Sert au contrôle de publication. */
export function squeletteConnu(skeleton: string): boolean {
  return squeletteParId(skeleton) !== null
}
