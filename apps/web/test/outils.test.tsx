// @vitest-environment happy-dom
import {
  EXTRAIT_VIDE, ardoise, attestation, caisse, clients, course, cv, dette, devis,
  facture, motivation, njangi, prix, recu, scolarite, stock, valider,
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
  attestation: attestation.schema,
  recu: recu.schema,
  dette: dette.schema,
  motivation: motivation.schema,
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
      'ardoise', 'attestation', 'caisse', 'clients', 'compose', 'compose-calcul',
      'course', 'cv', 'dette', 'devis', 'facture', 'motivation', 'njangi', 'prix',
      'recu', 'scolarite', 'stock',
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
    const neuf = module.creer(id, LE_9_SEPT, EXTRAIT_VIDE)
    expect(neuf.nom.length).toBeGreaterThan(0)
    expect(valider(SCHEMAS[id]!, neuf.etat)).toEqual([])
  })

  it('se dessine à partir de cet état', async () => {
    const module = await CHARGEURS[id]!()
    poser(module, outil(id, module.creer(id, LE_9_SEPT, EXTRAIT_VIDE).etat))
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
    const onDiffuser = poser(module, outil(id, module.creer(id, LE_9_SEPT, EXTRAIT_VIDE).etat))
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
    poser(module, outil(id, module.creer(id, LE_9_SEPT, EXTRAIT_VIDE).etat))
    // Une page blanche surmontée de sept mentions manquantes n'apprend rien :
    // un document neuf s'ouvre là où on le remplit.
    expect(hote.textContent).toContain('Raison sociale')
    expect(hote.textContent).not.toContain('Sous-total HT')
  })

  it.each(['devis', 'facture'] as const)('« %s » s’ouvre sur le document dès qu’il porte un nom', async (id) => {
    const module = await CHARGEURS[id]!()
    poser(module, outil(id, avecEmetteur(module.creer(id, LE_9_SEPT, EXTRAIT_VIDE).etat)))
    expect(hote.textContent).toContain('Sous-total HT')
  })

  it.each(['devis', 'facture'] as const)('« %s » bascule vers le document', async (id) => {
    const module = await CHARGEURS[id]!()
    poser(module, outil(id, module.creer(id, LE_9_SEPT, EXTRAIT_VIDE).etat))

    act(() => hote.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="false"]')?.click())
    expect(hote.textContent).toContain('Sous-total HT')
  })

  it.each(['devis', 'facture'] as const)('« %s » énumère les mentions qui manquent', async (id) => {
    const module = await CHARGEURS[id]!()
    poser(module, outil(id, avecEmetteur(module.creer(id, LE_9_SEPT, EXTRAIT_VIDE).etat)))
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
    poser(module, outil('devis', module.creer('devis', LE_9_SEPT, EXTRAIT_VIDE).etat))
    expect(hote.textContent).toContain('Numéro')
    expect(hote.textContent).not.toContain('Date d’émission')
  })
})

describe('les outils composés par le modèle', () => {
  const CALCUL = {
    titre: 'Marge',
    kicker: 'MARGE',
    titreNom: 'Nom du produit',
    entrees: [
      { clef: 'prixAchat', titre: 'Prix d’achat', defaut: 0, unite: 'F' as const },
      { clef: 'prixVente', titre: 'Prix de vente', defaut: 0, unite: 'F' as const },
    ],
    sortie: {
      libelle: 'Marge',
      unite: 'F' as const,
      formule: { op: 'moins' as const, gauche: { ref: 'prixVente' }, droite: { ref: 'prixAchat' } },
    },
  }

  const REGISTRE = {
    titre: 'Suivi des livraisons',
    kicker: 'SUIVI DES LIVRAISONS',
    titreNom: 'Nom du dépôt',
    colonnes: [
      { clef: 'client', titre: 'Client', type: 'texte' as const },
      { clef: 'montant', titre: 'Montant (F CFA)', type: 'montant' as const },
    ],
    libelleVide: 'Aucune livraison pour l’instant.',
    libelleAjout: 'Ajouter une livraison',
    relancesVides: 'Un suivi se consulte, il ne se relance pas.',
  }

  it('ouvre une calculatrice composée, et sa formule calcule', async () => {
    const module = await CHARGEURS['compose-calcul']!()
    const neuf = module.creer('compose-calcul', LE_9_SEPT, EXTRAIT_VIDE, { calcul: CALCUL })
    expect(neuf.nom).toBe('Marge')

    const etat = { ...(neuf.etat as { nom: string; valeurs: Record<string, number> }) }
    poser(module, { ...outil('compose-calcul', { ...etat, valeurs: { prixAchat: 18_000, prixVente: 25_000 } }), calcul: CALCUL })
    // 25 000 moins 18 000 : l'arbre déclaré passe par l'interprète.
    expect(hote.textContent?.replace(/\s/g, ' ')).toContain('7 000 F')
  })

  it('ouvre un registre composé', async () => {
    const module = await CHARGEURS.compose!()
    const neuf = module.creer('compose', LE_9_SEPT, EXTRAIT_VIDE, { registre: REGISTRE })
    expect(neuf.nom).toBe('Suivi des livraisons')
    poser(module, { ...outil('compose', neuf.etat), registre: REGISTRE })
    expect(hote.textContent).toContain('Aucune livraison')
  })
})

