import { describe, expect, it } from 'vitest'
import type { EtatNjangi } from '../src/compute/njangi.js'
import { classer, trouverSquelette } from '../src/match.js'
import { devis, njangi, SQUELETTES, squeletteParId } from '../src/skeletons/index.js'
import { njangiCard, njangiShare } from '../src/skeletons/njangi.js'
import { ESPACE_INSECABLE } from '../src/format.js'
import type { RenderContext } from '../src/types.js'
import { estValide, messageErreurs, valider } from '../src/valider.js'

const CTX: RenderContext = {
  lien: 'atl.cm/n/ZBV3?t=36',
  maintenant: new Date('2026-09-09T07:45:00.000Z'),
}

const CARNET: EtatNjangi = {
  nom: 'Njangi Nkolbisson',
  cotisation: 5_000,
  periode: 'semaine',
  tour: 36,
  historique: [{ tour: 35, collecte: 30_000 }],
  membres: [
    { nom: 'Mama Céline', aVerse: true, aRecu: true, estAuTour: false, versements: 12, tours: 12 },
    { nom: 'Ernest', tel: '699112233', aVerse: true, aRecu: false, estAuTour: true, versements: 11, tours: 12 },
    { nom: 'Adèle', tel: '699445566', aVerse: false, aRecu: false, estAuTour: false, versements: 7, tours: 12 },
    { nom: 'Serge', aVerse: false, aRecu: false, estAuTour: false, versements: 9, tours: 12 },
  ],
}

