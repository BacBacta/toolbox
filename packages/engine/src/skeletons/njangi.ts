import {
  ajouterMembre, basculerVersement, beneficiaireDuTour, changerCotisation,
  classementFiabilite, collecte, estFiable, fiabilite, prochainTour, retirerMembre,
} from '../compute/njangi.js'
import type { EtatNjangi, Periode } from '../compute/njangi.js'
import { arreteLe, montantF } from '../format.js'
import { njangiSchema } from '../schema/njangi.js'
import type { CardSpec, RenderContext, Relance, ShareSpec, Skeleton } from '../types.js'

const LIBELLE: Readonly<Record<Periode, string>> = {
  semaine: 'semaine', quinzaine: 'quinzaine', mois: 'mois',
}
const TAG: Readonly<Record<Periode, string>> = { semaine: 'S', quinzaine: 'Q', mois: 'M' }
const BIG_LABEL: Readonly<Record<Periode, string>> = {
  semaine: 'COLLECTÉ CETTE SEMAINE',
  quinzaine: 'COLLECTÉ CETTE QUINZAINE',
  mois: 'COLLECTÉ CE MOIS',
}

const defaults: EtatNjangi = {
  nom: 'Njangi',
  cotisation: 5_000,
  periode: 'semaine',
  tour: 1,
  historique: [],
  membres: [],
}

export function njangiCard(etat: EtatNjangi, ctx: RenderContext): CardSpec {
  const c = collecte(etat)
  return {
    kicker: 'CARNET DE NJANGI',
    title: etat.nom,
    sub: `Cotisation ${montantF(etat.cotisation)} · ${c.nbMembres} membre${c.nbMembres > 1 ? 's' : ''}`,
    tag: `${TAG[etat.periode]}${etat.tour}`,
    bigLabel: BIG_LABEL[etat.periode],
    big: montantF(c.collecte),
    pct: c.taux,
    subline: `${c.nbVerse} sur ${c.nbMembres} ont versé · reste ${montantF(c.reste)}`,
    listTitle: 'ÉTAT DES VERSEMENTS',
    items: etat.membres.map((m) => ({
      n: m.nom + (m.estAuTour ? ' — reçoit ce tour' : ''),
      ok: m.aVerse,
      warn: !m.aVerse,
      val: m.aVerse ? montantF(etat.cotisation) : '—',
    })),
    link: ctx.lien,
    stamp: arreteLe(ctx.maintenant),
  }
}

export function njangiShare(etat: EtatNjangi, ctx: RenderContext): ShareSpec {
  const c = collecte(etat)
  const tour = beneficiaireDuTour(etat)
  const periode = `${LIBELLE[etat.periode]} ${etat.tour}`

  // Un lien vide veut dire « pas encore publié » : on ne l'écrit pas plutôt que
  // d'envoyer quelqu'un sur une page qui n'existe pas.
  const lignes = [
    `${etat.nom.toUpperCase()} — ${periode}`,
    `Collecté : ${montantF(c.collecte)} sur ${montantF(c.attendu)}`,
    `Tour : ${tour?.nom ?? '—'}`,
    c.retardataires.length > 0
      ? `En attente : ${c.retardataires.map((m) => m.nom).join(', ')}`
      : 'Personne en retard',
    ctx.lien,
  ].filter((l) => l !== '')

  // La relance part du pouce du trésorier, jamais du serveur (invariant § 2.4) :
  // dans un njangi la dette est sociale, et seule son autorité compte.
  const relances: Relance[] = c.retardataires.map((m) => ({
    nom: m.nom,
    tel: m.tel ?? null,
    message:
      `Bonjour ${m.nom}. Njangi ${etat.nom}, ${periode} : ta part de ` +
      `${montantF(etat.cotisation)} n'est pas encore enregistrée. ` +
      (ctx.lien === '' ? '' : `L'état du carnet est ici : ${ctx.lien} — `) +
      `merci de régulariser dès que possible.`,
  }))

  return {
    title: etat.nom,
    desc: `${periode.charAt(0).toUpperCase()}${periode.slice(1)} · ${c.nbVerse} sur ${c.nbMembres} ont versé · reste ${montantF(c.reste)}`,
    name: `njangi-${TAG[etat.periode].toLowerCase()}${etat.tour}`,
    txt: lignes.join('\n'),
    broad: null,
    warn: null,
    card: njangiCard(etat, ctx),
    relances,
    relancesVides: 'Personne à relancer — tout le monde est à jour.',
  }
}

export const njangi: Skeleton<EtatNjangi> = {
  id: 'njangi',
  group: 'registres',
  title: 'Carnet de njangi',
  keywords: ['njangi', 'tontine', 'cotis', 'tour', 'membre', 'cagnotte'],
  engine: 'registre',
  schema: njangiSchema,
  defaults,
  compute: {
    collecte, fiabilite, estFiable, classementFiabilite, beneficiaireDuTour,
    prochainTour, basculerVersement, ajouterMembre, retirerMembre, changerCotisation,
  },
  card: njangiCard,
  share: njangiShare,
}