describe('les quatre actes et lettres', () => {
  const ACTES = ['attestation', 'recu', 'dette', 'motivation'] as const

  it.each(ACTES)('« %s » s’ouvre et rend un document valide', async (id) => {
    const module = await CHARGEURS[id]!()
    const neuf = module.creer(id, LE_9_SEPT, EXTRAIT_VIDE)
    expect(valider(SCHEMAS[id]!, neuf.etat)).toEqual([])
    poser(module, outil(id, neuf.etat))
    // Un acte neuf est vide : il s'ouvre donc sur son formulaire.
    expect(hote.textContent).toContain('Modifier')
  })

  it('la reconnaissance de dette réclame ses parties, pas un NIU', async () => {
    const module = await CHARGEURS.dette!()
    const neuf = module.creer('dette', LE_9_SEPT, EXTRAIT_VIDE)
    poser(module, outil('dette', neuf.etat))
    act(() => hote.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="false"]')?.click())
    const alerte = hote.querySelector('.alerte')?.textContent ?? ''
    expect(alerte).toContain('emprunteur')
    // Il n'y a pas d'entreprise dans un acte entre deux personnes.
    expect(alerte).not.toContain('RCCM')
  })

  it('le reçu réclame l’entête légal de l’entreprise', async () => {
    const module = await CHARGEURS.recu!()
    const neuf = module.creer('recu', LE_9_SEPT, EXTRAIT_VIDE)
    poser(module, outil('recu', neuf.etat))
    act(() => hote.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="false"]')?.click())
    expect(hote.querySelector('.alerte')?.textContent).toContain('NIU')
  })

  it('la lettre de motivation ne réclame rien : elle n’a pas de mention obligatoire', async () => {
    const module = await CHARGEURS.motivation!()
    const neuf = module.creer('motivation', LE_9_SEPT, EXTRAIT_VIDE)
    poser(module, outil('motivation', neuf.etat))
    act(() => hote.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="false"]')?.click())
    expect(hote.querySelector('.alerte')).toBeNull()
  })

  it('dit à chaque acte ce qu’il risque, pas ce que risque une facture', async () => {
    // L'encart énonçait « un client qui veut déduire ne pourra pas s'en
    // servir » sur les quatre documents — la raison d'une facture, servie à
    // une reconnaissance de dette où il n'y a ni client ni TVA.
    const lu = async (id: 'dette' | 'recu'): Promise<string> => {
      const module = await CHARGEURS[id]!()
      const neuf = module.creer(id, LE_9_SEPT, EXTRAIT_VIDE)
      // Les quatre actes partagent un même composant : sans démontage, Preact
      // rapproche les deux rendus et l'onglet du précédent survit.
      act(() => monter(null, hote))
      poser(module, outil(id, neuf.etat))
      act(() =>
        hote.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="false"]')?.click(),
      )
      return hote.querySelector('.alerte')?.textContent ?? ''
    }
    const surLaDette = await lu('dette')
    expect(surLaDette).toContain('devant un juge')
    expect(surLaDette).not.toContain('déduire')
    const surLeRecu = await lu('recu')
    expect(surLeRecu).toContain('n’identifie pas l’entreprise')
    expect(surLeRecu).not.toContain('déduire')
  })

  it('refuse un identifiant qui n’est pas un acte', async () => {
    const module = await CHARGEURS.attestation!()
    expect(() => module.creer('bail', LE_9_SEPT, EXTRAIT_VIDE)).toThrow('acte inconnu')
  })

  it('diffuse une carte, jamais une relance', async () => {
    // Un acte se remet en main propre ou s'envoie à une personne : il n'a pas
    // de liste de gens à relancer.
    const module = await CHARGEURS.recu!()
    const neuf = module.creer('recu', LE_9_SEPT, EXTRAIT_VIDE)
    const onDiffuser = poser(module, outil('recu', neuf.etat))
    act(() => hote.querySelector<HTMLButtonElement>('.outil-action.principale')?.click())
    const partage = onDiffuser.mock.calls[0]?.[0] as ShareSpec | undefined
    expect(partage?.card.kicker).toBe('REÇU')
    expect(partage?.relances).toEqual([])
  })
})

