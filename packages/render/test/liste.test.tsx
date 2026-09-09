// @vitest-environment happy-dom
import type { ConfigListe, EtatListe, RenderContext, ShareSpec } from '@a237/engine'
import { ESPACE_INSECABLE, prix, stock } from '@a237/engine'
import { render as monter } from 'preact'
import { act } from 'preact/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RegistreListe } from '../src/registre/liste.js'

const E = ESPACE_INSECABLE
const CTX: RenderContext = { lien: 'atl.cm/p/ZBV3', maintenant: new Date('2026-09-09T07:45:00Z') }

const CONFIG_PRIX: ConfigListe = {
  kicker: 'LISTE DE PRIX',
  colonnes: [
    { clef: 'article', titre: 'Article', type: 'texte' },
    { clef: 'prix', titre: 'Prix (F CFA)', type: 'montant' },
    { clef: 'disponible', titre: 'Disponible', type: 'bascule' },
  ],
  libelleVide: 'Aucun article pour l’instant.',
  libelleAjout: 'Ajouter un article',
  relancesVides: 'Une liste de prix se diffuse.',
}

const CONFIG_STOCK: ConfigListe = {
  kicker: 'INVENTAIRE',
  colonnes: [
    { clef: 'article', titre: 'Article', type: 'texte' },
    { clef: 'reste', titre: 'Quantité restante', type: 'nombre' },
  ],
  total: { type: 'somme', clef: 'reste', libelle: 'Articles', unite: '' },
  alerte: { clef: 'reste', seuil: 5, libelle: 'à réapprovisionner' },
  libelleVide: 'L’inventaire est vide.',
  libelleAjout: 'Ajouter un article',
  relancesVides: 'Un inventaire se consulte.',
}

const BOUTIQUE: EtatListe = {
  nom: 'Boutique Mami Nga',
  lignes: [
    { article: 'Sac de riz 25 kg', prix: 18_500, disponible: true },
    { article: 'Carton de savon', prix: 4_800, disponible: false },
  ],
}