describe('le contrat que tout squelette doit tenir', () => {
  it.each(SQUELETTES.map((s) => [s.id, s] as const))(
    '« %s » : son état par défaut valide contre son propre schéma',
    (_id, squelette) => {
      const erreurs = valider(squelette.schema, squelette.defaults)
      expect(messageErreurs(erreurs)).toBe('')
    },
  )

  it.each(SQUELETTES.map((s) => [s.id, s] as const))('« %s » : son identité est renseignée', (_id, s) => {
    expect(s.id).toMatch(/^[a-z][a-z0-9-]*$/)
    expect(s.title.length).toBeGreaterThan(0)
    expect(s.keywords.length).toBeGreaterThan(0)
    expect(s.schema.type).toBe('object')
  })

  it('n’a pas deux squelettes du même identifiant', () => {
    const ids = SQUELETTES.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('se retrouve par son identifiant', () => {
    expect(squeletteParId('njangi')?.title).toBe('Carnet de njangi')
    expect(squeletteParId('inconnu')).toBeNull()
  })
})

describe('le schéma refuse ce que le rendu ne saurait pas dessiner', () => {
  it('refuse une période inventée', () => {
    expect(estValide(njangi.schema, { ...CARNET, periode: 'trimestre' })).toBe(false)
  })

  it('refuse une cotisation négative ou fractionnaire', () => {
    expect(estValide(njangi.schema, { ...CARNET, cotisation: -1 })).toBe(false)
    expect(estValide(njangi.schema, { ...CARNET, cotisation: 5_000.5 })).toBe(false)
  })

  it('refuse un champ que le modèle aurait inventé', () => {
    expect(estValide(njangi.schema, { ...CARNET, tauxInteret: 12 })).toBe(false)
  })

  it('refuse un membre incomplet', () => {
    expect(estValide(njangi.schema, { ...CARNET, membres: [{ nom: 'Adèle' }] })).toBe(false)
  })

  it('accepte un membre sans numéro de téléphone', () => {
    expect(estValide(njangi.schema, CARNET)).toBe(true)
  })

  it('refuse un acompte hors de 0–100 sur le devis', () => {
    expect(estValide(devis.schema, { ...devis.defaults, acompte: 120 })).toBe(false)
  })

  it('refuse une encre hors palette', () => {
    expect(estValide(devis.schema, { ...devis.defaults, encre: 'turquoise' })).toBe(false)
  })
})

describe('la carte du njangi', () => {
  const carte = njangiCard(CARNET, CTX)

  it('résume la cagnotte du tour', () => {
    expect(carte.kicker).toBe('CARNET DE NJANGI')
    expect(carte.title).toBe('Njangi Nkolbisson')
    expect(carte.tag).toBe('S36')
    expect(carte.bigLabel).toBe('COLLECTÉ CETTE SEMAINE')
    expect(carte.big).toContain('10')
    expect(carte.pct).toBeCloseTo(0.5, 10)
    expect(carte.subline).toContain('2 sur 4 ont versé')
  })

  it('signale qui reçoit ce tour, et coche ceux qui ont versé', () => {
    expect(carte.items[1]?.n).toBe('Ernest — reçoit ce tour')
    expect(carte.items[1]).toMatchObject({ ok: true, warn: false })
    expect(carte.items[2]).toMatchObject({ ok: false, warn: true, val: '—' })
  })

  it('adapte l’étiquette au rythme du njangi', () => {
    expect(njangiCard({ ...CARNET, periode: 'mois' }, CTX).tag).toBe('M36')
    expect(njangiCard({ ...CARNET, periode: 'mois' }, CTX).bigLabel).toBe('COLLECTÉ CE MOIS')
    expect(njangiCard({ ...CARNET, periode: 'quinzaine' }, CTX).tag).toBe('Q36')
  })

  it('tient sur un njangi vide sans diviser par zéro', () => {
    const vide = njangiCard({ ...CARNET, membres: [] }, CTX)
    expect(vide.pct).toBe(0)
    expect(vide.items).toEqual([])
    expect(vide.sub).toContain('0 membre')
  })
})

describe('le partage du njangi', () => {
  const partage = njangiShare(CARNET, CTX)

  it('écrit le résumé du prototype', () => {
    const E = ESPACE_INSECABLE
    expect(partage.txt).toBe(
      [
        'NJANGI NKOLBISSON — semaine 36',
        `Collecté : 10${E}000${E}F sur 20${E}000${E}F`,
        'Tour : Ernest',
        'En attente : Adèle, Serge',
        'atl.cm/n/ZBV3?t=36',
      ].join('\n'),
    )
  })

  it('dit que personne n’est en retard quand c’est le cas', () => {
    const tous = { ...CARNET, membres: CARNET.membres.map((m) => ({ ...m, aVerse: true })) }
    expect(njangiShare(tous, CTX).txt).toContain('Personne en retard')
    expect(njangiShare(tous, CTX).relances).toEqual([])
  })

  it('prépare une relance par retardataire, avec son nom et le lien', () => {
    expect(partage.relances.map((r) => r.nom)).toEqual(['Adèle', 'Serge'])
    expect(partage.relances[0]?.message).toContain('Adèle')
    expect(partage.relances[0]?.message).toContain('atl.cm/n/ZBV3?t=36')
    expect(partage.relances[0]?.tel).toBe('699445566')
    expect(partage.relances[1]?.tel).toBeNull()
  })

  it('n’invente pas d’échéance dans la relance', () => {
    expect(partage.relances[0]?.message).not.toMatch(/vendredi|lundi|avant le/)
  })

  it('nomme le fichier de la carte par le tour', () => {
    expect(partage.name).toBe('njangi-s36')
  })

  it('n’attache aucun avertissement — un njangi se publie', () => {
    expect(partage.warn).toBeNull()
  })
})

describe('étage 1 — la correspondance de mots-clés, à zéro jeton', () => {
  it.each([
    ['il me faut un devis', 'devis'],
    ['noter qui a cotisé au njangi', 'njangi'],
    ['je veux tenir une tontine', 'njangi'],
    ['faire un chiffrage pour un chantier', 'devis'],
    ['CAGNOTTE du quartier', 'njangi'],
  ])('« %s » → %s', (demande, id) => {
    expect(trouverSquelette(demande, SQUELETTES)?.id).toBe(id)
  })

  it('ne force pas une réponse quand rien ne correspond', () => {
    expect(trouverSquelette('je veux vendre des beignets', SQUELETTES)).toBeNull()
    expect(trouverSquelette('', SQUELETTES)).toBeNull()
    expect(trouverSquelette('   ', SQUELETTES)).toBeNull()
  })

  it('préfère le mot-clé le plus spécifique', () => {
    // « tour » et « njangi » matchent tous les deux ; le plus long l'emporte.
    const c = classer('le tour du njangi', SQUELETTES)
    expect(c[0]?.squelette.id).toBe('njangi')
    expect(c[0]?.reconnus).toContain('njangi')
  })

  it('ignore la casse, les accents et la ponctuation', () => {
    expect(trouverSquelette('DEVIS', SQUELETTES)?.id).toBe('devis')
    expect(trouverSquelette('une estimatiön, vite !', SQUELETTES)?.id).toBe('devis')
    expect(trouverSquelette('un carnet de NJÀNGI', SQUELETTES)?.id).toBe('njangi')
  })
})
