import {
  arreteLe, dateLongue, heureCourte, instantWAT, jourDeLaSemaineWAT, joursEntre,
} from './format.js'
import type { CardItem, CardSpec, ErreurValidation, JsonSchema, RenderContext, ShareSpec } from './types.js'
import { valider } from './valider.js'
import { numeroInternational, numeroLisible } from './whatsapp.js'

/**
 * La troisième chose que le modèle a le droit de composer : une page.
 *
 * « Un site internet », tapé par un quincaillier de Douala, ne demande presque
 * jamais un site. Il demande **une page à envoyer sur WhatsApp** : son nom, ce
 * qu'il vend, son numéro, ses prix, ses horaires. L'atelier publie déjà des
 * pages en lecture seule, sans un script, avec un aperçu — il manquait le
 * contrat et le dessin, pas l'infrastructure.
 *
 * L'invariant § 2.1 tient sans effort : le modèle ne rend ni HTML ni gabarit,
 * il remplit cette configuration, et c'est `PageVitrine` — écrite à la main —
 * qui la dessine. Une page composée ne peut pas contenir de script, parce
 * qu'aucun champ de ce contrat n'en accepte.
 *
 * **« Un site » et « une page » sont le même objet ici**, et ce n'est pas une
 * économie : c'est ce qui est juste. Un site, c'est un menu et plusieurs
 * sujets ; une page sans script n'a pas besoin de plusieurs adresses pour les
 * porter — le sommaire saute d'une section à l'autre sans recharger, ce qui
 * est exactement ce qu'on veut sur une connexion qui hoquette. `sommaire` dit
 * simplement laquelle des deux on a demandée.
 */

/** L'identifiant d'une page composée par le modèle. */
export const ID_COMPOSE_PAGE = 'compose-page'

/** Ce qu'une section sait porter. Rien d'autre n'est acceptable. */
export type SorteSection = 'texte' | 'liste' | 'prix'

export interface LigneSection {
  readonly nom: string
  /** Un prix, une durée, une quantité — ce qui tient à droite d'un nom. */
  readonly valeur?: string
  readonly detail?: string
}

export interface SectionDemandee {
  readonly titre: string
  readonly sorte: SorteSection
  /** Pour une section de texte. Deux paragraphes au plus. */
  readonly texte?: string
  /** Pour une liste ou une grille de prix. */
  readonly lignes?: readonly LigneSection[]
}

export interface PageDemande {
  readonly titre: string
  readonly kicker: string
  /** Une phrase sous le titre. Ce qu'on ferait dire à une enseigne. */
  readonly accroche: string
  readonly sections: readonly SectionDemandee[]
  /**
   * Le menu qui saute d'une section à l'autre. C'est ce qui fait qu'on a
   * demandé « un site » et non « une page » — et il n'a de sens qu'à partir de
   * trois sections, sinon il double le titre qu'on voit déjà.
   */
  readonly sommaire?: boolean
  /**
   * Le jour d'un événement, quand la page en annonce un.
   *
   * C'est tout ce qui sépare **une page** d'**un événement**, et c'est
   * suffisant : une annonce de mariage, une réunion de tontine, une vente de
   * fin d'année ont un nom, un lieu, un programme et une phrase — tout ce
   * qu'une vitrine porte déjà. Ce qu'elles ont en plus est une date, et une
   * date que la machine comprend permet à la page de dire « dans trois jours »
   * ou « c'est passé ». Une date écrite dans `horaires` ne sait rien dire.
   *
   * `AAAA-MM-JJ`, avec l'heure si elle est connue.
   */
  readonly date?: string
  /** Le numéro se transforme en lien `wa.me` : c'est le bouton qui rapporte. */
  readonly telephone?: string
  readonly adresse?: string
  readonly horaires?: string
}

