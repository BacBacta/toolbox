import { piedLegal } from '@a237/legal-cm'
import {
  chiffrerFacture, controleLegal, dateEcheance, dateEmission, joursDeRetard,
  LIBELLE_MOYEN, LIBELLE_STATUT, statutFacture,
} from '../compute/facture.js'
import type { EtatFacture } from '../compute/facture.js'
import { prochainNumero } from '../compute/numerotation.js'
import { arreteLe, dateLongue, montantF, nf } from '../format.js'
import { factureSchema } from '../schema/facture.js'
import type { CardSpec, RenderContext, ShareSpec, Skeleton } from '../types.js'

/** Préfixe de numérotation de la facture. Le devis prend `DV`. */
export const PREFIXE_FACTURE = 'FA'

const TAG: Readonly<Record<string, string>> = {
  soldee: 'SOLDÉE',
  'en-retard': 'EN RETARD',
  partielle: 'PARTIELLE',
  'a-payer': 'À PAYER',
}

/**
 * État d'une facture neuve.
 *
 * `echeance` vaut la date d'émission : **payable à réception**. On ne met pas
 * trente jours par défaut — c'est une convention commerciale française, pas une
 * règle camerounaise, et le brief interdit d'inventer un délai (§ 9).
 * L'utilisateur fixe la sienne.
 */
const defaults: EtatFacture = {
  nom: 'Facture',
  encre: 'encre',
  numero: 'FA-2026-0001',
  emisLe: '2026-01-01T00:00:00.000Z',
  echeance: '2026-01-01T00:00:00.000Z',
  emetteur: {
    nom: '', forme: '', activite: '', adresse: '', tel: '', mail: '',
    rccm: '', niu: '', centre: '',
  },
  client: { nom: '', niu: '', estEntreprise: false },
  conditionsReglement: '',
  lignes: [],
  reglements: [],
}

export function factureCard(etat: EtatFacture, ctx: RenderContext): CardSpec {
  const c = chiffrerFacture(etat)
  const statut = statutFacture(etat, ctx.maintenant)
  const retard = joursDeRetard(etat, ctx.maintenant)

  const details = [
    `Total TTC ${montantF(c.totalTTC)}`,
    c.verse > 0 ? `versé ${montantF(c.verse)}` : null,
    statut === 'soldee'
      ? 'soldée'
      : retard > 0
        ? `${retard} jour${retard > 1 ? 's' : ''} de retard`
        : `échéance ${dateLongue(dateEcheance(etat))}`,
  ].filter((d): d is string => d !== null)

  return {
    kicker: 'FACTURE',
    title: etat.client.nom === '' ? etat.nom : etat.client.nom,
    sub: `N° ${etat.numero} · ${dateLongue(dateEmission(etat))}`,
    tag: TAG[statut] ?? null,
    bigLabel: statut === 'soldee' ? 'FACTURE RÉGLÉE' : 'RESTE À PAYER',
    big: montantF(c.reste),
    // Ici la barre a un sens, contrairement au devis : une facture se règle.
    pct: c.partReglee,
    subline: details.join(' · '),
    listTitle: 'DÉTAIL',
    items: c.lignes.map((l) => ({
      n: l.quantite === 1 ? l.designation : `${l.designation} × ${nf(l.quantite)}`,
      ok: true,
      warn: false,
      val: montantF(l.montantTTC),
    })),
    link: ctx.lien,
    stamp: arreteLe(ctx.maintenant),
  }
}

export function factureShare(etat: EtatFacture, ctx: RenderContext): ShareSpec {
  const c = chiffrerFacture(etat)
  const statut = statutFacture(etat, ctx.maintenant)
  const retard = joursDeRetard(etat, ctx.maintenant)
  const echeance = dateLongue(dateEcheance(etat))
  const bloquants = controleLegal(etat).filter((m) => m.gravite === 'bloquant')

  const lignes = [
    `FACTURE N° ${etat.numero}`,
    etat.emetteur.nom,
    `Client : ${etat.client.nom}`,
    `Total TTC : ${montantF(c.totalTTC)} (dont TVA 19,25 % : ${montantF(c.totalTVA)})`,
    c.verse > 0 ? `Déjà réglé : ${montantF(c.verse)}` : null,
    c.estSoldee ? 'Facture soldée — merci.' : `Reste à payer : ${montantF(c.reste)}`,
    c.estSoldee ? null : `Échéance : ${echeance}`,
    etat.conditionsReglement === '' ? null : etat.conditionsReglement,
    ctx.lien,
  ].filter((l): l is string => l !== null && l !== '')

  const detail = ctx.lien === '' ? '' : ` Le détail est ici : ${ctx.lien}`
  const message = retard > 0
    ? `Bonjour. La facture N° ${etat.numero} de ${etat.emetteur.nom}, de ` +
      `${montantF(c.reste)}, était à régler le ${echeance}.${detail}`
    : `Bonjour. Voici la facture N° ${etat.numero} de ${etat.emetteur.nom} : ` +
      `${montantF(c.reste)} à régler pour le ${echeance}.${detail}`

  return {
    title: `Facture ${etat.numero}`,
    desc: c.estSoldee
      ? `${etat.client.nom} · ${montantF(c.totalTTC)} TTC · soldée`
      : `${etat.client.nom} · reste ${montantF(c.reste)} sur ${montantF(c.totalTTC)} TTC · ${LIBELLE_STATUT[statut].toLowerCase()}`,
    name: `facture-${etat.numero.toLowerCase()}`,
    txt: lignes.join('\n'),
    broad: null,
    warn:
      bloquants.length > 0
        ? `Cette facture n'est pas complète : il manque ${bloquants.map((m) => m.libelle).join(', ')}. ` +
          `Sans ces mentions, ton client ne pourra pas la déduire, et elle ne tiendra pas devant un contrôle.`
        : null,
    card: factureCard(etat, ctx),
    // Une facture s'adresse à un client, pas à un groupe.
    relances: c.estSoldee || etat.client.nom === ''
      ? []
      : [{ nom: etat.client.nom, tel: etat.client.tel ?? null, message }],
    relancesVides: c.estSoldee
      ? 'Facture soldée — rien à relancer.'
      : 'Renseigne le client pour préparer l’envoi.',
  }
}

export const facture: Skeleton<EtatFacture> = {
  id: 'facture',
  group: 'documents',
  title: 'Facture',
  keywords: ['facture', 'facturation', 'note a payer', 'impaye', 'creance'],
  engine: 'doc',
  schema: factureSchema,
  defaults,
  initialiser: (ctx) => ({
    ...defaults,
    // Premier numéro de l'année en cours. L'app rappelle `prochainNumero` avec
    // les numéros déjà émis par le compte : c'est là que la continuité se joue.
    numero: prochainNumero(PREFIXE_FACTURE, [], ctx.maintenant),
    emisLe: ctx.maintenant.toISOString(),
    echeance: ctx.maintenant.toISOString(),
  }),
  compute: {
    chiffrerFacture, statutFacture, joursDeRetard, controleLegal,
    dateEmission, dateEcheance, prochainNumero, piedLegal,
  },
  card: factureCard,
  share: factureShare,
}

export { LIBELLE_MOYEN, LIBELLE_STATUT }
