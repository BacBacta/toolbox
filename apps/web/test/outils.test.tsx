// @vitest-environment happy-dom
import {
  caisse, clients, course, devis, facture, njangi, prix, scolarite, stock, valider,
} from '@a237/engine'
import type { RenderContext, ShareSpec } from '@a237/engine'
import { render as monter } from 'preact'
import { act } from 'preact/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CHARGEURS, outilDisponible } from '../src/outils.js'
import type { ModuleOutil } from '../src/outils.js'
import type { OutilEnregistre } from '../src/stockage.js'

const LE_9_SEPT = new Date('2026-09-09T07:45:00.000Z')
const CTX: RenderContext = { lien: 'atl.cm/a/ZBV3', maintenant: LE_9_SEPT }

const SCHEMAS: Readonly<Record<string, typeof devis.schema>> = {
  devis: devis.schema,
  facture: facture.schema,
  njangi: njangi.schema,
  prix: prix.schema,
  caisse: caisse.schema,
  stock: stock.schema,
  clients: clients.schema,
  scolarite: scolarite.schema,
  course: course.schema,
}

let hote: HTMLDivElement

beforeEach(() => {
  hote = document.createElement('div')
  document.body.appendChild(hote)
})

afterEach(() => {
  monter(null, hote)
  hote.remove()
})

function outil(skeleton: string, etat: unknown): OutilEnregistre {
  return {
    id: 'abc', skeleton, nom: 'Essai', etat, version: 0,
    creeLe: LE_9_SEPT.getTime(), majLe: LE_9_SEPT.getTime(),
  }
}

function poser(module: ModuleOutil, o: OutilEnregistre, onDiffuser = vi.fn()): typeof onDiffuser {
  act(() => {
    monter(
      <module.Outil outil={o} glyphe="◉" ctx={CTX} onChange={() => undefined} onDiffuser={onDiffuser} />,
      hote,
    )
  })
  return onDiffuser
}

describe('le registre des outils', () => {
  it('couvre les squelettes qui ont un écran, et le dit', () => {
    expect(Object.keys(CHARGEURS).sort()).toEqual([
      'caisse', 'clients', 'course', 'devis', 'facture', 'njangi', 'prix', 'scolarite', 'stock',
    ])
    expect(outilDisponible('njangi')).toBe(true)
    expect(outilDisponible('callbox')).toBe(false)
  })

  it('ne se laisse pas interroger sur une clef héritée du prototype d’Object', () => {
    expect(outilDisponible('constructor')).toBe(false)
    expect(outilDisponible('toString')).toBe(false)
  })
})

describe.each([
  'devis', 'facture', 'njangi', 'prix', 'caisse', 'stock', 'clients', 'scolarite', 'course',
] as const)('l’outil « %s »', (id) => {
  it('fabrique un état neuf conforme à son propre schéma', async () => {
    const module = await CHARGEURS[id]!()
    const neuf = module.creer(id, LE_9_SEPT)
    expect(neuf.nom.length).toBeGreaterThan(0)
    expect(valider(SCHEMAS[id]!, neuf.etat)).toEqual([])
  })

  it('se dessine à partir de cet état', async () => {
    const module = await CHARGEURS[id]!()
    poser(module, outil(id, module.creer(id, LE_9_SEPT).etat))
    expect(hote.textContent?.length).toBeGreaterThan(20)
    // Un document neuf signale ses mentions manquantes, mais son état est bon.
    expect(hote.querySelector('.etat-invalide')).toBeNull()
  })

  it('refuse de dessiner un état qui ne valide pas, et le dit', async () => {
    const module = await CHARGEURS[id]!()
    poser(module, outil(id, { nimporte: 'quoi' }))
    expect(hote.querySelector('.etat-invalide')).not.toBeNull()
    expect(hote.textContent).toContain('l’état est toujours enregistré')
  })

  it('remonte une spécification de partage quand on diffuse', async () => {
    const module = await CHARGEURS[id]!()
    const onDiffuser = poser(module, outil(id, module.creer(id, LE_9_SEPT).etat))
    act(() => hote.querySelector<HTMLButtonElement>('.outil-action.principale')?.click())
    const partage = onDiffuser.mock.calls[0]?.[0] as ShareSpec | undefined
    expect(partage?.card.link).toBe('atl.cm/a/ZBV3')
  })
})

/** Le même état, avec une entreprise renseignée : le document n'est plus vierge. */
function avecEmetteur(etat: unknown): unknown {
  const doc = etat as { emetteur: Record<string, string> }
  return { ...doc, emetteur: { ...doc.emetteur, nom: 'Ets Ngo Bassong' } }
}

describe('les documents ont un onglet d’édition', () => {
  it.each(['devis', 'facture'] as const)('« %s » s’ouvre sur le formulaire tant qu’il est vierge', async (id) => {
    const module = await CHARGEURS[id]!()
    poser(module, outil(id, module.creer(id, LE_9_SEPT).etat))
    // Une page blanche surmontée de sept mentions manquantes n'apprend rien :
    // un document neuf s'ouvre là où on le remplit.
    expect(hote.textContent).toContain('Raison sociale')
    expect(hote.textContent).not.toContain('Sous-total HT')
  })

  it.each(['devis', 'facture'] as const)('« %s » s’ouvre sur le document dès qu’il porte un nom', async (id) => {
    const module = await CHARGEURS[id]!()
    poser(module, outil(id, avecEmetteur(module.creer(id, LE_9_SEPT).etat)))
    expect(hote.textContent).toContain('Sous-total HT')
  })

  it.each(['devis', 'facture'] as const)('« %s » bascule vers le document', async (id) => {
    const module = await CHARGEURS[id]!()
    poser(module, outil(id, module.creer(id, LE_9_SEPT).etat))

    act(() => hote.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="false"]')?.click())
    expect(hote.textContent).toContain('Sous-total HT')
  })

  it.each(['devis', 'facture'] as const)('« %s » énumère les mentions qui manquent', async (id) => {
    const module = await CHARGEURS[id]!()
    poser(module, outil(id, avecEmetteur(module.creer(id, LE_9_SEPT).etat)))
    // Un document sans NIU ni RCCM ne passe pas un contrôle : on le liste au
    // lieu de l'écrire en prose, et on offre le geste qui le répare.
    const alerte = hote.querySelector('.alerte')
    expect(alerte?.textContent).toContain('NIU')
    expect(alerte?.querySelectorAll('li').length).toBeGreaterThan(1)

    act(() => alerte?.querySelector<HTMLButtonElement>('.alerte-action')?.click())
    expect(hote.textContent).toContain('Raison sociale')
  })

  it('ne montre pas les champs dérivés à la création', async () => {
    const module = await CHARGEURS.devis!()
    poser(module, outil('devis', module.creer('devis', LE_9_SEPT).etat))
    expect(hote.textContent).toContain('Numéro')
    expect(hote.textContent).not.toContain('Date d’émission')
  })
})