/*
 * Six sections et huit lignes : une page se lit d'un pouce, sur un téléphone,
 * dans le navigateur intégré de WhatsApp. Au-delà, ce n'est plus une vitrine,
 * c'est un catalogue — et un catalogue est un registre, que l'atelier sait
 * déjà faire.
 */
export const MAX_SECTIONS = 8
export const MAX_LIGNES_SECTION = 8

/** En deçà, un sommaire ne fait que répéter les titres qui sont déjà à l'écran. */
export const SECTIONS_POUR_SOMMAIRE = 3

const schemaLigne: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['nom'],
  properties: {
    nom: {
      type: 'string', minLength: 1, maxLength: 60, title: 'Ce que c’est',
      description: 'Ex. « Tôle bac 30/100 ».',
    },
    valeur: {
      type: 'string', maxLength: 30, title: 'Prix ou quantité',
      description: 'Tel qu’on le dit. Ex. « 12 500 F », « 2 h ».',
    },
    /*
     * Soixante caractères, et non quatre-vingt-dix. « la barre de 12 m »,
     * « livraison comprise dans Douala » : une précision tient là-dedans. À
     * quatre-vingt-dix, c'est une phrase — et soixante-quatre lignes de phrase
     * ont coûté deux kilo-octets sur les vingt-cinq que le § 8 accorde à la
     * page publiée, pour un champ dont le nom dit qu'il est court.
     */
    detail: { type: 'string', maxLength: 60, title: 'Précision', description: 'Une ligne, si elle sert.' },
  },
}

const schemaSection: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['titre', 'sorte'],
  properties: {
    titre: {
      type: 'string', minLength: 2, maxLength: 40, title: 'Titre de la section',
      description: 'Ex. « Ce que je vends ».',
    },
    sorte: {
      type: 'string', enum: ['texte', 'liste', 'prix'], title: 'Sorte',
      description:
        'texte : un paragraphe, dans « texte ». liste : des noms, dans « lignes ». ' +
        'prix : des noms avec un montant, dans « lignes ». ' +
        'Choisis « texte » quand tu n’as pas la liste : une section porte toujours son contenu.',
    },
    /*
     * Une section porte l'un ou l'autre, jamais les deux : `montrerSi` dit à
     * l'éditeur lequel montrer. Sans lui, chaque liste de prix traînait une
     * zone de texte vide, et chaque paragraphe une liste vide — la moitié des
     * champs à l'écran ne menaient nulle part.
     */
    texte: {
      type: 'string', minLength: 1, maxLength: 400, title: 'Texte',
      description: 'Obligatoire quand la sorte est « texte ». Deux paragraphes au plus.',
      ecran: { montrerSi: { champ: 'sorte', vaut: ['texte'] } },
    },
    lignes: {
      type: 'array', minItems: 1, maxItems: MAX_LIGNES_SECTION, items: schemaLigne, title: 'Lignes',
      description: 'Obligatoire quand la sorte est « liste » ou « prix ». Au moins une ligne.',
      ecran: {
        montrerSi: { champ: 'sorte', vaut: ['liste', 'prix'] },
        ajout: 'Ajouter une ligne', retrait: 'Retirer la ligne',
      },
    },
  },
}

