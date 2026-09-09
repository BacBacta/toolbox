import type { ConfigCalc } from '../compute/calc.js'
import { squeletteCalc } from './calc.js'

/**
 * Les calculatrices.
 *
 * Les plus petits outils du produit, et peut-être les plus ouverts : on les
 * sort au comptoir, entre deux clients. Leur formule tient en une ligne — c'est
 * précisément pour ça qu'elle est écrite à la main et testée, plutôt que
 * confiée à un modèle.
 */

const SCOLARITE: ConfigCalc = {
  kicker: 'FRAIS SCOLAIRES',
  entrees: [
    { clef: 'total', titre: 'Total de l’année', defaut: 75_000, unite: 'F' },
    { clef: 'verse', titre: 'Déjà versé', defaut: 30_000, unite: 'F' },
  ],
  sortie: {
    libelle: 'Reste à payer',
    unite: 'F',
    // Jamais négatif : au-delà du total, c'est un trop-versé, et ça se dit.
    calcul: (val) => Math.max(0, val('total') - val('verse')),
    precision: (val) => {
      const total = val('total')
      const verse = val('verse')
      if (total === 0) return null
      if (verse > total) return `Trop versé de ${Math.round(verse - total)} F CFA.`
      return `${Math.round((verse / total) * 100)} % réglé.`
    },
    part: (val) => (val('total') === 0 ? null : val('verse') / val('total')),
  },
}

export const scolarite = squeletteCalc({
  id: 'scolarite',
  title: 'Frais scolaires',
  group: 'calculs',
  keywords: ['scolarite', 'frais', 'ecole', 'pension', 'rentree'],
  titreNom: 'Nom de l’élève',
  config: SCOLARITE,
  relancesVides: 'Un calcul ne se relance pas — il se montre.',
})

const COURSE: ConfigCalc = {
  kicker: 'PARTAGE DE COURSE',
  entrees: [
    { clef: 'montant', titre: 'Montant de la course', defaut: 3_000, unite: 'F' },
    { clef: 'personnes', titre: 'Nombre de personnes', defaut: 4, unite: '' },
  ],
  sortie: {
    libelle: 'Part de chacun',
    unite: 'F',
    // Arrondi au franc supérieur : c'est ce qu'on fait vraiment quand on
    // partage une moto à plusieurs, personne ne cherche la pièce manquante.
    calcul: (val) => {
      const personnes = Math.floor(val('personnes'))
      return personnes <= 0 ? 0 : Math.ceil(val('montant') / personnes)
    },
    precision: (val) => {
      const personnes = Math.floor(val('personnes'))
      if (personnes <= 0) return 'Indique combien vous êtes.'
      const ecart = Math.ceil(val('montant') / personnes) * personnes - val('montant')
      return ecart > 0 ? `${Math.round(ecart)} F de plus que la course, arrondi compris.` : null
    },
  },
}

export const course = squeletteCalc({
  id: 'course',
  title: 'Partage de course',
  group: 'calculs',
  keywords: ['course', 'moto', 'taxi', 'partage', 'diviser'],
  titreNom: 'Nom du trajet',
  config: COURSE,
  relancesVides: 'Un calcul ne se relance pas — il se montre.',
})

export const CALCULATRICES = [scolarite, course] as const
