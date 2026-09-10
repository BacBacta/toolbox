import type { Instantane, RenderContext } from '@a237/engine'
import { squeletteParId } from '@a237/engine'
import { render as enChaine } from 'preact-render-to-string'
import feuilleA4Css from '@a237/render/styles/a4.css?raw'
import vitrineCss from '@a237/render/styles/vitrine.css?raw'
import a4Css from './a4.css?raw'
import carteCss from './carte.css?raw'
import lectureCss from './lecture.css?raw'
import { sansCommentaires } from './feuille.js'
import { PageIllisible, PageIntrouvable, PiedLecture } from './page.js'
import type { MetaPage } from './page.js'
import { PageFormulaire, PageMerci, PageVitrine } from '@a237/render/page'
import { VueCarte, carteDe, documentDe, formulaireDe, pageDe } from './rendu.js'

/**
 * La page complète, en une chaîne.
 *
 * Le CSS est **inliné** : une feuille séparée serait une requête de plus sur
 * une connexion qui hoquette. Il n'y a aucun script, donc rien à charger après
 * le premier octet — la page est finie quand elle arrive. Ses commentaires,
 * eux, n'ont rien à y faire : voir `sansCommentaires`.
 */

/**
 * Les feuilles, allégées une fois pour toutes au chargement du module, et
 * **composées selon ce qu'on dessine**.
 *
 * Elles n'en faisaient qu'une, inlinée partout. Le plafond du § 8 est de 25 Ko
 * par page de lecture, et une page composée pleine en pesait 24,8 : les
 * deux kilo-octets de style de carte qu'elle n'emploie jamais lui coûtaient un
 * douzième de son budget. Chaque forme n'emporte plus que ce qu'elle dessine.
 *
 * `CSS_CADRE` est le tronc commun — la palette, le corps, le pied. Il est dans
 * les trois, parce que les trois en ont besoin.
 */
const CSS_CADRE = sansCommentaires(lectureCss)
const CSS_CARTE = sansCommentaires(carteCss)
/** La mise à l'échelle de la feuille et le lien d'impression : les écrits seuls. */
const CSS_A4 = sansCommentaires(a4Css) + sansCommentaires(feuilleA4Css)
const CSS_VITRINE = sansCommentaires(vitrineCss)

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
  /*
   * Un formulaire s'annonce par son titre et son accroche, jamais par une
   * carte : une carte résume ce qu'un outil contient, et ce qu'un formulaire
   * contient est ce que des gens y ont écrit.
   */
  const formulaire = formulaireDe(instantane)
  if (formulaire !== null) {
    return { titre: formulaire.titre, description: formulaire.accroche, lien }
  }

  const carte = carteDe(instantane, ctx)
  return {
    titre: carte === null ? instantane.nom : carte.title,
    description: carte === null ? 'Document Atelier 237' : [carte.sub, carte.subline].filter((s) => s !== '').join(' · '),
    lien,
    ...(image === undefined ? {} : { image }),
  }
}

/**
 * Ce dépôt se dessine-t-il ?
 *
 * `/api/publier` est une adresse publique, et le contrôle de forme ne dit rien
 * du contenu : un état auquel il manque ce que le document lit passait, puis
 * faisait jeter le rendu au moment de la lecture. La seule vérification qui ne
 * puisse pas diverger du rendu est le rendu lui-même — un schéma recopié côté
 * serveur finirait par ne plus dire la même chose que l'écran.
 */
export function rendable(instantane: Instantane): boolean {
  try {
    const ctx: RenderContext = { lien: '', maintenant: new Date(instantane.publieLe) }
    const formulaire = formulaireDe(instantane)
    if (formulaire !== null) {
      enChaine(<PageFormulaire formulaire={formulaire} />)
      return true
    }
    const document = documentDe(instantane, ctx)
    if (document !== null) {
      enChaine(document)
      return true
    }
    return carteDe(instantane, ctx) !== null
  } catch {
    return false
  }
}

/**
 * La page quand le document est déposé mais ne se dessine pas.
 *
 * Elle existe pour ce qui est **déjà** dans KV : le contrôle à la publication
 * ferme la porte devant, il ne réécrit pas ce qui est passé avant lui, et un
 * rendu qui change de forme ne doit pas transformer un lien envoyé hier en
 * page d'erreur de l'hébergeur.
 */
