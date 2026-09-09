import {
  changerValeur, partCalc, precisionCalc, resultatCalc, schemaCalc, valeurDe,
  valeursParDefaut,
} from '../compute/calc.js'
import type { ConfigCalc, EtatCalc } from '../compute/calc.js'
import { arreteLe, montantF, nf } from '../format.js'
import type {
  CardSpec, RenderContext, ShareSpec, Skeleton, SkeletonGroup, SkeletonId,
} from '../types.js'

/** La fabrique de calculatrices. Même principe que celle des registres. */

export interface DefinitionCalc {
  readonly id: SkeletonId
  readonly title: string
  readonly group: SkeletonGroup
  readonly keywords: readonly string[]
  readonly config: ConfigCalc
  readonly titreNom: string
  readonly relancesVides: string
}

function afficher(valeur: number, unite: 'F' | ''): string {
  return unite === 'F' ? montantF(valeur) : nf(valeur)
}

/** Un squelette de calcul porte sa configuration, pour la même raison. */
export type SqueletteCalc = Skeleton<EtatCalc> & { readonly config: ConfigCalc }

export function squeletteCalc(def: DefinitionCalc): SqueletteCalc {
  const config = def.config

  const card = (etat: EtatCalc, ctx: RenderContext): CardSpec => {
    const precision = precisionCalc(config, etat)
    return {
      kicker: config.kicker,
      title: etat.nom,
      sub: def.title,
      tag: null,
      bigLabel: config.sortie.libelle.toUpperCase(),
      big: afficher(resultatCalc(config, etat), config.sortie.unite),
      pct: partCalc(config, etat),
      subline: precision ?? def.title,
      listTitle: 'CE QUI A ÉTÉ SAISI',
      items: config.entrees.map((e) => ({
        n: e.titre,
        ok: true,
        warn: false,
        val: afficher(valeurDe(etat, e.clef), e.unite),
      })),
      link: ctx.lien,
      stamp: arreteLe(ctx.maintenant),
    }
  }

  const share = (etat: EtatCalc, ctx: RenderContext): ShareSpec => {
    const precision = precisionCalc(config, etat)
    const lignes = [
      `${etat.nom.toUpperCase()} — ${def.title.toLowerCase()}`,
      ...config.entrees.map((e) => `${e.titre} : ${afficher(valeurDe(etat, e.clef), e.unite)}`),
      `${config.sortie.libelle} : ${afficher(resultatCalc(config, etat), config.sortie.unite)}`,
      precision ?? '',
      ctx.lien,
    ].filter((l) => l !== '')

    return {
      title: etat.nom,
      desc: `${config.sortie.libelle} : ${afficher(resultatCalc(config, etat), config.sortie.unite)}`,
      name: def.id,
      txt: lignes.join('\n'),
      broad: null,
      warn: null,
      card: card(etat, ctx),
      relances: [],
      relancesVides: def.relancesVides,
    }
  }

  return {
    id: def.id,
    group: def.group,
    title: def.title,
    keywords: def.keywords,
    engine: 'calc',
    config,
    schema: schemaCalc(config, def.titreNom),
    defaults: { nom: def.title, valeurs: valeursParDefaut(config) },
    compute: { resultatCalc, precisionCalc, partCalc, changerValeur, valeurDe },
    card,
    share,
  }
}