const MAGASIN: EtatListe = {
  nom: 'Dépôt Bépanda',
  lignes: [{ article: 'Ciment', reste: 40 }, { article: 'Tôles bac', reste: 3 }],
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

function poser(
  config: ConfigListe,
  etat: EtatListe,
  squelette: typeof prix,
  onChange: (e: EtatListe) => void = () => undefined,
  onDiffuser: (p: ShareSpec) => void = () => undefined,
): void {
  act(() => {
    monter(
      <RegistreListe
        config={config}
        titre={squelette.title}
        etat={etat}
        ctx={CTX}
        onChange={onChange}
        onDiffuser={onDiffuser}
        partage={squelette.share}
      />,
      hote,
    )
  })
}

function cliquer(selecteur: string): void {
  const bouton = hote.querySelector<HTMLButtonElement>(selecteur)
  if (bouton === null) throw new Error(`bouton introuvable : ${selecteur}`)
  act(() => bouton.click())
}

function cliquerTexte(texte: string): void {
  const bouton = [...hote.querySelectorAll('button')].find((b) => b.textContent === texte)
  if (bouton === undefined) throw new Error(`bouton introuvable : ${texte}`)
  act(() => bouton.click())
}

function saisir(selecteur: string, valeur: string): void {
  const champ = hote.querySelector<HTMLInputElement>(selecteur)
  if (champ === null) throw new Error(`champ introuvable : ${selecteur}`)
  act(() => {
    champ.value = valeur
    champ.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('l’écran d’une liste avec bascule', () => {
  beforeEach(() => poser(CONFIG_PRIX, BOUTIQUE, prix))

  it('nomme le registre et compte ses lignes', () => {
    expect(hote.textContent).toContain('Boutique Mami Nga')
    expect(hote.textContent).toContain('Liste de prix')
    expect(hote.querySelectorAll('.outil-rangee')).toHaveLength(2)
  })

  it('montre l’avancement de ce qui est disponible', () => {
    expect(hote.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('50')
    expect(hote.textContent).toContain('1 sur 2 disponible')
  })

  it('met en forme chaque colonne selon son type', () => {
    expect(hote.textContent).toContain(`18${E}500${E}F`)
  })

  it('donne à chaque bascule une étiquette lisible', () => {
    expect(hote.querySelector('[aria-label="Sac de riz 25 kg : disponible"]')).not.toBeNull()
    expect(hote.querySelector('[aria-label="Carton de savon : pas disponible"]')).not.toBeNull()
  })
})

describe('les gestes appellent le moteur', () => {
  it('bascule la bonne ligne', () => {
    const onChange = vi.fn()
    poser(CONFIG_PRIX, BOUTIQUE, prix, onChange)
    cliquer('[aria-label="Carton de savon : pas disponible"]')
    const suivant = onChange.mock.calls[0]?.[0] as EtatListe
    expect(suivant.lignes[1]?.['disponible']).toBe(true)
    expect(suivant.lignes[0]?.['disponible']).toBe(true)
  })

  it('retire la bonne ligne', () => {
    const onChange = vi.fn()
    poser(CONFIG_PRIX, BOUTIQUE, prix, onChange)
    cliquer('[aria-label="Retirer Sac de riz 25 kg"]')
    const suivant = onChange.mock.calls[0]?.[0] as EtatListe
    expect(suivant.lignes.map((l) => l['article'])).toEqual(['Carton de savon'])
  })

  it('remonte la spécification de partage', () => {
    const onDiffuser = vi.fn()
    poser(CONFIG_PRIX, BOUTIQUE, prix, () => undefined, onDiffuser)
    cliquer('.outil-action.principale')
    const partage = onDiffuser.mock.calls[0]?.[0] as ShareSpec
    expect(partage.card.kicker).toBe('LISTE DE PRIX')
    expect(partage.relancesVides).toContain('se diffuse')
  })

  it('ne modifie pas l’état qu’on lui passe', () => {
    poser(CONFIG_PRIX, BOUTIQUE, prix)
    cliquer('[aria-label="Carton de savon : pas disponible"]')
    expect(BOUTIQUE.lignes[1]?.['disponible']).toBe(false)
  })
})

describe('ajouter une ligne', () => {
  it('bascule vers le formulaire, un champ par colonne', () => {
    poser(CONFIG_PRIX, BOUTIQUE, prix)
    cliquerTexte('Ajouter un article')
    expect(hote.querySelector('[aria-label="Article"]')).not.toBeNull()
    expect(hote.querySelector('[aria-label="Prix (F CFA)"]')).not.toBeNull()
    expect(hote.querySelector<HTMLInputElement>('[aria-label="Disponible"]')?.type).toBe('checkbox')
  })

  it('convertit chaque saisie selon le type de la colonne', () => {
    const onChange = vi.fn()
    poser(CONFIG_PRIX, BOUTIQUE, prix, onChange)
    cliquerTexte('Ajouter un article')
    saisir('[aria-label="Article"]', 'Sucre 1 kg')
    saisir('[aria-label="Prix (F CFA)"]', '1 100')
    act(() => {
      const case_ = hote.querySelector<HTMLInputElement>('[aria-label="Disponible"]')
      if (case_ === null) throw new Error('case absente')
      case_.checked = true
      case_.dispatchEvent(new Event('change', { bubbles: true }))
    })
    cliquerTexte('Ajouter un article')

    const suivant = onChange.mock.calls[0]?.[0] as EtatListe
    expect(suivant.lignes[2]).toEqual({ article: 'Sucre 1 kg', prix: 1_100, disponible: true })
  })

  it('accepte la virgule d’un clavier Android', () => {
    const onChange = vi.fn()
    poser(CONFIG_STOCK, MAGASIN, stock, onChange)
    cliquerTexte('Ajouter un article')
    saisir('[aria-label="Article"]', 'Sable')
    saisir('[aria-label="Quantité restante"]', '2,5')
    cliquerTexte('Ajouter un article')
    expect((onChange.mock.calls[0]?.[0] as EtatListe).lignes[2]?.['reste']).toBe(2.5)
  })

  it('refuse une ligne vide, et le dit au lieu de ne rien faire', () => {
    const onChange = vi.fn()
    poser(CONFIG_PRIX, BOUTIQUE, prix, onChange)
    cliquerTexte('Ajouter un article')
    cliquerTexte('Ajouter un article')
    expect(onChange).not.toHaveBeenCalled()
    expect(hote.textContent).toContain('Remplis au moins un champ.')
  })

  it('revient à la liste sans rien ajouter', () => {
    const onChange = vi.fn()
    poser(CONFIG_PRIX, BOUTIQUE, prix, onChange)
    cliquerTexte('Ajouter un article')
    cliquerTexte('Retour')
    expect(onChange).not.toHaveBeenCalled()
    expect(hote.querySelectorAll('.outil-rangee')).toHaveLength(2)
  })
})

describe('l’écran d’une liste avec total et alerte', () => {
  beforeEach(() => poser(CONFIG_STOCK, MAGASIN, stock))

  it('affiche le total en indicateur, sans barre d’avancement', () => {
    expect(hote.textContent).toContain('Articles')
    expect(hote.textContent).toContain('43')
    expect(hote.querySelector('[role="progressbar"]')).toBeNull()
  })

  it('marque ce qui passe sous le seuil', () => {
    expect(hote.textContent).toContain('à réapprovisionner')
    expect(hote.querySelectorAll('.outil-badge.non')).toHaveLength(1)
  })

  it('n’offre pas de bascule là où la configuration n’en déclare pas', () => {
    expect(hote.querySelector('.outil-bascule')).toBeNull()
  })
})

describe('un registre vide', () => {
  it('invite à commencer au lieu de montrer un tableau vide', () => {
    poser(CONFIG_STOCK, { nom: 'Neuf', lignes: [] }, stock)
    expect(hote.textContent).toContain('L’inventaire est vide.')
    expect(hote.querySelectorAll('.outil-rangee')).toHaveLength(0)
  })

  it('nomme une ligne sans identité plutôt que d’afficher du vide', () => {
    poser(CONFIG_STOCK, { nom: 'Neuf', lignes: [{ article: '', reste: 12 }] }, stock)
    expect(hote.querySelector('.n1')?.textContent).toBe('—')
    expect(hote.querySelector('[aria-label="Retirer la ligne 1"]')).not.toBeNull()
  })
})