export const schemaPage: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['titre', 'kicker', 'accroche', 'sections'],
  properties: {
    titre: {
      type: 'string', minLength: 2, maxLength: 40, title: 'Nom',
      /*
       * L'exemple ne nomme plus de lieu.
       *
       * « Quincaillerie Bépanda » y était, et une demande sans quartier ni nom
       * l'a rendu tel quel : Bépanda est un vrai quartier de Douala. Un nom
       * faux se publie et devient l'enseigne de quelqu'un d'autre sur le lien
       * qu'il envoie à ses clients. La forme attendue se montre encore — une
       * activité, pas une phrase — sans donner de lieu à recopier.
       */
      description:
        'Le nom de l’activité, tel qu’il est sur l’enseigne, si la personne le donne. ' +
        'Sinon, mets simplement le métier — ex. « Quincaillerie » — et demande-le dans ton mot.',
    },
    kicker: {
      type: 'string', minLength: 2, maxLength: 30, title: 'Sur-titre',
      description: 'En capitales, au-dessus du nom. Ex. « QUINCAILLERIE ».',
    },
    accroche: {
      type: 'string', minLength: 4, maxLength: 120, title: 'Accroche',
      description: 'Une phrase. Ce qu’on dirait à quelqu’un qui passe devant la boutique.',
    },
    sections: {
      type: 'array', minItems: 1, maxItems: MAX_SECTIONS, items: schemaSection, title: 'Sections',
      ecran: { ajout: 'Ajouter une section', retrait: 'Retirer la section' },
    },
    /*
     * Ces trois-là n'ont **pas d'exemple**, et c'est la seule chose qui les
     * protège.
     *
     * Mesuré sur une génération réelle : « je veux un site internet pour ma
     * quincaillerie à Bépanda » a rendu le numéro, la rue et les horaires de
     * l'exemple, recopiés au caractère près — alors que l'invite dit déjà
     * « n'invente jamais un numéro ». Une valeur concrète posée à côté d'un
     * champ est une démonstration de ce qu'il faut y mettre, et elle est plus
     * forte qu'une interdiction écrite ailleurs.
     *
     * Le numéro est le pire des trois : il appartient à quelqu'un. La page
     * serait publiée sous le nom d'un commerçant, et les clients appelleraient
     * un inconnu. Personne ne relit dix chiffres avant de partager un lien.
     *
     * Les prix, eux, gardent leur exemple : c'est la matière de la page, un
     * commerçant voit tout de suite qu'un prix n'est pas le sien, et une
     * vitrine sans rien dessus ne sert à rien.
     */
    telephone: {
      type: 'string', maxLength: 20, title: 'WhatsApp',
      description:
        'Le numéro sur lequel on peut écrire, uniquement s’il est dans la demande. Ne l’invente sous aucun prétexte : un numéro inventé appartient à quelqu’un, et c’est lui qu’on appellera.',
    },
    adresse: {
      type: 'string', maxLength: 90, title: 'Où',
      description:
        'Le quartier et la rue, uniquement s’ils sont dans la demande. N’invente pas un lieu : des gens s’y déplaceraient.',
    },
    horaires: {
      type: 'string', maxLength: 60, title: 'Quand',
      description: 'Les jours et les heures d’ouverture, uniquement s’ils sont dans la demande.',
    },
    date: {
      type: 'string', maxLength: 20, title: 'Jour de l’événement',
      description:
        'Seulement si la demande annonce un événement daté. « AAAA-MM-JJ », ou « AAAA-MM-JJTHH:MM » si l’heure est dite. N’invente jamais une date.',
    },
    sommaire: {
      type: 'boolean', title: 'Menu en haut',
      description:
        'Vrai quand la demande dit « un site » : un menu saute d’une section à l’autre. Faux pour une simple page.',
    },
  },
}

/**
 * L'étiquette contre le contenu : c'est le contenu qui gagne.
 *
 * Une section annonce sa `sorte` et porte l'un des deux contenus. Le modèle se
 * trompe parfois d'étiquette — il écrit un paragraphe et l'appelle « liste »,
 * ou aligne des prix sous « texte ». Ce qu'il a écrit est bon ; seul le mot
 * qui le nomme est faux, et refuser la page entière pour ce mot-là fait
 * recommencer un tour payé pour rien.
 *
 * Redresser n'est pas inventer. Une section qui ne porte **aucun** contenu ne
 * se répare pas : elle s'en va, parce qu'un titre suivi de rien n'aide
 * personne. Si toutes s'en vont, la page reste refusée — c'est `minItems` qui
 * le dira, et c'est bien qu'il le dise.
 *
 * La fonction est pure et tolère n'importe quoi : elle reçoit ce que le modèle
 * a rendu, pas une page. Ce qui n'a pas la forme d'une page ressort tel quel,
 * et le schéma s'expliquera mieux qu'elle.
 */
