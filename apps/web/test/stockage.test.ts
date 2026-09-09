// @vitest-environment happy-dom
import 'fake-indexeddb/auto'
import { devis, njangi } from '@a237/engine'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  creerOutil, enregistrerOutil, filerPublication, listerOutils, lireFile, lireOutil,
  majEtat, nouvelIdentifiant, retirerDeLaFile, supprimerOutil,
} from '../src/stockage.js'
import type { OutilEnregistre } from '../src/stockage.js'

const LE_9_SEPT = new Date('2026-09-09T07:45:00.000Z')

async function viderTout(): Promise<void> {
  for (const o of await listerOutils()) await supprimerOutil(o.id)
  for (const e of await lireFile()) await retirerDeLaFile(e.id)
}

beforeEach(viderTout)

describe('créer un outil', () => {
  it('range ce que le fragment de l’outil lui donne', async () => {
    const outil = await creerOutil('njangi', 'Carnet de njangi', njangi.defaults, LE_9_SEPT)
    expect(outil).toMatchObject({ skeleton: 'njangi', nom: 'Carnet de njangi', version: 0 })
    expect(outil.etat).toEqual(njangi.defaults)
    expect(await lireOutil(outil.id)).toEqual(outil)
  })

  it('ne construit aucun état lui-même : il ne connaît pas les squelettes', async () => {
    const neuf = devis.initialiser?.({ lien: '', maintenant: LE_9_SEPT })
    const outil = await creerOutil('devis', 'Devis', neuf, LE_9_SEPT)
    const etat = outil.etat as typeof devis.defaults
    expect(etat.numero).toBe('DV-2026-0001')
    expect(etat.emisLe).toBe('2026-09-09T07:45:00.000Z')
  })

  it('accepte un nom donné par l’utilisateur', async () => {
    const outil = await creerOutil('njangi', 'Njangi Nkolbisson', njangi.defaults, LE_9_SEPT)
    expect(outil.nom).toBe('Njangi Nkolbisson')
  })

  it('donne un identifiant différent à chaque outil', async () => {
    const a = await creerOutil('njangi', 'A', njangi.defaults, LE_9_SEPT)
    const b = await creerOutil('njangi', 'B', njangi.defaults, LE_9_SEPT)
    expect(a.id).not.toBe(b.id)
    expect(nouvelIdentifiant()).not.toBe(nouvelIdentifiant())
  })
})

describe('lister les outils', () => {
  it('rend le plus récemment touché en premier', async () => {
    const vieux = await creerOutil('njangi', 'Vieux', njangi.defaults, new Date('2026-09-01T09:00:00Z'))
    const neuf = await creerOutil('devis', 'Neuf', devis.defaults, new Date('2026-09-08T09:00:00Z'))
    expect((await listerOutils()).map((o) => o.id)).toEqual([neuf.id, vieux.id])
  })

  it('rend une liste vide quand il n’y a rien', async () => {
    expect(await listerOutils()).toEqual([])
  })

  it('rend null sur un outil qui n’existe pas', async () => {
    expect(await lireOutil('inconnu')).toBeNull()
  })
})

describe('enregistrer un état', () => {
  it('fait monter la version à chaque enregistrement, pas seulement à la publication', async () => {
    const outil = await creerOutil('njangi', 'Carnet', njangi.defaults, LE_9_SEPT)
    const un = await majEtat(outil, { ...njangi.defaults, tour: 2 }, LE_9_SEPT)
    const deux = await majEtat(un, { ...njangi.defaults, tour: 3 }, LE_9_SEPT)
    expect(un.version).toBe(1)
    expect(deux.version).toBe(2)
  })

  it('horodate la dernière modification', async () => {
    const outil = await creerOutil('njangi', 'Carnet', njangi.defaults, LE_9_SEPT)
    const plusTard = new Date('2026-09-10T09:00:00Z')
    expect((await majEtat(outil, njangi.defaults, plusTard)).majLe).toBe(plusTard.getTime())
  })

  it('survit à une relecture depuis la base', async () => {
    const outil = await creerOutil('njangi', 'Carnet', njangi.defaults, LE_9_SEPT)
    await majEtat(outil, { ...njangi.defaults, cotisation: 7_500 }, LE_9_SEPT)
    const relu = await lireOutil(outil.id)
    expect((relu?.etat as { cotisation: number }).cotisation).toBe(7_500)
    expect(relu?.version).toBe(1)
  })

  it('remplace un outil enregistré sous le même identifiant', async () => {
    const outil = await creerOutil('njangi', 'Carnet', njangi.defaults, LE_9_SEPT)
    const renomme: OutilEnregistre = { ...outil, nom: 'Njangi des mamans' }
    await enregistrerOutil(renomme)
    expect(await listerOutils()).toHaveLength(1)
    expect((await lireOutil(outil.id))?.nom).toBe('Njangi des mamans')
  })
})

describe('supprimer', () => {
  it('retire l’outil de la liste', async () => {
    const outil = await creerOutil('njangi', 'Carnet', njangi.defaults, LE_9_SEPT)
    await supprimerOutil(outil.id)
    expect(await listerOutils()).toEqual([])
    expect(await lireOutil(outil.id)).toBeNull()
  })

  it('ne se plaint pas d’un outil déjà absent', async () => {
    await expect(supprimerOutil('inconnu')).resolves.toBeUndefined()
  })
})

describe('la file d’attente des publications', () => {
  it('garde ce qui n’a pas pu partir, dans l’ordre', async () => {
    await filerPublication({ id: 'a', outilId: 'o1', version: 1, creeLe: 200 })
    await filerPublication({ id: 'b', outilId: 'o2', version: 1, creeLe: 100 })
    expect((await lireFile()).map((e) => e.id)).toEqual(['b', 'a'])
  })

  it('se vide entrée par entrée quand le réseau revient', async () => {
    await filerPublication({ id: 'a', outilId: 'o1', version: 1, creeLe: 1 })
    await retirerDeLaFile('a')
    expect(await lireFile()).toEqual([])
  })

  it('ne mélange pas la file et les outils', async () => {
    await creerOutil('njangi', 'Carnet', njangi.defaults, LE_9_SEPT)
    await filerPublication({ id: 'a', outilId: 'o1', version: 1, creeLe: 1 })
    expect(await listerOutils()).toHaveLength(1)
    expect(await lireFile()).toHaveLength(1)
  })
})
