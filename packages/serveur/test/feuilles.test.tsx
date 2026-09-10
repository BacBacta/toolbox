import { ID_COMPOSE, ID_COMPOSE_PAGE } from '@a237/engine'
import type { Instantane, PageDemande, RegistreDemande, RenderContext } from '@a237/engine'
import { describe, expect, it } from 'vitest'
import { pageDeLecture } from '../src/html.js'

/**
 * Chaque page n'emporte que le style qu'elle dessine — et tout celui qu'elle
 * dessine.
 *
 * La feuille de lecture n'en faisait qu'une, inlinée partout : une page
 * composée pleine portait deux kilo-octets de style de carte qu'elle
 * n'employait jamais, sur les vingt-cinq que le § 8 lui accorde. La découper
 * rend ces octets, et ouvre exactement le défaut inverse : une forme à qui il
 * manque une règle. Ça ne se voit dans aucun test de rendu — le HTML sort
 * correct, c'est la page qui est nue — et ça se découvre chez le destinataire.
 *
 * On vérifie donc les deux sens, sur les trois formes.
 */

const CTX: RenderContext = {
  lien: 'atelier237.pages.dev/d/K7M2XQ4BN9PZ',
  maintenant: new Date('2026-09-09T07:45:00.000Z'),
}
const LIEN = 'https://atelier237.pages.dev/d/K7M2XQ4BN9PZ'

const PAGE: PageDemande = {
  titre: 'Quincaillerie Bépanda',
  kicker: 'QUINCAILLERIE',
  accroche: 'Tôles, ciment et outillage.',
  sommaire: true,
  sections: [
    { titre: 'Ce que je vends', sorte: 'liste', lignes: [{ nom: 'Tôles', detail: 'toutes longueurs' }] },
    { titre: 'Quelques prix', sorte: 'prix', lignes: [{ nom: 'Ciment', valeur: '5 800 F' }] },
    { titre: 'La livraison', sorte: 'texte', texte: 'Sur tout Douala.' },
  ],
  telephone: '699412708',
  adresse: 'Rue Bépanda-Omnisport',
  horaires: 'Lundi à samedi',
}

const REGISTRE: RegistreDemande = {
  titre: 'Suivi des livraisons',
  kicker: 'SUIVI DES LIVRAISONS',
  titreNom: 'Nom du dépôt',
  colonnes: [
    { clef: 'client', titre: 'Client', type: 'texte' },
    { clef: 'montant', titre: 'Montant', type: 'montant' },
  ],
  libelleVide: 'Aucune livraison.',
  libelleAjout: 'Ajouter',
  relancesVides: 'Un suivi ne se relance pas.',
  total: { type: 'somme', clef: 'montant', libelle: 'Total', unite: 'F' },
}

function rendre(instantane: Instantane): string {
  return pageDeLecture(instantane, CTX, LIEN)
}

const inst = (skeleton: string, etat: unknown, extra: Partial<Instantane> = {}): Instantane => ({
  skeleton, nom: 'Essai', etat, version: 1, publieLe: '2026-09-09T07:45:00.000Z', ...extra,
})

/** Les classes que le corps de la page emploie réellement. */
function classesEmployees(html: string): Set<string> {
  const corps = html.slice(html.indexOf('<body>'))
  return new Set(
    [...corps.matchAll(/class="([^"]*)"/g)].flatMap((m) => (m[1] ?? '').split(/\s+/)).filter((c) => c !== ''),
  )
}

/** Les classes que le style inliné déclare. */
function classesDeclarees(html: string): Set<string> {
  const debut = html.indexOf('<style>') + '<style>'.length
  const css = html.slice(debut, html.indexOf('</style>', debut))
  return new Set([...css.matchAll(/\.([a-z][a-z0-9-]*)/g)].map((m) => m[1] ?? ''))
}

const FORMES = [
  ['une page composée', inst(ID_COMPOSE_PAGE, PAGE)],
  ['un écrit A4', inst('devis', devisMinimal())],
  [
    'la carte d’un registre',
    inst(ID_COMPOSE, { nom: 'Dépôt de Bonabéri', lignes: [{ client: 'Awa', montant: 12_000 }] }, {
      registre: REGISTRE,
    }),
  ],
] as const

describe.each(FORMES)('%s', (_nom, instantane) => {
  it('ne montre aucune classe que son style ne déclare', () => {
    const html = rendre(instantane)
    const declarees = classesDeclarees(html)
    const manquantes = [...classesEmployees(html)].filter((c) => !declarees.has(c))
    expect(manquantes).toEqual([])
  })
})

describe('et n’emporte pas le style des autres', () => {
  it('une vitrine n’a ni carte ni feuille A4', () => {
    const html = rendre(inst(ID_COMPOSE_PAGE, PAGE))
    // Les sélecteurs, pas les mots : « lecture-carte » n'apparaît que comme
    // règle, et « 210mm » que dans la mise à l'échelle de la feuille.
    expect(html).not.toContain('.lecture-carte')
    expect(html).not.toContain('.a4-cadre')
  })

  it('une carte n’emporte pas la vitrine', () => {
    const html = rendre(
      inst(ID_COMPOSE, { nom: 'Dépôt', lignes: [] }, { registre: REGISTRE }),
    )
    expect(html).not.toContain('.vitrine')
  })

  it('un écrit A4 n’emporte pas la vitrine', () => {
    expect(rendre(inst('devis', devisMinimal()))).not.toContain('.vitrine')
  })
})

/** Un devis assez rempli pour se dessiner, et pas plus. */
function devisMinimal(): unknown {
  return {
    numero: 'DEV-2026-001',
    date: '2026-09-09',
    validite: 30,
    emetteur: { nom: 'Atelier Bépanda', telephone: '699412708', ville: 'Douala' },
    client: { nom: 'Madame Awa' },
    lignes: [{ designation: 'Pose de tôles', quantite: 1, prixUnitaire: 150_000 }],
    tva: false,
    mentions: '',
  }
}