export function redresserPage(valeur: unknown): unknown {
  if (typeof valeur !== 'object' || valeur === null) return valeur
  const page = valeur as { sections?: unknown }
  if (!Array.isArray(page.sections)) return valeur

  const redressees: unknown[] = []
  let change = false

  for (const brute of page.sections) {
    if (typeof brute !== 'object' || brute === null) {
      redressees.push(brute)
      continue
    }
    const section = brute as Record<string, unknown>
    const declaree = section['sorte']

    /*
     * Une sorte que le contrat ne connaît pas n'est pas une étiquette de
     * travers : c'est une section qu'on ne sait pas dessiner. La corriger
     * d'office ferait passer par la fenêtre ce que l'énumération tient à la
     * porte — on la laisse donc telle quelle, et le schéma dira le mot juste.
     */
    if (declaree !== 'texte' && declaree !== 'liste' && declaree !== 'prix') {
      redressees.push(brute)
      continue
    }

    const texte = typeof section['texte'] === 'string' ? section['texte'].trim() : ''
    const lignes = Array.isArray(section['lignes']) ? section['lignes'] : []

    if (texte === '' && lignes.length === 0) {
      change = true
      continue
    }

    /*
     * Un montant quelque part fait une grille de prix ; des noms seuls font une
     * liste. C'est la seule différence entre les deux à l'écran, et elle se lit
     * dans les lignes — inutile de la demander deux fois.
     */
    const sorte: SorteSection =
      lignes.length === 0 ? 'texte'
      : declaree !== 'texte' ? declaree
      : texte === '' ? sorteDesLignes(lignes)
      : 'texte'

    const propre: Record<string, unknown> = {}
    for (const [clef, v] of Object.entries(section)) {
      if (clef === 'texte' || clef === 'lignes' || clef === 'sorte') continue
      propre[clef] = v
    }
    propre['sorte'] = sorte
    if (sorte === 'texte') propre['texte'] = section['texte']
    else propre['lignes'] = section['lignes']

    if (!memeSection(section, propre)) change = true
    redressees.push(propre)
  }

  return change ? { ...page, sections: redressees } : valeur
}

/** « prix » dès qu'une ligne porte un montant ; « liste » sinon. */
function sorteDesLignes(lignes: readonly unknown[]): SorteSection {
  return lignes.some((l) => {
    if (typeof l !== 'object' || l === null) return false
    const valeur = (l as { valeur?: unknown }).valeur
    return typeof valeur === 'string' && valeur.trim() !== ''
  })
    ? 'prix'
    : 'liste'
}

/*
 * Rendre l'objet d'origine quand rien ne bouge évite de réécrire une page juste
 * pour la rendre différente d'elle-même : l'écran compare, et une page neuve à
 * chaque lecture ferait clignoter ce qui n'a pas changé.
 */
function memeSection(avant: Record<string, unknown>, apres: Record<string, unknown>): boolean {
  const clefs = new Set([...Object.keys(avant), ...Object.keys(apres)])
  for (const clef of clefs) {
    if (avant[clef] !== apres[clef]) return false
  }
  return true
}

/**
 * Vérifie ce que le modèle a rendu, au-delà de ce que le schéma sait dire.
 *
 * Le schéma tient les types et les bornes. Ce qu'il ne tient pas, c'est la
 * cohérence entre `sorte` et le contenu : une section « prix » sans lignes est
 * un titre suivi de rien, et une section « texte » sans texte aussi. Les
 * laisser passer donnerait une page à trous, publiée sous le nom de quelqu'un.
 */
