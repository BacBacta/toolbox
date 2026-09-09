import { piedLegal } from '@a237/legal-cm'
import {
  controleDette, controleEmetteur, totauxRecu,
} from '../compute/actes.js'
import type {
  EtatAttestation, EtatDette, EtatMotivation, EtatRecu,
} from '../compute/actes.js'
import { dateEmission } from '../compute/document.js'
import { PREFIXES_NUMERO, prochainNumero } from '../compute/numerotation.js'
import { arreteLe, dateLongue, montantF } from '../format.js'
import { montantEnLettres } from '../lettres.js'
import {
  attestationSchema, detteSchema, motivationSchema, recuSchema,
} from '../schema/actes.js'
import type { CardSpec, RenderContext, ShareSpec, Skeleton } from '../types.js'

/**
 * Les quatre actes et lettres.
 *
 * Aucun ne porte de TVA ni de tableau taxé : ce qui les rassemble, c'est d'être
 * des documents A4 qui ne sont pas des documents d'affaires. Ils partagent le
 * papier, pas la fiscalité.
 *
 * Chacun part **vide**. Le prototype porte les données de Serge Mbarga et de la
 * Quincaillerie Bépanda ; quelqu'un qui ouvre une attestation ne doit pas
 * trouver le nom d'un inconnu dedans. Ce qui reste comme valeur de départ est ce
 * qui est vrai pour tout le monde : un format de numéro, une encre, le squelette
 * d'un engagement.
 */

const EMETTEUR_VIDE = {
  nom: '', forme: '', activite: '', adresse: '', tel: '', mail: '',
  rccm: '', niu: '', centre: '',
}

const LE_1ER_JANVIER = '2026-01-01T00:00:00.000Z'

// ────────────────────────────── attestation ──────────────────────────────

export const PREFIXE_ATTESTATION = PREFIXES_NUMERO.attestation!

const attestationDefaults: EtatAttestation = {
  nom: 'Attestation',
  encre: 'encre',
  numero: 'AT-2026-0001',
  emisLe: LE_1ER_JANVIER,
  emetteur: EMETTEUR_VIDE,
  objet: 'Attestation de travail',
  texte: '',
}

export function attestationCard(etat: EtatAttestation, ctx: RenderContext): CardSpec {
  return {
    kicker: 'ATTESTATION',
    title: etat.objet === '' ? etat.nom : etat.objet,
    sub: etat.emetteur.nom === '' ? `N° ${etat.numero}` : `${etat.emetteur.nom} · N° ${etat.numero}`,
    tag: null,
    bigLabel: 'DÉLIVRÉE LE',
    big: dateLongue(dateEmission(etat)),
    pct: null,
    subline: piedLegal(etat.emetteur),
    listTitle: '',
    // Le corps d'une attestation ne se met pas sur une carte : ce qu'elle
    // certifie regarde son destinataire, pas une discussion de groupe.
    items: [],
    link: ctx.lien,
    stamp: arreteLe(ctx.maintenant),
  }
}

function partageActe(
  titre: string,
  desc: string,
  nomFichier: string,
  texte: readonly (string | null)[],
  carte: CardSpec,
  manquants: readonly string[],
): ShareSpec {
  return {
    title: titre,
    desc,
    name: nomFichier,
    txt: texte.filter((l): l is string => l !== null && l !== '').join('\n'),
    broad: null,
    warn:
      manquants.length === 0
        ? null
        : `Ce document n’est pas complet : il manque ${manquants.join(', ')}.`,
    card: carte,
    // Un acte s'adresse à une personne nommée, jamais à un groupe.
    relances: [],
    relancesVides: 'Un document se remet en main propre ou s’envoie à une personne.',
  }
}

export function attestationShare(etat: EtatAttestation, ctx: RenderContext): ShareSpec {
  const bloquants = controleEmetteur(etat).filter((m) => m.gravite === 'bloquant')
  return partageActe(
    etat.objet === '' ? 'Attestation' : etat.objet,
    `${etat.emetteur.nom} · N° ${etat.numero}`,
    `attestation-${etat.numero.toLowerCase()}`,
    [
      (etat.objet === '' ? 'ATTESTATION' : etat.objet.toUpperCase()) + ` N° ${etat.numero}`,
      etat.emetteur.nom,
      `Délivrée le ${dateLongue(dateEmission(etat))}`,
      ctx.lien,
    ],
    attestationCard(etat, ctx),
    bloquants.map((m) => m.libelle),
  )
}