describe('le curriculum vitæ', () => {
  async function ouvrir(etat?: unknown): Promise<ModuleOutil> {
    const module = await CHARGEURS.cv!()
    const neuf = module.creer('cv', LE_9_SEPT, EXTRAIT_VIDE)
    poser(module, outil('cv', etat ?? neuf.etat))
    return module
  }

  function versDocument(): void {
    act(() => hote.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="false"]')?.click())
  }

  it('s’ouvre sur son formulaire tant qu’il n’a pas de nom', async () => {
    await ouvrir()
    expect(hote.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('Modifier')
  })

  it('s’ouvre sur la feuille dès qu’il porte un nom', async () => {
    const module = await CHARGEURS.cv!()
    const neuf = module.creer('cv', LE_9_SEPT, EXTRAIT_VIDE)
    const nomme = { ...(neuf.etat as object), identite: { ...cv.defaults.identite, nom: 'Adèle' } }
    poser(module, outil('cv', nomme))
    expect(hote.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('Document')
  })

  it('dit ce que coûte un CV incomplet, dans ses termes à lui', async () => {
    await ouvrir()
    versDocument()
    const alerte = hote.querySelector('.alerte')?.textContent ?? ''
    expect(alerte).toContain('recruteur')
    // Ni TVA ni NIU : un CV ne passe aucun contrôle.
    expect(alerte).not.toContain('déduire')
    expect(alerte).not.toContain('NIU')
  })

  it('offre les quatre gabarits au-dessus de la feuille, pas dans le formulaire', async () => {
    await ouvrir()
    versDocument()
    const boutons = [...hote.querySelectorAll('.cv-gabarit')].map((b) => b.textContent)
    expect(boutons.length).toBe(4)
    expect(boutons[0]).toContain('Notaire')
    // Le formulaire ne redemande pas ce que ces boutons règlent.
    act(() => hote.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="false"]')?.click())
    expect(hote.textContent).not.toContain('Gabarit')
  })

  it('change de gabarit sans rien faire ressaisir', async () => {
    const change = vi.fn()
    const module = await CHARGEURS.cv!()
    const etat = { ...cv.defaults, identite: { ...cv.defaults.identite, nom: 'Adèle' } }
    act(() => {
      monter(
        <module.Outil
          outil={outil('cv', etat)}
          glyphe="◫"
          ctx={CTX}
          onChange={change}
          onDiffuser={vi.fn()}
        />,
        hote,
      )
    })
    const editorial = [...hote.querySelectorAll<HTMLButtonElement>('.cv-gabarit')].find(
      (b) => b.textContent?.includes('Éditorial') === true,
    )
    act(() => editorial?.click())
    expect(change).toHaveBeenCalledWith({ ...etat, gabarit: 'editorial' })
  })

  it('prévient quand le CV déborde d’une page, et propose le compact', async () => {
    // Le débordement se fabrique avec des postes, pas avec un profil de trois
    // mille signes : le schéma en plafonne un à six cents. C'est une carrière
    // longue qui fait deux pages, pas un paragraphe.
    const poste = {
      intitule: 'Magasinière principale',
      employeur: 'Quincaillerie Bépanda',
      periode: '2022 – 2026',
      points: Array.from({ length: 6 }, (_, i) => `${i} ${'x'.repeat(158)}`),
    }
    const long = {
      ...cv.defaults,
      identite: { ...cv.defaults.identite, nom: 'Adèle', titre: 'Magasinière', tel: '699' },
      postes: [poste, poste, poste],
    }
    expect(valider(cv.schema, long)).toEqual([])
    await ouvrir(long)
    expect(hote.querySelector('.note')?.textContent).toContain('compact')
  })

  it('refuse de fabriquer autre chose qu’un CV', async () => {
    const module = await CHARGEURS.cv!()
    expect(() => module.creer('facture', LE_9_SEPT, EXTRAIT_VIDE)).toThrow('ne sait faire qu’un CV')
  })
})

describe('l’ardoise', () => {
  it('s’ouvre sur l’encours et sait dire qu’elle est vide', async () => {
    const module = await CHARGEURS.ardoise!()
    const neuf = module.creer('ardoise', LE_9_SEPT, EXTRAIT_VIDE)
    expect(valider(ardoise.schema, neuf.etat)).toEqual([])
    poser(module, outil('ardoise', neuf.etat))
    expect(hote.textContent).toContain('Encours')
    expect(hote.textContent).toContain('Aucune dette pour l’instant')
  })

  it('refuse de dessiner un état qui n’est pas une ardoise', async () => {
    const module = await CHARGEURS.ardoise!()
    poser(module, outil('ardoise', { nom: 'Bancal' }))
    expect(hote.querySelector('.etat-invalide')).not.toBeNull()
  })

  it('avertit avant de diffuser, toujours', async () => {
    // L'invariant § 2.5 ne dépend pas de l'état de l'ardoise : une ardoise
    // vide qu'on publierait aujourd'hui sera pleine demain.
    const module = await CHARGEURS.ardoise!()
    const neuf = module.creer('ardoise', LE_9_SEPT, EXTRAIT_VIDE)
    const onDiffuser = poser(module, outil('ardoise', neuf.etat))
    act(() => hote.querySelector<HTMLButtonElement>('.outil-action.principale')?.click())
    const partage = onDiffuser.mock.calls[0]?.[0] as ShareSpec | undefined
    expect(partage?.warn).toContain('pour toi, pas pour un groupe')
  })
})