export function verifierPage(valeur: unknown): readonly ErreurValidation[] {
  const erreurs = [...valider(schemaPage, valeur)]
  if (erreurs.length > 0) return erreurs

  const page = valeur as PageDemande

  /*
   * Une date que personne ne sait lire n'est pas une date.
   *
   * Le schéma ne tient que la longueur : « samedi prochain » y passe. La page
   * l'ignorerait alors en silence, et l'affiche annoncerait un événement sans
   * jour — c'est-à-dire exactement ce que le modèle croyait avoir écrit. Le
   * reproche nomme la forme attendue, pour que la reprise ait de quoi
   * corriger.
   */
  if (page.date !== undefined && page.date !== '' && Number.isNaN(new Date(page.date).getTime())) {
    erreurs.push({
      chemin: '$.date',
      message: `« ${page.date} » ne se lit pas : écris le jour en « AAAA-MM-JJ », ou « AAAA-MM-JJTHH:MM » avec l’heure`,
    })
  }

  for (const [i, section] of page.sections.entries()) {
    const chemin = `$.sections[${i}]`
    if (section.sorte === 'texte') {
      if ((section.texte ?? '').trim() === '') {
        erreurs.push({ chemin: `${chemin}.texte`, message: 'une section « texte » sans texte est un titre suivi de rien' })
      }
      continue
    }
    if ((section.lignes ?? []).length === 0) {
      erreurs.push({
        chemin: `${chemin}.lignes`,
        message: `une section « ${section.sorte} » sans lignes est un titre suivi de rien`,
      })
    }
  }
  return erreurs
}

/** Une section et l'ancre par laquelle le sommaire y saute. */
export interface SectionAncree {
  readonly section: SectionDemandee
  readonly ancre: string
}

/**
 * Les sections, chacune avec son ancre.
 *
 * Elles voyagent ensemble et non dans deux tableaux parallèles : une ancre
 * seule ne sert à rien, et rapprocher deux listes par leur rang oblige à
 * traiter un cas — « et si le rang n'existait pas ? » — qui ne peut pas
 * arriver. Une branche qu'on ne peut pas atteindre est une branche qu'on ne
 * peut pas éprouver.
 *
 * L'ancre se dérive du titre et non d'un compteur : une ancre numérotée change
 * de cible dès qu'on insère une section, et un lien déjà envoyé tombe alors
 * sur autre chose. Les accents sont dépliés, le reste devient un tiret ; deux
 * titres qui se réduisent au même reçoivent leur rang, parce qu'un identifiant
 * en double fait sauter le menu au premier des deux.
 */
export function sectionsAncrees(
  sections: readonly SectionDemandee[],
): readonly SectionAncree[] {
  const vues = new Map<string, number>()
  return sections.map((section, i) => {
    const base =
      section.titre
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || `section-${i + 1}`
    const deja = vues.get(base)
    vues.set(base, (deja ?? 0) + 1)
    return { section, ancre: deja === undefined ? base : `${base}-${deja + 1}` }
  })
}

/** Le menu a-t-il lieu d'être ? */
export function avecSommaire(page: PageDemande): boolean {
  return page.sommaire === true && page.sections.length >= SECTIONS_POUR_SOMMAIRE
}

/**
 * La carte d'une page, celle que WhatsApp montre avant qu'on ouvre le lien.
 *
 * Elle n'a pas de grand chiffre à afficher : une vitrine ne totalise rien. Ce
 * qui tient sa place est **ce qui fait cliquer** — le numéro qu'on peut écrire,
 * et à défaut le premier prix annoncé. Une carte sans rien au milieu se lit
 * comme un outil vide ; on préfère alors le sur-titre au blanc.
 */
export function carteDePage(page: PageDemande, ctx: RenderContext): CardSpec {
  const grand = grandDeLaPage(page, ctx.maintenant)
  const vitrine = sectionListee(page)

  return {
    kicker: page.kicker,
    title: page.titre,
    sub: page.accroche,
    tag: null,
    bigLabel: grand.libelle,
    big: grand.valeur,
    // Une vitrine ne mesure aucune avance : la barre n'aurait rien à remplir.
    pct: null,
    subline: [page.adresse, page.horaires, sousLigneTelephone(page)]
      .filter((x) => x !== undefined && x !== '')
      .join(' · '),
    listTitle: vitrine === null ? '' : vitrine.titre.toUpperCase(),
    items: vitrine === null ? [] : itemsDeSection(vitrine),
    link: ctx.lien,
    stamp: arreteLe(ctx.maintenant),
  }
}

