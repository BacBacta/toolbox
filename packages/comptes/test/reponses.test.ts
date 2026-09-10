import { describe, expect, it } from 'vitest'
import { compteDeLAppareil } from '../src/base.js'
import {
  DELAI_ENTRE_ENVOIS_MS, combienDeReponses, empreinteSource, lireReponses, noterPublication,
  proprietaireDe, rangerReponse, tropTot,
} from '../src/reponses.js'
import { baseDEssai } from './sqlite.js'

/**
 * Ce qu'un formulaire publié reçoit, éprouvé sur du vrai SQLite.
 *
 * C'est la première fois que le produit accepte une écriture venue de
 * l'extérieur, et c'est aussi la première fois qu'une ligne de base répond à la
 * question « à qui est-ce ? ». Un faux objet dirait ce qu'on attend ; ce qui
 * compte ici est ce que la requête dit vraiment — la clause `WHERE` du
 * `ON CONFLICT` qui empêche de voler un lien, et la clé étrangère qui refuse
 * une réponse à un lien que personne n'a publié.
 */

const LE_9_SEPT = new Date('2026-09-09T07:45:00.000Z')
const LIEN = 'K7M2XQ4BN9PZ'
const A = 'a'.repeat(64)
const B = 'b'.repeat(64)

async function baseAvecUnFormulaire(): Promise<{ db: ReturnType<typeof baseDEssai>; compteId: string }> {
  const db = baseDEssai()
  const compte = await compteDeLAppareil(db, A, LE_9_SEPT)
  await noterPublication(db, { lien: LIEN, compteId: compte.id, skeleton: 'compose-formulaire' }, LE_9_SEPT)
  return { db, compteId: compte.id }
}

describe('à qui appartient un lien', () => {
  it('à celui qui l’a publié', async () => {
    const { db, compteId } = await baseAvecUnFormulaire()
    expect(await proprietaireDe(db, LIEN)).toBe(compteId)
  })

  it('à personne, tant que rien n’a été noté', async () => {
    const db = baseDEssai()
    expect(await proprietaireDe(db, LIEN)).toBeNull()
  })

  it('republier ne change pas de propriétaire', async () => {
    const { db, compteId } = await baseAvecUnFormulaire()
    await noterPublication(
      db, { lien: LIEN, compteId, skeleton: 'compose-formulaire' },
      new Date(LE_9_SEPT.getTime() + 60_000),
    )
    expect(await proprietaireDe(db, LIEN)).toBe(compteId)
  })

  it('et un autre appareil ne le prend pas en republiant dessus', async () => {
    /*
     * Le lien est tiré sur le téléphone, pas par le serveur : quelqu'un qui le
     * connaît pourrait tenter de republier dessus pour se faire livrer les
     * réponses. Le lien appartient à qui l'a tiré, et la clause `WHERE` du
     * `ON CONFLICT` est ce qui le tient.
     */
    const { db, compteId } = await baseAvecUnFormulaire()
    const autre = await compteDeLAppareil(db, B, LE_9_SEPT)
    await noterPublication(
      db, { lien: LIEN, compteId: autre.id, skeleton: 'compose-formulaire' }, LE_9_SEPT,
    )
    expect(await proprietaireDe(db, LIEN)).toBe(compteId)
    expect(autre.id).not.toBe(compteId)
  })
})

