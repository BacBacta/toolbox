import { ID_COMPOSE_PAGE, MAX_LIGNES_SECTION, MAX_SECTIONS, REGISTRES_LISTE, SQUELETTES, publiable } from '@a237/engine'
import type { Instantane, PageDemande, RenderContext } from '@a237/engine'
import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { pageDeLecture } from '../src/html.js'

/**
 * Le plafond du § 8 : **page de lecture publique, 25 Ko, zéro JS**.
 *
 * Le brief veut ces mesures « à faire échouer en CI, pas à surveiller à
 * l'œil ». Celle-ci ne l'était pas, et c'est la plus exposée des six : la page
 * publiée est le seul octet que le produit envoie à quelqu'un qui ne l'a pas
 * demandé, sur la connexion qu'il a. Une règle de style ajoutée, une carte qui
 * s'allonge, et elle dérive sans que personne le voie.
 *
 * On mesure des octets bruts et non comprimés : c'est la lecture stricte du
 * tableau, où seule la coquille initiale précise « gzip ».
 */

const PLAFOND = 25 * 1024

const CTX: RenderContext = {
  lien: 'atelier237.pages.dev/d/K7M2XQ4BN9PZ',
  maintenant: new Date('2026-09-09T07:45:00.000Z'),
}
const LIEN = 'https://atelier237.pages.dev/d/K7M2XQ4BN9PZ'

const octets = (s: string): number => Buffer.byteLength(s, 'utf8')
const octetsComprimes = (s: string): number => gzipSync(s).byteLength
const ko = (n: number): string => `${(n / 1024).toFixed(1)} Ko`

function instantane(skeleton: string, etat: unknown): Instantane {
  return { skeleton, nom: 'Essai', etat, version: 1, publieLe: '2026-09-09T07:45:00.000Z' }
}

describe('le poids de la page publiée', () => {
  it('tient sous le plafond pour tout le catalogue', () => {
    const pires: string[] = []
    for (const s of SQUELETTES) {
      if (!publiable(s.id)) continue
      const page = pageDeLecture(instantane(s.id, s.defaults), CTX, LIEN)
      pires.push(`${s.id} ${ko(octets(page))}`)
      expect(octets(page), `${s.id} : ${ko(octets(page))}`).toBeLessThanOrEqual(PLAFOND)
    }
    console.log('  pages vides :', pires.join(' · '))
  })

  it('et ne grandit pas sans fin avec le nombre de lignes', () => {
    /*
     * La carte est un résumé : le moteur plafonne sa liste à dix items et
     * compte le reste, et l'image partagée respectait ce plafond. La page de
     * lecture, elle, dessinait **tous** les items — l'image disait « + 47
     * autres » et la page en listait cinquante-sept. Une liste de prix de
     * quincaillerie en compte deux cents : la page dépassait le plafond, et
     * ce n'était plus un résumé.
     */
    const prix = REGISTRES_LISTE.find((s) => s.id === 'prix')
    if (prix === undefined) throw new Error('la liste de prix a disparu du catalogue')

    const lignes = Array.from({ length: 200 }, (_, i) => ({
      article: `Article numéro ${i + 1} avec un libellé de longueur ordinaire`,
      prix: 1_500 + i * 25,
    }))
    const page = pageDeLecture(
      instantane('prix', { ...prix.defaults, nom: 'Liste de prix', lignes }),
      CTX,
      LIEN,
    )
    console.log(`  200 lignes : ${ko(octets(page))} — ${ko(octetsComprimes(page))} comprimée`)
    expect(octets(page), `200 lignes : ${ko(octets(page))}`).toBeLessThanOrEqual(PLAFOND)
    expect(page).toContain('autres')
  })

  /**
   * Une page composée est la seule des trois formes qui porte du contenu écrit
   * pour être lu, et non résumé. Elle est donc la plus exposée au plafond :
   * huit sections de huit lignes, chacune remplie jusqu'à sa borne, c'est
   * exactement ce que le contrat autorise de plus lourd.
   */
  it('tient aussi pour la page la plus chargée que le contrat autorise', () => {
    const ligne = {
      nom: 'Un article au libellé aussi long que le contrat le permet.',
      valeur: '1 250 000 F CFA',
      detail: 'Une précision qui va au bout de ce que le champ accepte.',
    }
    const page: PageDemande = {
      titre: 'Quincaillerie de Bépanda-Omnisport',
      kicker: 'QUINCAILLERIE ET MATÉRIAUX',
      accroche: 'Tôles, ciment, fers à béton et outillage de chantier, à Bépanda depuis 2012.',
      sommaire: true,
      // Datée aussi : un événement est une page, et c'est la plus lourde des
      // deux puisqu'elle porte un bloc de plus.
      date: '2026-12-24T18:30',
      sections: Array.from({ length: MAX_SECTIONS }, (_, i) => ({
        titre: `Section numéro ${i + 1} au titre long`,
        sorte: 'prix' as const,
        lignes: Array.from({ length: MAX_LIGNES_SECTION }, () => ligne),
      })),
      telephone: '+237 6 99 41 27 08',
      adresse: 'Rue Bépanda-Omnisport, en face du marché, Douala',
      horaires: 'Du lundi au samedi, de 7 h à 19 h',
    }
    const rendue = pageDeLecture(instantane(ID_COMPOSE_PAGE, page), CTX, LIEN)
    console.log(`  page pleine : ${ko(octets(rendue))} — ${ko(octetsComprimes(rendue))} comprimée`)
    expect(octets(rendue), `page pleine : ${ko(octets(rendue))}`).toBeLessThanOrEqual(PLAFOND)
    // Et la feuille A4 n'y est pas : une vitrine ne se met pas dans une chemise.
    expect(rendue).not.toContain('210mm')
  })

  it('sans un seul script — c’est l’autre moitié du plafond', () => {
    for (const s of SQUELETTES) {
      if (!publiable(s.id)) continue
      const page = pageDeLecture(instantane(s.id, s.defaults), CTX, LIEN)
      expect(page, s.id).not.toContain('<script')
      expect(page, s.id).not.toContain('javascript:')
      expect(page, s.id).not.toMatch(/\son[a-z]+=/)
    }
  })
})