function grandDeLaPage(
  page: PageDemande,
  maintenant: Date,
): { readonly libelle: string; readonly valeur: string } {
  /*
   * Un événement met son jour en grand, avant le numéro.
   *
   * Sur une carte qui passe dans un groupe WhatsApp, la question n'est pas
   * « comment les joindre » mais « c'est quand ». Le numéro reste dessous, sur
   * la ligne du lieu.
   */
  const jour = page.date === undefined ? null : direLeJour(page.date, maintenant)
  if (jour !== null) {
    return { libelle: jour.delai.toUpperCase(), valeur: `${jour.quand}${jour.heure === '' ? '' : ` ${jour.heure}`}` }
  }

  const tel = page.telephone === undefined ? null : numeroInternational(page.telephone)
  if (tel !== null) return { libelle: 'WHATSAPP', valeur: numeroLisible(page.telephone ?? '') }

  const prix = page.sections.find((s) => s.sorte === 'prix')
  const premiere = prix?.lignes?.find((l) => l.valeur !== undefined && l.valeur !== '')
  if (premiere !== undefined) {
    return { libelle: premiere.nom.toUpperCase(), valeur: premiere.valeur ?? '' }
  }

  return { libelle: '', valeur: page.kicker }
}

/**
 * Le numéro descend sur la ligne du lieu quand le grand caractère est pris par
 * la date : une affiche d'événement doit encore dire à qui écrire.
 */
function sousLigneTelephone(page: PageDemande): string {
  if (page.date === undefined || page.telephone === undefined || page.telephone === '') return ''
  return numeroInternational(page.telephone) === null ? '' : numeroLisible(page.telephone)
}

/** La section qu'on montre sur la carte : des prix de préférence, une liste sinon. */
function sectionListee(page: PageDemande): SectionDemandee | null {
  return (
    page.sections.find((s) => s.sorte === 'prix') ??
    page.sections.find((s) => s.sorte === 'liste') ??
    null
  )
}

function itemsDeSection(section: SectionDemandee): readonly CardItem[] {
  return (section.lignes ?? []).map((l) => ({
    n: l.nom,
    ok: false,
    warn: false,
    val: l.valeur !== undefined && l.valeur !== '' ? l.valeur : null,
  }))
}

/**
 * Ce qui part dans une discussion.
 *
 * Le texte n'est pas le lien tout seul : sur un téléphone d'entrée de gamme,
 * dans un groupe qui défile, l'aperçu met du temps à se dessiner et parfois ne
 * vient pas. Les trois premières lignes doivent suffire à savoir de quoi il
 * s'agit et comment joindre quelqu'un.
 */
