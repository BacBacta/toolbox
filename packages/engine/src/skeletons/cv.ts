import { controleCv, debordeUnePage, INTITULES, signesCv } from '../compute/cv.js'
import type { EtatCv } from '../compute/cv.js'
import { arreteLe, normaliser } from '../format.js'
import { cvSchema } from '../schema/cv.js'
import type { CardSpec, RenderContext, ShareSpec, Skeleton } from '../types.js'

/**
 * Le curriculum vitæ.
 *
 * Il part vide, comme les actes. Le prototype portait le CV de Serge Mbarga,
 * magasinier ; le recopier donnerait à chacun la carrière d'un inconnu à
 * effacer avant d'écrire la sienne. Ce qui reste comme valeur de départ est un
 * choix de mise en page, rien d'autre.
 *
 * Il n'a ni numéro, ni date d'émission, ni entête d'entreprise : personne ne
 * l'archive et personne ne le contrôle. Il ne porte donc pas `emisLe`, là où
 * tous les autres documents A4 en ont un.
 */

/** Un intitulé de section. La table est close : la clef manquante ne peut pas exister. */
function intitule(langue: EtatCv['langue'], clef: string): string {
  return INTITULES[langue][clef] ?? clef
}

const cvDefaults: EtatCv = {
  nom: 'Curriculum vitæ',
  encre: 'encre',
  gabarit: 'notaire',
  langue: 'fr',
  dense: false,
  identite: { nom: '', titre: '', tel: '', mail: '', ville: '' },
  resume: '',
  postes: [],
  diplomes: [],
  competences: [],
  langues: [],
}

export function cvCard(etat: EtatCv, ctx: RenderContext): CardSpec {
  const id = etat.identite
  return {
    kicker: 'CV',
    title: id.nom === '' ? 'Curriculum vitæ' : id.nom,
    sub: id.titre,
    tag: null,
    bigLabel: intitule(etat.langue, 'experience').toUpperCase(),
    // Le nombre de postes, pas des années : additionner des périodes écrites
    // à la main (« 2022 – 2026 », « depuis mars ») donnerait un chiffre faux.
    big: etat.postes.length === 0 ? '—' : String(etat.postes.length),
    pct: null,
    subline: [id.ville, id.tel].filter((s) => s !== '').join(' · '),
    listTitle: intitule(etat.langue, 'competences'),
    // Les compétences tiennent sur une carte ; une carrière, non.
    items: etat.competences.slice(0, 6).map((c) => ({ n: c, ok: true, warn: false, val: null })),
    link: ctx.lien,
    stamp: arreteLe(ctx.maintenant),
  }
}

export function cvShare(etat: EtatCv, ctx: RenderContext): ShareSpec {
  const id = etat.identite
  const manque = controleCv(etat)
  const lignes: readonly (string | null)[] = [
    id.nom === '' ? 'CURRICULUM VITÆ' : id.nom.toUpperCase(),
    id.titre === '' ? null : id.titre,
    [id.tel, id.mail, id.ville].filter((s) => s !== '').join(' · ') || null,
    etat.postes.length === 0 ? null : `${etat.postes.length} poste${etat.postes.length > 1 ? 's' : ''}`,
    ctx.lien,
  ]
  return {
    title: id.nom === '' ? 'Curriculum vitæ' : `CV — ${id.nom}`,
    desc: id.titre,
    // `normaliser` plie les accents avant de couper : sans lui, « Adèle »
    // devient « ad-le » dans le nom du fichier téléchargé.
    name: `cv-${normaliser(id.nom) === '' ? 'sans-nom' : normaliser(id.nom).replace(/ /g, '-')}`,
    txt: lignes.filter((l): l is string => l !== null && l !== '').join('\n'),
    broad: null,
    warn:
      manque.length === 0
        ? null
        : `Ce CV n’est pas complet : il manque ${manque.map((m) => m.libelle).join(', ')}.`,
    card: cvCard(etat, ctx),
    // Un CV s'envoie à un employeur nommé. Le diffuser dans un groupe, c'est
    // laisser son numéro de téléphone à des gens qui ne recrutent pas.
    relances: [],
    relancesVides: 'Un CV s’envoie à un employeur, jamais dans un groupe.',
  }
}

export const cv: Skeleton<EtatCv> = {
  id: 'cv',
  group: 'documents',
  title: 'Curriculum vitæ',
  // « postuler » et « candidature » nomment aussi la lettre de motivation : les
  // deux se proposent alors côte à côte, ce qui est la bonne réponse — on ne
  // postule pas sans les deux feuilles.
  keywords: [
    'cv', 'curriculum', 'curriculum vitae', 'mon parcours', 'chercher du travail',
    'postuler', 'candidature', 'chercher un emploi',
  ],
  engine: 'doc',
  schema: cvSchema,
  defaults: cvDefaults,
  compute: { controleCv, debordeUnePage, signesCv },
  card: cvCard,
  share: cvShare,
}