export const attestation: Skeleton<EtatAttestation> = {
  id: 'attestation',
  group: 'documents',
  title: 'Attestation',
  keywords: [
    'attestation', 'certificat', 'preuve emploi', 'travail', 'attestation de travail',
    'certifier', 'temoignage ecrit',
  ],
  engine: 'doc',
  schema: attestationSchema,
  defaults: attestationDefaults,
  initialiser: (ctx) => ({
    ...attestationDefaults,
    numero: prochainNumero(PREFIXE_ATTESTATION, [], ctx.maintenant),
    emisLe: ctx.maintenant.toISOString(),
  }),
  compute: { controleEmetteur, dateEmission, prochainNumero, piedLegal },
  card: attestationCard,
  share: attestationShare,
}

// ───────────────────────────────── reçu ─────────────────────────────────

export const PREFIXE_RECU = PREFIXES_NUMERO.recu!

const recuDefaults: EtatRecu = {
  nom: 'Reçu',
  encre: 'foret',
  numero: 'RE-2026-0001',
  emisLe: LE_1ER_JANVIER,
  emetteur: EMETTEUR_VIDE,
  recuDe: '',
  lignes: [],
  avance: 0,
}

export function recuCard(etat: EtatRecu, ctx: RenderContext): CardSpec {
  const t = totauxRecu(etat)
  return {
    kicker: 'REÇU',
    title: etat.recuDe === '' ? etat.nom : etat.recuDe,
    sub: `N° ${etat.numero} · ${dateLongue(dateEmission(etat))}`,
    tag: null,
    bigLabel: 'SOMME REÇUE',
    big: montantF(t.avance),
    // Ce qui reste à payer sur ce qui était dû : la barre le dit d'un coup d'œil.
    pct: t.total === 0 ? null : Math.min(1, t.avance / t.total),
    subline:
      t.reste === 0
        ? 'Soldé.'
        : `Total ${montantF(t.total)} · reste ${montantF(t.reste)}`,
    listTitle: 'DÉTAIL',
    items: etat.lignes.map((l) => ({
      n: l.designation, ok: true, warn: false, val: montantF(l.montant),
    })),
    link: ctx.lien,
    stamp: arreteLe(ctx.maintenant),
  }
}

export function recuShare(etat: EtatRecu, ctx: RenderContext): ShareSpec {
  const t = totauxRecu(etat)
  const bloquants = controleEmetteur(etat).filter((m) => m.gravite === 'bloquant')
  return partageActe(
    `Reçu ${etat.numero}`,
    `${etat.recuDe} · ${montantF(t.avance)} reçus`,
    `recu-${etat.numero.toLowerCase()}`,
    [
      `REÇU N° ${etat.numero}`,
      etat.emetteur.nom,
      etat.recuDe === '' ? null : `Reçu de : ${etat.recuDe}`,
      `Somme reçue : ${montantF(t.avance)}`,
      t.reste === 0 ? 'Soldé.' : `Reste à payer : ${montantF(t.reste)}`,
      ctx.lien,
    ],
    recuCard(etat, ctx),
    bloquants.map((m) => m.libelle),
  )
}

export const recu: Skeleton<EtatRecu> = {
  id: 'recu',
  group: 'documents',
  title: 'Reçu',
  keywords: [
    'recu', 'quittance', 'acompte', 'j ai recu', 'preuve de paiement', 'versement recu',
  ],
  engine: 'doc',
  schema: recuSchema,
  defaults: recuDefaults,
  initialiser: (ctx) => ({
    ...recuDefaults,
    numero: prochainNumero(PREFIXE_RECU, [], ctx.maintenant),
    emisLe: ctx.maintenant.toISOString(),
  }),
  compute: { totauxRecu, controleEmetteur, dateEmission, prochainNumero, piedLegal },
  card: recuCard,
  share: recuShare,
}

// ───────────────────────── reconnaissance de dette ─────────────────────────

/** L'engagement type. Il n'identifie personne : les parties se saisissent. */
const ENGAGEMENT_TYPE =
  'Je soussigné, emprunteur désigné ci-dessus, reconnais avoir reçu du prêteur, ' +
  'à titre de prêt sans intérêt, la somme portée au présent acte.\n\n' +
  'Je m’engage à rembourser cette somme au plus tard à la date d’échéance ' +
  'indiquée, en un ou plusieurs versements, au domicile du prêteur ou par ' +
  'mobile money.'

const detteDefaults: EtatDette = {
  nom: 'Reconnaissance de dette',
  encre: 'bordeaux',
  emisLe: LE_1ER_JANVIER,
  emprunteur: { nom: '', piece: '' },
  preteur: { nom: '', piece: '' },
  montant: 0,
  echeance: '',
  lieu: '',
  texte: ENGAGEMENT_TYPE,
}

