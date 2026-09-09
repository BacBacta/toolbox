import {
  joursOuverts, ordonner, totaux, vieillissement, vueDettes,
} from '../compute/ardoise.js'
import type { DetteVue, EtatArdoise } from '../compute/ardoise.js'
import { arreteLe, montantF, nf } from '../format.js'
import { ardoiseSchema } from '../schema/ardoise.js'
import type { CardItem, CardSpec, Relance, RenderContext, ShareSpec, Skeleton } from '../types.js'

/**
 * L'ardoise des clients.
 *
 * Elle part vide et sans nom de boutique : le prototype portait « Quincaillerie
 * Bépanda » et trois clients nommés, et personne ne doit ouvrir son ardoise sur
 * les dettes d'un inconnu.
 */

const ardoiseDefaults: EtatArdoise = {
  nom: 'Ardoise clients',
  encre: 'bordeaux',
  boutique: '',
  dettes: [],
}

/**
 * L'avertissement du brief § 2.5, mot pour mot.
 *
 * Il ne se reformule pas et il ne se met pas en option. C'est le seul endroit
 * de l'atelier où l'outil dit non à ce que l'utilisateur s'apprête à faire, et
 * il le dit pour une raison qui n'est pas technique.
 */
export const AVERTISSEMENT_ARDOISE =
  'Cette carte est pour toi, pas pour un groupe. Une ardoise publiée avec les ' +
  'noms, c’est de l’humiliation — et on perd le client en même temps que ' +
  'l’argent. Ce qui part dans WhatsApp, ce sont les relances individuelles.'

function nomBoutique(etat: EtatArdoise): string {
  return etat.boutique.trim() === '' ? etat.nom : etat.boutique
}

function ligneDette(v: DetteVue): CardItem {
  // L'âge ne s'écrit que s'il dit quelque chose : « · 0 j » sur une dette
  // ouverte le matin même est du bruit, comme sur une dette réglée.
  return {
    n: v.regle || v.jours === 0 ? v.client : `${v.client} · ${v.jours} j`,
    ok: v.regle,
    warn: v.enRetard,
    val: montantF(v.montant),
  }
}

export function ardoiseCard(etat: EtatArdoise, ctx: RenderContext): CardSpec {
  const vues = vueDettes(etat, ctx.maintenant)
  const t = totaux(vues)
  return {
    kicker: 'ARDOISE CLIENTS',
    title: nomBoutique(etat),
    sub: `${t.ouverts} client${t.ouverts > 1 ? 's' : ''} ouvert${t.ouverts > 1 ? 's' : ''}`,
    tag: null,
    bigLabel: 'ENCOURS TOTAL',
    big: montantF(t.encours),
    pct: t.part,
    subline:
      `${montantF(t.recouvre)} déjà recouvrés · ${t.enRetard} client` +
      `${t.enRetard > 1 ? 's' : ''} au-delà de 30 jours`,
    listTitle: 'DÉTAIL',
    items: ordonner(vues).slice(0, 12).map(ligneDette),
    link: ctx.lien,
    stamp: arreteLe(ctx.maintenant),
  }
}

export function ardoiseShare(etat: EtatArdoise, ctx: RenderContext): ShareSpec {
  const vues = vueDettes(etat, ctx.maintenant)
  const t = totaux(vues)
  const ouvertes = ordonner(vues).filter((v) => !v.regle)
  const boutique = nomBoutique(etat)

  // La relance part du pouce du commerçant, jamais du serveur (invariant § 2.4).
  const relances: Relance[] = ouvertes.map((v) => ({
    nom: v.client,
    tel: v.tel ?? null,
    message:
      `Bonjour ${v.client}. Chez ${boutique}, il reste ${montantF(v.montant)} ` +
      `ouverts depuis ${v.jours} jour${v.jours > 1 ? 's' : ''}. ` +
      (ctx.lien === '' ? '' : `Le détail est ici : ${ctx.lien} — `) +
      'quand pouvez-vous passer, même pour un premier versement ?',
  }))

  const lignes = [
    `${boutique.toUpperCase()} — encours ${montantF(t.encours)}`,
    ...ouvertes.map((v) => `• ${v.client} — ${nf(v.montant)} F (${v.jours} j)`),
  ]

  return {
    title: boutique,
    desc:
      `Encours ${montantF(t.encours)} · ${t.ouverts} client${t.ouverts > 1 ? 's' : ''} · ` +
      `${t.enRetard} au-delà de 30 jours`,
    name: 'ardoise',
    txt: lignes.join('\n'),
    broad: null,
    warn: AVERTISSEMENT_ARDOISE,
    card: ardoiseCard(etat, ctx),
    relances,
    relancesVides: 'Personne à relancer — tout est réglé.',
  }
}

export const ardoise: Skeleton<EtatArdoise> = {
  id: 'ardoise',
  group: 'registres',
  title: 'Ardoise clients',
  keywords: [
    'ardoise', 'dette', 'credit', 'doit', 'creance', 'impaye', 'on me doit',
    'qui me doit', 'carnet de dettes', 'recouvrement',
  ],
  engine: 'registre',
  schema: ardoiseSchema,
  defaults: ardoiseDefaults,
  compute: { joursOuverts, ordonner, totaux, vieillissement, vueDettes },
  card: ardoiseCard,
  share: ardoiseShare,
}
