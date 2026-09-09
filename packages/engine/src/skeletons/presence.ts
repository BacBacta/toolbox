import {
  appel, assiduites, decroche, nomSeance,
} from '../compute/presence.js'
import type { EtatPresence } from '../compute/presence.js'
import { arreteLe } from '../format.js'
import { presenceSchema } from '../schema/presence.js'
import type { CardSpec, Relance, RenderContext, ShareSpec, Skeleton } from '../types.js'

/**
 * La feuille de présence.
 *
 * Elle part vide : le prototype portait douze noms d'une association qui
 * n'existe pas, et une feuille neuve doit être celle de l'utilisateur.
 *
 * Elle se partage par séance, jamais en bloc : ce qui intéresse le groupe,
 * c'est l'appel du jour, et une feuille qui déballerait le taux d'assiduité de
 * chacun devant tout le monde ferait le même tort qu'une ardoise publiée.
 */

const presenceDefaults: EtatPresence = {
  nom: 'Feuille de présence',
  encre: 'foret',
  noms: [],
  seances: [],
}

/** L'index de la séance à montrer par défaut : la dernière ouverte. */
export function derniereSeance(etat: EtatPresence): number {
  return Math.max(0, etat.seances.length - 1)
}

export function presenceCard(
  etat: EtatPresence,
  ctx: RenderContext,
  seance = derniereSeance(etat),
): CardSpec {
  const a = appel(etat, seance)
  return {
    kicker: 'FEUILLE DE PRÉSENCE',
    title: etat.nom,
    sub: `${etat.seances.length} séance${etat.seances.length > 1 ? 's' : ''} enregistrée${etat.seances.length > 1 ? 's' : ''}`,
    tag: etat.seances.length === 0 ? null : nomSeance(etat, seance),
    bigLabel: 'PRÉSENTS',
    big: `${a.presents} / ${a.total}`,
    pct: a.taux,
    subline: `${Math.round(a.taux * 100)} % de présence à cette séance`,
    listTitle: 'APPEL',
    items: etat.noms.map((nom, i) => {
      const present = etat.seances[seance]?.presents[i] === true
      return { n: nom, ok: present, warn: !present, val: present ? 'présent' : 'absent' }
    }),
    link: ctx.lien,
    stamp: arreteLe(ctx.maintenant),
  }
}

export function presenceShare(
  etat: EtatPresence,
  ctx: RenderContext,
  seance = derniereSeance(etat),
): ShareSpec {
  const a = appel(etat, seance)
  const titre = nomSeance(etat, seance)

  // Une relance par absent, envoyée à la main. Le moteur n'a pas les numéros :
  // la feuille ne demande que des noms, et un `tel` nul fait basculer
  // l'interface sur « copier le message ».
  const relances: Relance[] = a.absents.map((nom) => ({
    nom,
    tel: null,
    message:
      `Bonjour ${nom}. Tu n'as pas été marqué présent à la ${titre} de ${etat.nom}. ` +
      (ctx.lien === '' ? '' : `La feuille est ici : ${ctx.lien}`),
  }))

  const lignes = [
    `${etat.nom.toUpperCase()} — ${titre}`,
    `Présents : ${a.presents} / ${a.total}`,
    a.absents.length === 0 ? '' : `Absents : ${a.absents.join(', ')}`,
    ctx.lien,
  ]

  return {
    title: etat.nom,
    desc: `${titre} · ${a.presents} présents sur ${a.total}`,
    name: `presence-s${seance + 1}`,
    txt: lignes.filter((l) => l !== '').join('\n'),
    broad: null,
    // Le détail de l'assiduité ne part pas : c'est l'appel du jour qui se
    // partage, pas le taux de chacun sur six mois.
    warn:
      assiduites(etat).some(decroche)
        ? 'La carte ne montre que l’appel du jour. Le taux d’assiduité de chacun reste sur ton téléphone.'
        : null,
    card: presenceCard(etat, ctx, seance),
    relances,
    relancesVides: 'Tout le monde était là — rien à envoyer.',
  }
}

export const presence: Skeleton<EtatPresence> = {
  id: 'presence',
  group: 'registres',
  title: 'Feuille de présence',
  keywords: [
    'presence', 'appel', 'absence', 'assiduite', 'qui est venu', 'liste de presence',
    'emargement', 'reunion', 'seance', 'cours',
  ],
  engine: 'registre',
  schema: presenceSchema,
  defaults: presenceDefaults,
  compute: { appel, assiduites, decroche, nomSeance },
  card: (etat, ctx) => presenceCard(etat, ctx),
  share: (etat, ctx) => presenceShare(etat, ctx),
}