export function partageDePage(page: PageDemande, ctx: RenderContext): ShareSpec {
  const vitrine = sectionListee(page)
  const jour = page.date === undefined ? null : direLeJour(page.date, ctx.maintenant)
  const lignes = [
    `${page.titre.toUpperCase()} — ${page.kicker.toLowerCase()}`,
    page.accroche,
    // Le jour vient tout de suite : dans une discussion qui défile, c'est la
    // seule ligne qui décide si on lit la suite.
    jour === null ? '' : `${jour.quand}${jour.heure === '' ? '' : ` ${jour.heure}`} — ${jour.delai}`,
    ...(vitrine === null
      ? []
      : (vitrine.lignes ?? [])
          .slice(0, 6)
          .map((l) => `• ${l.nom}${l.valeur !== undefined && l.valeur !== '' ? ` — ${l.valeur}` : ''}`)),
    page.adresse === undefined || page.adresse === '' ? '' : `Où : ${page.adresse}`,
    page.horaires === undefined || page.horaires === '' ? '' : `Quand : ${page.horaires}`,
    page.telephone === undefined || page.telephone === ''
      ? ''
      : `WhatsApp : ${numeroLisible(page.telephone)}`,
    ctx.lien,
  ].filter((l) => l !== '')

  return {
    title: page.titre,
    desc: page.accroche,
    name: ID_COMPOSE_PAGE,
    txt: lignes.join('\n'),
    broad: null,
    warn: null,
    card: carteDePage(page, ctx),
    relances: [],
    /*
     * Une vitrine n'a personne à relancer : elle ne connaît pas ses lecteurs,
     * et c'est voulu — rien de ce qu'elle publie n'identifie qui l'a ouverte.
     */
    relancesVides: 'Une vitrine se partage, elle ne relance personne.',
  }
}

/**
 * Le jour d'un événement, dit comme on le dirait de vive voix.
 *
 * Une date sur une affiche n'est jamais lue pour elle-même : ce qu'on cherche,
 * c'est de savoir si on a le temps. « Samedi 12 septembre 2026 » oblige à
 * compter ; « dans 3 jours » répond. Les deux, donc, et la seconde d'abord
 * dans le regard.
 *
 * Rend `null` sur ce qui n'est pas une date : le modèle a pour consigne de ne
 * pas en inventer, et une page qui affiche « Invalid Date » sous le nom de
 * quelqu'un est pire qu'une page sans date.
 */
export interface JourDit {
  /** « Samedi 12 septembre 2026 ». */
  readonly quand: string
  /** « à 15 h », ou une chaîne vide quand l'heure n'est pas dite. */
  readonly heure: string
  /** « dans 3 jours », « aujourd’hui », « c’est passé ». */
  readonly delai: string
  /** Vrai quand le jour est derrière nous : la page se dit alors au passé. */
  readonly passe: boolean
}

const JOURS = [
  'Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi',
] as const

export function direLeJour(iso: string, maintenant: Date): JourDit | null {
  const quand = instantWAT(iso)
  if (quand === null) return null

  const jours = joursEntre(maintenant, quand)
  /*
   * L'heure ne s'affiche que si elle a été dite. Une date nue se lit comme
   * minuit, et « à 00 h » sur une affiche de mariage est une erreur qui se
   * voit — celle de la machine, pas celle de qui a écrit.
   */
  const avecHeure = /[T ]\d{2}:\d{2}/.test(iso)

  return {
    quand: `${JOURS[jourDeLaSemaineWAT(quand)] ?? ''} ${dateLongue(quand)}`.trim(),
    heure: avecHeure ? heureDite(quand) : '',
    delai: delaiDit(jours),
    passe: jours < 0,
  }
}

/**
 * « à 15 h », « à 9 h 30 ».
 *
 * Pas « à 15 h 00 » : en français, une heure ronde n'écrit pas ses minutes, et
 * les deux zéros donnent à une invitation l'air d'un horaire de train. Pas de
 * zéro devant non plus — personne ne dit « zéro neuf heures ».
 */
function heureDite(quand: Date): string {
  const [heures = '', minutes = ''] = heureCourte(quand).split('h')
  return minutes === '00' ? `à ${Number(heures)} h` : `à ${Number(heures)} h ${minutes}`
}

function delaiDit(jours: number): string {
  if (jours < -1) return 'c’est passé'
  if (jours === -1) return 'c’était hier'
  if (jours === 0) return 'c’est aujourd’hui'
  if (jours === 1) return 'c’est demain'
  if (jours < 7) return `dans ${jours} jours`
  if (jours < 14) return 'dans une semaine'
  if (jours < 31) return `dans ${Math.round(jours / 7)} semaines`
  return `dans ${Math.round(jours / 30)} mois`
}
