import { REGISTRES_LISTE, SQUELETTES, publiable } from '@a237/engine'
import type { Instantane, RenderContext } from '@a237/engine'
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
