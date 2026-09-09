// @vitest-environment happy-dom
import type { JsonSchema } from '@a237/engine'
import { render as monter } from 'preact'
import { act } from 'preact/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChampsSchema, valeurNeuve } from '../src/formulaire.js'

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
  schema: JsonSchema,
  valeur: unknown,
  onChange: (v: unknown) => void = () => undefined,
  masques?: readonly string[],
): void {
  act(() => {
    monter(
      <ChampsSchema
        schema={schema}
        valeur={valeur}
        onChange={onChange}
        {...(masques !== undefined ? { masques } : {})}
      />,
      hote,
    )
  })
}

function saisir(selecteur: string, valeur: string): void {
  const champ = hote.querySelector<HTMLInputElement | HTMLTextAreaElement>(selecteur)
  if (champ === null) throw new Error(`champ introuvable : ${selecteur}`)
  act(() => {
    champ.value = valeur
    champ.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('les libellés viennent du schéma', () => {
  it('emploie title, pas la clef', () => {
    poser(
      { type: 'object', properties: { niu: { type: 'string', title: 'NIU' } } },
      {},
    )
    expect(hote.textContent).toContain('NIU')
    expect(hote.textContent).not.toContain('niu')
  })

  it('retombe sur le chemin quand le champ n’a pas de libellé', () => {
    poser({ type: 'object', properties: { obscur: { type: 'string' } } }, {})
    expect(hote.textContent).toContain('obscur')
  })

  it('affiche la description en aide', () => {
    poser(
      { type: 'object', properties: { n: { type: 'string', title: 'N', description: 'Ex. DV-1.' } } },
      {},
    )
    expect(hote.textContent).toContain('Ex. DV-1.')
  })
})

describe('le champ dépend du type', () => {
  it('rend une ligne pour un texte court', () => {
    poser({ type: 'string', title: 'Nom', maxLength: 40 }, 'Adèle')
    const champ = hote.querySelector<HTMLInputElement>('input[type="text"]')
    expect(champ?.value).toBe('Adèle')
    expect(champ?.maxLength).toBe(40)
  })

  it('rend un paragraphe au-delà de cent vingt caractères', () => {
    poser({ type: 'string', title: 'Conditions', maxLength: 200 }, '')
    expect(hote.querySelector('textarea')).not.toBeNull()
    expect(hote.querySelector('input[type="text"]')).toBeNull()
  })

  it('rend une liste déroulante pour un enum', () => {
    poser({ type: 'string', title: 'Encre', enum: ['encre', 'bordeaux'] }, 'bordeaux')
    const select = hote.querySelector<HTMLSelectElement>('select')
    expect(select?.value).toBe('bordeaux')
    expect(select?.options).toHaveLength(2)
  })

  it('rend une case à cocher pour un booléen', () => {
    poser({ type: 'boolean', title: 'Entreprise' }, true)
    expect(hote.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(true)
  })

  it('ouvre un clavier numérique pour un nombre', () => {
    poser({ type: 'integer', title: 'Cotisation' }, 5_000)
    const champ = hote.querySelector<HTMLInputElement>('input')
    expect(champ?.value).toBe('5000')
    expect(champ?.inputMode).toBe('decimal')
  })
})

describe('la saisie remonte une nouvelle valeur, sans muter l’ancienne', () => {
  it('remonte le texte tapé', () => {
    const onChange = vi.fn()
    poser({ type: 'string', title: 'Nom' }, '', onChange)
    saisir('input', 'Ets Mbarga')
    expect(onChange).toHaveBeenCalledWith('Ets Mbarga')
  })

  it('accepte les espaces et la virgule d’un clavier Android', () => {
    const onChange = vi.fn()
    poser({ type: 'integer', title: 'Montant' }, 0, onChange)
    saisir('input', '12 500')
    expect(onChange).toHaveBeenLastCalledWith(12_500)
    saisir('input', '2,5')
    expect(onChange).toHaveBeenLastCalledWith(2.5)
  })

  it('retombe sur zéro plutôt que sur NaN', () => {
    const onChange = vi.fn()
    poser({ type: 'integer', title: 'Montant' }, 0, onChange)
    saisir('input', 'beaucoup')
    expect(onChange).toHaveBeenLastCalledWith(0)
    saisir('input', '')
    expect(onChange).toHaveBeenLastCalledWith(0)
  })

  it('recompose l’objet sans toucher à l’original', () => {
    const onChange = vi.fn()
    const valeur = { nom: 'Ets', niu: 'M0221' }
    poser(
      {
        type: 'object',
        properties: { nom: { type: 'string', title: 'Nom' }, niu: { type: 'string', title: 'NIU' } },
      },
      valeur,
      onChange,
    )
    saisir('input', 'Ets Mbarga')
    expect(onChange).toHaveBeenCalledWith({ nom: 'Ets Mbarga', niu: 'M0221' })
    expect(valeur.nom).toBe('Ets')
  })

  it('recompose un objet imbriqué de bout en bout', () => {
    const onChange = vi.fn()
    poser(
      {
        type: 'object',
        properties: {
          emetteur: {
            type: 'object',
            title: 'Ton entreprise',
            properties: { nom: { type: 'string', title: 'Raison sociale' } },
          },
        },
      },
      { emetteur: { nom: '' } },
      onChange,
    )
    saisir('input', 'Quincaillerie')
    expect(onChange).toHaveBeenCalledWith({ emetteur: { nom: 'Quincaillerie' } })
  })
})

describe('les listes', () => {
  const schema: JsonSchema = {
    type: 'array',
    title: 'Lignes',
    maxItems: 2,
    items: {
      type: 'object',
      properties: {
        designation: { type: 'string', title: 'Désignation' },
        prixUnitaire: { type: 'integer', title: 'Prix' },
      },
      required: ['designation', 'prixUnitaire'],
    },
  }

  it('dit qu’il n’y a rien plutôt que de ne rien montrer', () => {
    poser(schema, [])
    expect(hote.textContent).toContain('Rien pour l’instant')
  })

  it('ajoute une ligne conforme au schéma', () => {
    const onChange = vi.fn()
    poser(schema, [], onChange)
    act(() => hote.querySelector<HTMLButtonElement>('.champ-ajouter')?.click())
    expect(onChange).toHaveBeenCalledWith([{ designation: '', prixUnitaire: 0 }])
  })

  it('retire la bonne ligne', () => {
    const onChange = vi.fn()
    poser(schema, [{ designation: 'a', prixUnitaire: 1 }, { designation: 'b', prixUnitaire: 2 }], onChange)
    act(() => hote.querySelector<HTMLButtonElement>('[aria-label="Retirer la ligne 1"]')?.click())
    expect(onChange).toHaveBeenCalledWith([{ designation: 'b', prixUnitaire: 2 }])
  })

  it('modifie la bonne ligne', () => {
    const onChange = vi.fn()
    poser(schema, [{ designation: 'a', prixUnitaire: 1 }, { designation: 'b', prixUnitaire: 2 }], onChange)
    const champs = hote.querySelectorAll<HTMLInputElement>('.champ-element input')
    act(() => {
      const cible = champs[2]
      if (cible === undefined) throw new Error('champ absent')
      cible.value = 'bis'
      cible.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(onChange).toHaveBeenCalledWith([
      { designation: 'a', prixUnitaire: 1 },
      { designation: 'bis', prixUnitaire: 2 },
    ])
  })

  it('interdit d’ajouter au-delà du plafond du schéma', () => {
    poser(schema, [{ designation: 'a', prixUnitaire: 1 }, { designation: 'b', prixUnitaire: 2 }])
    expect(hote.querySelector<HTMLButtonElement>('.champ-ajouter')?.disabled).toBe(true)
  })

  it('tient sur une valeur qui n’est pas une liste', () => {
    poser(schema, 'pas une liste')
    expect(hote.textContent).toContain('Rien pour l’instant')
  })
})

describe('les champs masqués', () => {
  it('ne montrent pas ce qui est dérivé', () => {
    poser(
      {
        type: 'object',
        properties: {
          numero: { type: 'string', title: 'Numéro' },
          emisLe: { type: 'string', title: 'Date d’émission' },
        },
      },
      {},
      () => undefined,
      ['$.emisLe'],
    )
    expect(hote.textContent).toContain('Numéro')
    expect(hote.textContent).not.toContain('Date d’émission')
  })
})

describe('valeurNeuve', () => {
  it.each([
    [{ type: 'string' } as JsonSchema, ''],
    [{ type: 'string', enum: ['a', 'b'] } as JsonSchema, 'a'],
    [{ type: 'integer' } as JsonSchema, 0],
    [{ type: 'integer', minimum: 5 } as JsonSchema, 5],
    [{ type: 'boolean' } as JsonSchema, false],
    [{ type: 'array', items: { type: 'string' } } as JsonSchema, []],
  ])('rend une valeur conforme pour %j', (schema, attendu) => {
    expect(valeurNeuve(schema)).toEqual(attendu)
  })

  it('remplit un objet avec ses champs obligatoires', () => {
    expect(
      valeurNeuve({
        type: 'object',
        properties: { a: { type: 'string' }, b: { type: 'integer' }, c: { type: 'boolean' } },
        required: ['a', 'b'],
      }),
    ).toEqual({ a: '', b: 0 })
  })

  it('remplit tous les champs quand aucun n’est déclaré obligatoire', () => {
    expect(valeurNeuve({ type: 'object', properties: { a: { type: 'string' } } })).toEqual({ a: '' })
  })
})
