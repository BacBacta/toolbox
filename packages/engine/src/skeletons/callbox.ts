import {
  journees, operationsDuJour, totauxCallbox,
} from '../compute/callbox.js'
import type { EtatCallbox } from '../compute/callbox.js'
import { arreteLe, jourWAT, montantF, nf } from '../format.js'
import { callboxSchema } from '../schema/callbox.js'
import type { CardSpec, RenderContext, ShareSpec, Skeleton } from '../types.js'

/**
 * Le call-box.
 *
 * La grille de départ est celle qu'on trouve dans la rue, en francs ronds. Ce
 * n'est pas la donnée de quelqu'un — c'est un tarif d'usage, que chacun corrige
 * à sa main dès le premier écran. Une grille vide obligerait à saisir quatre
 * tranches avant de pouvoir calculer quoi que ce soit.
 */

const callboxDefaults: EtatCallbox = {
  nom: 'Call-box',
  encre: 'ardoise',
  tranches: [
    { plafond: 5_000, commission: 100 },
    { plafond: 25_000, commission: 200 },
    { plafond: 100_000, commission: 500 },
    // Plafond zéro : la tranche qui attrape tout le reste.
    { plafond: 0, commission: 1_000 },
  ],
  operations: [],
}

export function callboxCard(etat: EtatCallbox, ctx: RenderContext): CardSpec {
  const jour = jourWAT(ctx.maintenant)
  const duJour = operationsDuJour(etat.operations, jour)
  const t = totauxCallbox(duJour)
  return {
    kicker: 'CALL-BOX',
    title: etat.nom,
    sub: `${t.nombre} opération${t.nombre > 1 ? 's' : ''} aujourd’hui`,
    tag: null,
    bigLabel: 'GAIN DU JOUR',
    big: montantF(t.gagne),
    pct: null,
    subline: `${montantF(t.volume)} passés par la caisse`,
    listTitle: 'DERNIÈRES OPÉRATIONS',
    // Les plus récentes d'abord : c'est la fin de journée qu'on vérifie.
    items: [...duJour].reverse().slice(0, 10).map((o) => ({
      n: `${o.heure} · ${nf(o.montant)} F`,
      ok: true,
      warn: false,
      val: montantF(o.commission),
    })),
    link: ctx.lien,
    stamp: arreteLe(ctx.maintenant),
  }
}

export function callboxShare(etat: EtatCallbox, ctx: RenderContext): ShareSpec {
  const jour = jourWAT(ctx.maintenant)
  const t = totauxCallbox(operationsDuJour(etat.operations, jour))
  return {
    title: etat.nom,
    desc: `Gain du jour ${montantF(t.gagne)} · ${t.nombre} opération${t.nombre > 1 ? 's' : ''}`,
    name: `callbox-${jour}`,
    txt: [
      `${etat.nom.toUpperCase()} — gain du jour ${montantF(t.gagne)}`,
      `${t.nombre} opération${t.nombre > 1 ? 's' : ''} · ${montantF(t.volume)} de volume`,
      ctx.lien,
    ].filter((l) => l !== '').join('\n'),
    broad: null,
    // Une recette de la journée n'est pas une information à faire circuler.
    warn:
      'Cette carte dit ce que tu as gagné aujourd’hui. Elle est pour toi ou pour ' +
      'ton patron, pas pour un groupe.',
    card: callboxCard(etat, ctx),
    // Un call-box n'a personne à relancer : le client paie et s'en va.
    relances: [],
    relancesVides: 'Un call-box encaisse comptant — il n’y a personne à relancer.',
  }
}

export const callbox: Skeleton<EtatCallbox> = {
  id: 'callbox',
  group: 'calculs',
  title: 'Call-box',
  keywords: [
    'call box', 'callbox', 'transfert', 'momo', 'mobile money', 'commission',
    'orange money', 'depot retrait', 'je transfere', 'cabine',
  ],
  engine: 'registre',
  schema: callboxSchema,
  defaults: callboxDefaults,
  compute: { journees, operationsDuJour, totauxCallbox, jourWAT },
  card: callboxCard,
  share: callboxShare,
}
