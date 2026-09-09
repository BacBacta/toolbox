import { piedLegal } from '@a237/legal-cm'
import { chiffrer, controleLegal, dateEmission } from '../compute/devis.js'
import { PREFIXES_NUMERO, prochainNumero } from '../compute/numerotation.js'
import type { EtatDevis } from '../compute/devis.js'
import { arreteLe, dateLongue, montantF, nf } from '../format.js'
import { devisSchema } from '../schema/devis.js'
import type { CardSpec, RenderContext, ShareSpec, Skeleton } from '../types.js'
import type { Extrait } from '../extraire.js'

/** Préfixe de numérotation du devis. La facture prendra `FA`. */
export const PREFIXE_DEVIS = PREFIXES_NUMERO.devis!

/**
 * État de remplissage d'un devis neuf.
 *
 * L'émetteur est vide : on ne livre pas à tout le monde la raison sociale d'une
 * quincaillerie de Bépanda parce qu'elle sert d'exemple dans le prototype.
 * `numero` et `emisLe` sont des valeurs de remplissage conformes au schéma, que
 * `initialiser` remplace à la création.
 */
const defaults: EtatDevis = {
  nom: 'Devis',
  encre: 'encre',
  numero: 'DV-2026-0001',
  emisLe: '2026-01-01T00:00:00.000Z',
  emetteur: {
    nom: '', forme: '', activite: '', adresse: '', tel: '', mail: '',
    rccm: '', niu: '', centre: '',
  },
  client: { nom: '', niu: '', estEntreprise: false },
  validite: '15 jours',
  acompte: 50,
  lignes: [],
}

export function devisCard(etat: EtatDevis, ctx: RenderContext): CardSpec {
  const c = chiffrer(etat)
  return {
    kicker: 'DEVIS',
    title: etat.client.nom === '' ? etat.nom : etat.client.nom,
    sub: `N° ${etat.numero} · ${dateLongue(dateEmission(etat))}`,
    tag: null,
    bigLabel: 'TOTAL TTC',
    big: montantF(c.totalTTC),
    // Pas de barre de progression : un devis n'avance pas, il est accepté ou non.
    pct: null,
    subline: `HT ${montantF(c.totalHT)} · TVA 19,25 % ${montantF(c.totalTVA)} · validité ${etat.validite}`,
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

export function devisShare(etat: EtatDevis, ctx: RenderContext): ShareSpec {
  const c = chiffrer(etat)
  const bloquants = controleLegal(etat).filter((m) => m.gravite === 'bloquant')

  const lignes = [
    `DEVIS N° ${etat.numero}`,
    etat.emetteur.nom,
    `Client : ${etat.client.nom}`,
    `Total TTC : ${montantF(c.totalTTC)} (dont TVA 19,25 % : ${montantF(c.totalTVA)})`,
    etat.acompte > 0 ? `Acompte à la commande : ${etat.acompte} % — ${montantF(c.acompteDu)}` : null,
    `Validité : ${etat.validite}`,
    ctx.lien,
  ].filter((l): l is string => l !== null && l !== '')

  return {
    title: `Devis ${etat.numero}`,
    desc: `${etat.client.nom} · ${montantF(c.totalTTC)} TTC · validité ${etat.validite}`,
    name: `devis-${etat.numero.toLowerCase()}`,
    txt: lignes.join('\n'),
    broad: null,
    warn:
      bloquants.length > 0
        ? `Ce devis n'est pas complet : il manque ${bloquants.map((m) => m.libelle).join(', ')}. ` +
          `Sans ces mentions, un client qui veut déduire ne pourra pas s'en servir.`
        : null,
    card: devisCard(etat, ctx),
    // Un devis s'envoie à un client, pas dans un groupe.
    relances: etat.client.nom === '' ? [] : [{
      nom: etat.client.nom,
      tel: etat.client.tel ?? null,
      message:
        `Bonjour. Voici le devis N° ${etat.numero} de ${etat.emetteur.nom} : ` +
        `${montantF(c.totalTTC)} TTC, valable ${etat.validite}.` +
        (ctx.lien === '' ? '' : ` Le détail est ici : ${ctx.lien}`),
    }],
    relancesVides: 'Renseigne le client pour préparer l’envoi.',
  }
}

/**
 * Un devis ne retient que l'acompte.
 *
 * Une somme dans « devis de 250 000 F » ne dit pas ce qu'elle est : un total
 * annoncé, une ligne, un budget à ne pas dépasser. L'écrire dans le document
 * serait inventer une ligne que personne n'a chiffrée. « Acompte de 30 % »,
 * en revanche, ne veut dire qu'une chose.
 */
function garnir(etat: EtatDevis, extrait: Extrait): EtatDevis {
  return extrait.pourcent === null ? etat : { ...etat, acompte: extrait.pourcent }
}

export const devis: Skeleton<EtatDevis> = {
  id: 'devis',
  group: 'documents',
  title: 'Devis',
  keywords: ['devis', 'proposition', 'chiffrage', 'estimation', 'cotation', 'pro forma', 'proforma', 'offre de prix', 'ca va couter'],
  engine: 'doc',
  schema: devisSchema,
  defaults,
  initialiser: (ctx) => ({
    ...defaults,
    numero: prochainNumero(PREFIXE_DEVIS, [], ctx.maintenant),
    emisLe: ctx.maintenant.toISOString(),
  }),
  compute: { chiffrer, controleLegal, dateEmission, prochainNumero, piedLegal },
  garnir,
  card: devisCard,
  share: devisShare,
}