export function pageIllisible(): string {
  return envelopper(
    {
      titre: 'Document illisible — Atelier 237',
      description: 'Ce document ne peut pas être affiché.',
      lien: '',
    },
    CSS_CADRE,
    enChaine(<PageIllisible />),
  )
}

/**
 * Ce que le formulaire doit montrer en plus de lui-même : ce qui manque à la
 * réponse qu'on vient d'essayer d'envoyer, ou le fait qu'il est plein.
 */
export interface EtatFormulaire {
  readonly manques?: readonly string[]
  readonly ferme?: boolean
}

export function pageDeLecture(
  instantane: Instantane,
  ctx: RenderContext,
  lien: string,
  image?: string,
  etat?: EtatFormulaire,
): string {
  try {
    return dessiner(instantane, ctx, lien, image, etat)
  } catch {
    return pageIllisible()
  }
}

/**
 * La page qu'on lit une fois sa réponse partie.
 *
 * Une page à part, servie après une redirection, et non le même document avec
 * un message en haut : rafraîchir après un `POST` renvoie la même réponse une
 * deuxième fois, et personne ne le sait avant de compter les commandes.
 */
export function pageDeMerci(instantane: Instantane, lien: string): string {
  const formulaire = formulaireDe(instantane)
  if (formulaire === null) return pageIntrouvable()
  return envelopper(
    { titre: formulaire.titre, description: formulaire.accroche, lien },
    CSS_CADRE + CSS_VITRINE,
    `<main class="lecture">${enChaine(<PageMerci formulaire={formulaire} />)}</main>` +
      enChaine(<PiedLecture instantane={instantane} recoit />),
  )
}

function dessiner(
  instantane: Instantane,
  ctx: RenderContext,
  lien: string,
  image?: string,
  etat?: EtatFormulaire,
): string {
  const meta = metaDe(instantane, ctx, lien, image)

  /*
   * Un formulaire d'abord : c'est la seule des formes qui reçoit, et son
   * `action` pointe sur sa propre adresse. Le navigateur poste un `<form>`
   * sans une ligne de script, même quand la page n'a pas fini de charger.
   */
  const formulaire = formulaireDe(instantane)
  if (formulaire !== null) {
    return envelopper(
      meta,
      CSS_CADRE + CSS_VITRINE,
      `<main class="lecture">${enChaine(
        <PageFormulaire
          formulaire={formulaire}
          action={lien}
          manques={etat?.manques ?? []}
          ferme={etat?.ferme ?? false}
        />,
      )}</main>` + enChaine(<PiedLecture instantane={instantane} recoit />),
    )
  }

  /*
   * Une page composée d'abord : c'est la seule des trois formes qui a été
   * écrite pour être lue derrière un lien, et elle n'emporte ni la feuille A4
   * ni l'offre d'impression. Une vitrine ne se met pas dans une chemise.
   */
  const vitrine = pageDe(instantane)
  if (vitrine !== null) {
    return envelopper(
      meta,
      CSS_CADRE + CSS_VITRINE,
      `<main class="lecture">${enChaine(<PageVitrine page={vitrine} maintenant={ctx.maintenant} />)}</main>` +
        enChaine(<PiedLecture instantane={instantane} />),
    )
  }

  const document = documentDe(instantane, ctx)

  if (document !== null) {
    // Un document A4 : on rend le document lui-même, celui que le client
    // aurait reçu imprimé.
    return envelopper(
      meta,
      CSS_CADRE + CSS_A4,
      `<main class="lecture">${enChaine(document)}</main>` +
        enChaine(<PiedLecture instantane={instantane} pdf={`${lien.replace('/d/', '/p/')}`} />),
    )
  }

  const carte = carteDe(instantane, ctx)
  if (carte === null) return pageIntrouvable()

  return envelopper(
    meta,
    CSS_CADRE + CSS_CARTE,
    `<main class="lecture">${enChaine(<VueCarte carte={carte} />)}</main>${enChaine(<PiedLecture instantane={instantane} />)}`,
  )
}

export function pageIntrouvable(): string {
  return envelopper(
    { titre: 'Lien introuvable — Atelier 237', description: 'Ce document n’est plus publié.', lien: '' },
    CSS_CADRE,
    enChaine(<PageIntrouvable />),
  )
}

/** Le squelette est-il connu de ce serveur ? Sert au contrôle de publication. */
export function squeletteConnu(skeleton: string): boolean {
  return squeletteParId(skeleton) !== null
}
