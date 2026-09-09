import { describe, expect, it } from 'vitest'
import type { EtatListe } from '../src/compute/liste.js'
import { caisse, clients, prix, stock } from '../src/skeletons/registres.js'
import { cellule } from '../src/skeletons/liste.js'
import { ESPACE_INSECABLE } from '../src/format.js'
import type { RenderContext } from '../src/types.js'
import { valider } from '../src/valider.js'

const E = ESPACE_INSECABLE
const CTX: RenderContext = { lien: 'atl.cm/p/ZBV3', maintenant: new Date('2026-09-09T07:45:00Z') }
const SANS_LIEN: RenderContext = { lien: '', maintenant: CTX.maintenant }

const BOUTIQUE: EtatListe = {
  nom: 'Boutique Mami Nga',
  lignes: [
    { article: 'Sac de riz 25 kg', prix: 18_500, disponible: true },
    { article: 'Bidon d’huile 5 L', prix: 7_200, disponible: true },
    { article: 'Carton de savon', prix: 4_800, disponible: false },
  ],
}

const LIVRE: EtatListe = {
  nom: 'Caisse de la quincaillerie',
  lignes: [
    { libelle: 'Vente du matin', entree: 24_000, sortie: 0 },
    { libelle: 'Achat de sacs', entree: 0, sortie: 7_500 },
  ],
}

const MAGASIN: EtatListe = {
  nom: 'Dépôt Bépanda',
  lignes: [
    { article: 'Ciment', reste: 40 },
    { article: 'Tôles bac', reste: 3 },
  ],
}

describe('cellule — ce qui s’imprime dans une case', () => {
  it('met en forme selon le type de la colonne', () => {
    const ligne = { a: 'Riz', b: 18_500, c: 12, d: true }
    expect(cellule(ligne, { clef: 'a', type: 'texte' })).toBe('Riz')
    expect(cellule(ligne, { clef: 'b', type: 'montant' })).toBe(`18${E}500${E}F`)
    expect(cellule(ligne, { clef: 'c', type: 'nombre' })).toBe('12')
    expect(cellule(ligne, { clef: 'd', type: 'bascule' })).toBe('oui')
  })
})

describe('la liste de prix', () => {
  const carte = prix.card(BOUTIQUE, CTX)

  it('met en avant ce qui est disponible', () => {
    expect(carte.kicker).toBe('LISTE DE PRIX')
    expect(carte.title).toBe('Boutique Mami Nga')
    expect(carte.bigLabel).toBe('DISPONIBLE')
    expect(carte.big).toBe('2 / 3')
    expect(carte.pct).toBeCloseTo(2 / 3, 10)
  })

  it('coche le disponible et alerte sur le reste', () => {
    expect(carte.items[0]).toMatchObject({ n: 'Sac de riz 25 kg', ok: true, warn: false })
    expect(carte.items[2]).toMatchObject({ n: 'Carton de savon', ok: false, warn: true })
  })

  it('porte le prix en colonne de droite', () => {
    expect(carte.items[0]?.val).toBe(`18${E}500${E}F`)
  })

  it('se diffuse au lieu de se relancer, et le dit', () => {
    const partage = prix.share(BOUTIQUE, CTX)
    expect(partage.relances).toEqual([])
    expect(partage.relancesVides).toContain('se diffuse')
    expect(partage.txt).toContain('BOUTIQUE MAMI NGA — liste de prix')
    expect(partage.txt).toContain(`• Sac de riz 25 kg — 18${E}500${E}F`)
    expect(partage.txt).toContain('atl.cm/p/ZBV3')
  })

  it('n’écrit pas de lien quand il n’y en a pas', () => {
    expect(prix.share(BOUTIQUE, SANS_LIEN).txt).not.toContain('atl.cm')
  })
})

describe('le livre de caisse', () => {
  it('met le solde en grand, sans barre d’avancement', () => {
    const carte = caisse.card(LIVRE, CTX)
    expect(carte.bigLabel).toBe('SOLDE')
    expect(carte.big).toBe(`16${E}500${E}F`)
    expect(carte.pct).toBeNull()
  })

  it('montre l’entrée et la sortie de chaque écriture', () => {
    const carte = caisse.card(LIVRE, CTX)
    expect(carte.items[1]?.val).toBe(`0${E}F · 7${E}500${E}F`)
  })
})

describe('l’inventaire', () => {
  const carte = stock.card(MAGASIN, CTX)

  it('totalise les articles, sans unité monétaire', () => {
    expect(carte.bigLabel).toBe('ARTICLES')
    expect(carte.big).toBe('43')
  })

  it('signale ce qui passe sous le seuil', () => {
    expect(carte.items[0]).toMatchObject({ n: 'Ciment', ok: true, warn: false })
    expect(carte.items[1]).toMatchObject({ n: 'Tôles bac', ok: false, warn: true })
    expect(carte.subline).toContain('1 à réapprovisionner')
  })
})

describe('l’annuaire', () => {
  it('compte les lignes quand il n’y a ni total ni bascule', () => {
    const carte = clients.card(
      { nom: 'Mes clients', lignes: [{ nom: 'M. Fotso', tel: '699112233' }] },
      CTX,
    )
    expect(carte.bigLabel).toBe('LIGNES')
    expect(carte.big).toBe('1')
    expect(carte.items[0]?.val).toBe('699112233')
  })
})

describe('tous les registres de liste', () => {
  it.each([prix, caisse, stock, clients].map((s) => [s.id, s] as const))(
    '« %s » démarre vide, et cet état vide valide',
    (_id, squelette) => {
      expect(squelette.defaults.lignes).toEqual([])
      expect(valider(squelette.schema, squelette.defaults)).toEqual([])
    },
  )

  it.each([prix, caisse, stock, clients].map((s) => [s.id, s] as const))(
    '« %s » tient sur un registre vide sans diviser par zéro',
    (_id, squelette) => {
      const carte = squelette.card(squelette.defaults, CTX)
      expect(carte.items).toEqual([])
      expect(carte.big).not.toContain('NaN')
      expect(carte.pct === null || carte.pct === 0).toBe(true)
    },
  )

  it('résume les vingt premières lignes, puis annonce le reste', () => {
    const beaucoup: EtatListe = {
      nom: 'Gros catalogue',
      lignes: Array.from({ length: 26 }, (_, i) => ({
        article: `Article ${i + 1}`, prix: 1_000, disponible: true,
      })),
    }
    const txt = prix.share(beaucoup, CTX).txt
    expect(txt).toContain('• Article 20 —')
    expect(txt).not.toContain('• Article 21 —')
    expect(txt).toContain('… et 6 autres')
  })
})