export function detteCard(etat: EtatDette, ctx: RenderContext): CardSpec {
  return {
    kicker: 'RECONNAISSANCE DE DETTE',
    title: etat.emprunteur.nom === '' ? etat.nom : etat.emprunteur.nom,
    sub: etat.preteur.nom === '' ? 'Acte sous seing privé' : `envers ${etat.preteur.nom}`,
    tag: null,
    bigLabel: 'MONTANT DU PRÊT',
    big: montantF(etat.montant),
    pct: null,
    // Le montant en toutes lettres suit le chiffre partout où il apparaît.
    subline:
      etat.montant <= 0
        ? 'Montant à renseigner'
        : `Soit ${montantEnLettres(etat.montant)}. Échéance : ${etat.echeance || 'à fixer'}`,
    listTitle: '',
    items: [],
    link: ctx.lien,
    stamp: arreteLe(ctx.maintenant),
  }
}

export function detteShare(etat: EtatDette, ctx: RenderContext): ShareSpec {
  const manque = controleDette(etat)
  return partageActe(
    'Reconnaissance de dette',
    `${montantF(etat.montant)} · échéance ${etat.echeance || 'à fixer'}`,
    'reconnaissance-de-dette',
    [
      'RECONNAISSANCE DE DETTE',
      etat.emprunteur.nom === '' ? null : `Emprunteur : ${etat.emprunteur.nom}`,
      etat.preteur.nom === '' ? null : `Prêteur : ${etat.preteur.nom}`,
      `Montant : ${montantF(etat.montant)}`,
      etat.montant <= 0 ? null : `Soit ${montantEnLettres(etat.montant)}.`,
      etat.echeance === '' ? null : `Échéance : ${etat.echeance}`,
      ctx.lien,
    ],
    detteCard(etat, ctx),
    manque.map((m) => m.libelle),
  )
}

export const dette: Skeleton<EtatDette> = {
  id: 'dette',
  group: 'documents',
  title: 'Reconnaissance de dette',
  keywords: [
    'reconnaissance', 'reconnaissance de dette', 'dette ecrite', 'pret', 'emprunt',
    'j ai prete', 'papier de dette', 'engagement ecrit',
  ],
  engine: 'doc',
  schema: detteSchema,
  defaults: detteDefaults,
  initialiser: (ctx) => ({ ...detteDefaults, emisLe: ctx.maintenant.toISOString() }),
  compute: { controleDette, dateEmission, montantEnLettres },
  card: detteCard,
  share: detteShare,
}

// ───────────────────────── lettre de motivation ─────────────────────────

const motivationDefaults: EtatMotivation = {
  nom: 'Lettre de motivation',
  encre: 'encre',
  emisLe: LE_1ER_JANVIER,
  expediteur: { nom: '', tel: '', mail: '', ville: '' },
  destinataire: '',
  objet: 'Objet : candidature au poste de',
  corps: '',
}

export function motivationCard(etat: EtatMotivation, ctx: RenderContext): CardSpec {
  return {
    kicker: 'LETTRE DE MOTIVATION',
    title: etat.expediteur.nom === '' ? etat.nom : etat.expediteur.nom,
    sub: etat.objet,
    tag: null,
    bigLabel: 'ÉCRITE LE',
    big: dateLongue(dateEmission(etat)),
    pct: null,
    subline: [etat.expediteur.ville, etat.expediteur.tel].filter((s) => s !== '').join(' · '),
    listTitle: '',
    items: [],
    link: ctx.lien,
    stamp: arreteLe(ctx.maintenant),
  }
}

export function motivationShare(etat: EtatMotivation, ctx: RenderContext): ShareSpec {
  const manque: string[] = []
  if (etat.expediteur.nom.trim() === '') manque.push('ton nom')
  if (etat.destinataire.trim() === '') manque.push('le destinataire')
  if (etat.corps.trim() === '') manque.push('le corps de la lettre')

  return partageActe(
    'Lettre de motivation',
    etat.objet,
    'lettre-de-motivation',
    [
      etat.objet,
      etat.expediteur.nom,
      [etat.expediteur.tel, etat.expediteur.mail].filter((s) => s !== '').join(' · '),
      ctx.lien,
    ],
    motivationCard(etat, ctx),
    manque,
  )
}

export const motivation: Skeleton<EtatMotivation> = {
  id: 'motivation',
  group: 'documents',
  title: 'Lettre de motivation',
  keywords: [
    'lettre', 'motivation', 'lettre de motivation', 'demande d emploi', 'candidature',
    'postuler', 'demande de stage',
  ],
  engine: 'doc',
  schema: motivationSchema,
  defaults: motivationDefaults,
  initialiser: (ctx) => ({ ...motivationDefaults, emisLe: ctx.maintenant.toISOString() }),
  compute: { dateEmission },
  card: motivationCard,
  share: motivationShare,
}

/** Les actes, dans l'ordre où ils s'affichent. */
export const ACTES = [attestation, recu, dette, motivation] as const
