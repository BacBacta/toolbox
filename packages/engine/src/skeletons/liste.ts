import {
  ajouterLigne, basculerLigne, booleenDe, colonneBascule, colonneIdentite,
  colonnesSecondaires, comptageBascule, lignesEnAlerte, ligneNeuve, nombreDe,
  retirerLigne, schemaListe, texteDe, totalListe,
} from '../compute/liste.js'
import type { ConfigListe, EtatListe, LigneListe } from '../compute/liste.js'
import { arreteLe, montantF, nf } from '../format.js'
import type {
  CardItem, CardSpec, RenderContext, ShareSpec, Skeleton, SkeletonGroup, SkeletonId,
} from '../types.js'

/**
 * La fabrique de registres.
 *
 * Elle prend une configuration de colonnes et rend un squelette complet :
 * schéma, calculs, carte et partage. Quatre outils du prototype en sortent sans
 * une ligne de code propre — livre de caisse, inventaire, annuaire, liste de
 * prix. Le cinquième qui voudra un tableau de lignes n'en demandera pas non plus.
 *
 * Ce qui reste spécifique à un outil ne passe pas par ici : le njangi a une
 * rotation, l'ardoise a un vieillissement, la présence a une matrice. Une
 * fabrique qui essaierait de les couvrir aussi serait un langage de
 * programmation déguisé, et le brief en veut précisément l'inverse.
 */

/** La valeur d'une cellule, telle qu'elle s'imprime. */
export function cellule(ligne: LigneListe, colonne: { clef: string; type: string }): string {
  switch (colonne.type) {
    case 'montant':
      return montantF(nombreDe(ligne, colonne.clef))
    case 'nombre':
      return nf(nombreDe(ligne, colonne.clef))
    case 'bascule':
      return booleenDe(ligne, colonne.clef) ? 'oui' : 'non'
    default:
      return texteDe(ligne, colonne.clef)
  }
}

function grandChiffre(config: ConfigListe, etat: EtatListe): {
  readonly libelle: string
  readonly valeur: string
  readonly part: number | null
} {
  const compte = comptageBascule(config, etat)
  if (compte !== null) {
    const bascule = colonneBascule(config)
    return {
      libelle: (bascule?.titre ?? 'Disponibles').toUpperCase(),
      valeur: `${compte.oui} / ${compte.total}`,
      part: compte.total === 0 ? 0 : compte.oui / compte.total,
    }
  }

  const total = totalListe(config, etat)
  if (total !== null && config.total !== undefined) {
    const unite = config.total.type === 'somme' ? config.total.unite : 'F'
    return {
      libelle: config.total.libelle.toUpperCase(),
      valeur: unite === 'F' ? montantF(total) : nf(total),
      part: null,
    }
  }

  return {
    libelle: 'LIGNES',
    valeur: nf(etat.lignes.length),
    part: null,
  }
}

function items(config: ConfigListe, etat: EtatListe): readonly CardItem[] {
  const identite = colonneIdentite(config)
  const bascule = colonneBascule(config)
  const secondaires = colonnesSecondaires(config)
  const alertees = new Set(lignesEnAlerte(config, etat))

  return etat.lignes.map((ligne, i) => {
    const coche = bascule === null ? true : booleenDe(ligne, bascule.clef)
    const valeur = secondaires.map((c) => cellule(ligne, c)).join(' · ')
    return {
      n: cellule(ligne, identite) === '' ? '—' : cellule(ligne, identite),
      ok: coche && !alertees.has(i),
      warn: alertees.has(i) || (bascule !== null && !coche),
      val: valeur === '' ? null : valeur,
    }
  })
}

function sousLigne(config: ConfigListe, etat: EtatListe): string {
  const bouts: string[] = [`${etat.lignes.length} ligne${etat.lignes.length > 1 ? 's' : ''}`]
  const total = totalListe(config, etat)
  if (total !== null && config.total !== undefined && comptageBascule(config, etat) !== null) {
    bouts.push(`${config.total.libelle.toLowerCase()} ${nf(total)}`)
  }
  const alertees = lignesEnAlerte(config, etat)
  if (alertees.length > 0 && config.alerte !== undefined) {
    bouts.push(`${alertees.length} ${config.alerte.libelle}`)
  }
  return bouts.join(' · ')
}

export interface DefinitionListe {
  readonly id: SkeletonId
  readonly title: string
  readonly group: SkeletonGroup
  readonly keywords: readonly string[]
  readonly config: ConfigListe
  /** Le libellé du champ « nom », dans le formulaire. */
  readonly titreNom: string
}

/**
 * Un squelette de liste porte sa configuration.
 *
 * Elle vivait dans une table remplie au chargement du module. C'était un effet
 * de bord au niveau du fichier : Rollup ne pouvait plus écarter les squelettes
 * du fragment de départ, et la coquille payait trois kilo-octets pour des
 * outils qu'on n'avait pas ouverts. La porter sur l'objet coûte un champ.
 */
export type SqueletteListe = Skeleton<EtatListe> & { readonly config: ConfigListe }

export function squeletteListe(def: DefinitionListe): SqueletteListe {
  const config = def.config

  const card = (etat: EtatListe, ctx: RenderContext): CardSpec => {
    const grand = grandChiffre(config, etat)
    return {
      kicker: config.kicker,
      title: etat.nom,
      sub: def.title,
      tag: null,
      bigLabel: grand.libelle,
      big: grand.valeur,
      pct: grand.part,
      subline: sousLigne(config, etat),
      listTitle: 'DÉTAIL',
      items: items(config, etat),
      link: ctx.lien,
      stamp: arreteLe(ctx.maintenant),
    }
  }

  const share = (etat: EtatListe, ctx: RenderContext): ShareSpec => {
    const grand = grandChiffre(config, etat)
    const identite = colonneIdentite(config)
    const secondaires = colonnesSecondaires(config)

    const lignes = [
      `${etat.nom.toUpperCase()} — ${def.title.toLowerCase()}`,
      `${grand.libelle.charAt(0)}${grand.libelle.slice(1).toLowerCase()} : ${grand.valeur}`,
      ...etat.lignes
        .slice(0, 20)
        .map(
          (l) =>
            `• ${texteDe(l, identite.clef)}${
              secondaires.length > 0 ? ` — ${secondaires.map((c) => cellule(l, c)).join(' · ')}` : ''
            }`,
        ),
      etat.lignes.length > 20 ? `… et ${etat.lignes.length - 20} autres` : '',
      ctx.lien,
    ].filter((l) => l !== '')

    return {
      title: etat.nom,
      desc: `${def.title} · ${sousLigne(config, etat)}`,
      name: def.id,
      txt: lignes.join('\n'),
      broad: null,
      warn: config.avertissement ?? null,
      card: card(etat, ctx),
      relances: [],
      relancesVides: config.relancesVides,
    }
  }

  return {
    id: def.id,
    group: def.group,
    title: def.title,
    keywords: def.keywords,
    engine: 'liste',
    config,
    schema: schemaListe(config, def.titreNom),
    defaults: { nom: def.title, lignes: [] },
    compute: {
      totalListe, lignesEnAlerte, comptageBascule, ligneNeuve,
      ajouterLigne, retirerLigne, basculerLigne, cellule,
    },
    card,
    share,
  }
}