describe('les réponses', () => {
  it('se rangent et se relisent, la plus récente en tête', async () => {
    const { db } = await baseAvecUnFormulaire()
    await rangerReponse(db, { lien: LIEN, contenu: { nom: 'Awa' }, source: null }, LE_9_SEPT)
    await rangerReponse(
      db, { lien: LIEN, contenu: { nom: 'Paul' }, source: null },
      new Date(LE_9_SEPT.getTime() + 1_000),
    )
    const lues = await lireReponses(db, LIEN)
    expect(lues.map((l) => JSON.parse(l.contenu).nom)).toEqual(['Paul', 'Awa'])
  })

  it('se comptent, pour savoir quand le formulaire est plein', async () => {
    const { db } = await baseAvecUnFormulaire()
    expect(await combienDeReponses(db, LIEN)).toBe(0)
    await rangerReponse(db, { lien: LIEN, contenu: { nom: 'Awa' }, source: null }, LE_9_SEPT)
    expect(await combienDeReponses(db, LIEN)).toBe(1)
  })

  it('ne s’écrivent pas sur un lien que personne n’a publié', async () => {
    // La clé étrangère : sans elle, une adresse quelconque ramasserait des
    // réponses que personne ne relira jamais.
    const db = baseDEssai()
    await expect(
      rangerReponse(db, { lien: LIEN, contenu: { nom: 'Awa' }, source: null }, LE_9_SEPT),
    ).rejects.toThrow()
  })

  it('ne mélangent pas deux formulaires', async () => {
    const { db, compteId } = await baseAvecUnFormulaire()
    const autre = 'M9PP658V8VJC'
    await noterPublication(db, { lien: autre, compteId, skeleton: 'compose-formulaire' }, LE_9_SEPT)
    await rangerReponse(db, { lien: LIEN, contenu: { nom: 'Awa' }, source: null }, LE_9_SEPT)
    await rangerReponse(db, { lien: autre, contenu: { nom: 'Paul' }, source: null }, LE_9_SEPT)
    expect(await combienDeReponses(db, LIEN)).toBe(1)
    expect(await combienDeReponses(db, autre)).toBe(1)
  })
})

describe('le délai entre deux envois du même endroit', () => {
  it('laisse passer le premier', async () => {
    const { db } = await baseAvecUnFormulaire()
    const source = await empreinteSource(LIEN, '41.202.1.1')
    expect(await tropTot(db, LIEN, source as string, LE_9_SEPT)).toBe(false)
  })

  it('retient le second s’il arrive tout de suite', async () => {
    const { db } = await baseAvecUnFormulaire()
    const source = await empreinteSource(LIEN, '41.202.1.1')
    await rangerReponse(db, { lien: LIEN, contenu: { nom: 'A' }, source }, LE_9_SEPT)
    expect(await tropTot(db, LIEN, source as string, LE_9_SEPT)).toBe(true)
  })

  it('et le laisse passer une fois le délai écoulé', async () => {
    const { db } = await baseAvecUnFormulaire()
    const source = await empreinteSource(LIEN, '41.202.1.1')
    await rangerReponse(db, { lien: LIEN, contenu: { nom: 'A' }, source }, LE_9_SEPT)
    const plusTard = new Date(LE_9_SEPT.getTime() + DELAI_ENTRE_ENVOIS_MS + 1)
    expect(await tropTot(db, LIEN, source as string, plusTard)).toBe(false)
  })

  it('n’enferme pas la famille qui répond depuis le même wifi', async () => {
    // Ce qu'on empêche est le remplissage en boucle, pas deux personnes d'un
    // même foyer à une minute d'intervalle.
    const { db } = await baseAvecUnFormulaire()
    const source = await empreinteSource(LIEN, '41.202.1.1')
    await rangerReponse(db, { lien: LIEN, contenu: { nom: 'A' }, source }, LE_9_SEPT)
    const uneMinute = new Date(LE_9_SEPT.getTime() + 60_000)
    expect(await tropTot(db, LIEN, source as string, uneMinute)).toBe(false)
  })
})

describe('l’empreinte d’une adresse', () => {
  it('ne range jamais l’adresse elle-même', async () => {
    const e = await empreinteSource(LIEN, '41.202.1.1')
    expect(e).not.toContain('41.202')
    expect(e).toHaveLength(64)
  })

  it('diffère d’un formulaire à l’autre pour la même adresse', async () => {
    /*
     * Sans sel, la même adresse donnerait la même empreinte partout : on
     * saurait qu'une même personne a répondu au formulaire de la tontine et à
     * celui du lycée. Le lien fait le sel — il est déjà secret.
     */
    const un = await empreinteSource(LIEN, '41.202.1.1')
    const deux = await empreinteSource('M9PP658V8VJC', '41.202.1.1')
    expect(un).not.toBe(deux)
  })

  it('rend rien quand l’hébergeur ne dit pas d’où ça vient', async () => {
    expect(await empreinteSource(LIEN, null)).toBeNull()
    expect(await empreinteSource(LIEN, '')).toBeNull()
  })
})
