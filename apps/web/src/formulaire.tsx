import type { JsonSchema } from '@a237/engine'
import type { JSX } from 'preact'

/**
 * Le formulaire d'édition, dressé à partir du schéma.
 *
 * C'est la thèse du brief appliquée à l'éditeur : le squelette décrit sa
 * configuration en JSON Schema, et l'écran s'en déduit. Écrire un formulaire à
 * la main par squelette, ce serait dix-sept écrans à tenir à jour, qui
 * divergeraient du schéma au premier champ ajouté — et le schéma est ce que le
 * modèle remplit, donc la divergence se paierait deux fois.
 *
 * Les libellés viennent de `title`, un mot-clef standard de JSON Schema : pas
 * de table de traduction à côté, donc rien à oublier de traduire.
 */

export interface ProprietesChamps {
  readonly schema: JsonSchema
  readonly valeur: unknown
  readonly onChange: (valeur: unknown) => void
  /** Chemins à ne pas montrer : dérivés, ou tenus par un autre écran. */
  readonly masques?: readonly string[]
  readonly chemin?: string
}

function libelle(schema: JsonSchema, clef: string): string {
  return schema.title ?? clef
}

function objetAvec(source: unknown, clef: string, valeur: unknown): Record<string, unknown> {
  const base = typeof source === 'object' && source !== null ? (source as Record<string, unknown>) : {}
  return { ...base, [clef]: valeur }
}

function ChampTexte(props: {
  readonly schema: Extract<JsonSchema, { type: 'string' }>
  readonly id: string
  readonly valeur: unknown
  readonly onChange: (v: string) => void
}): JSX.Element {
  const valeur = typeof props.valeur === 'string' ? props.valeur : ''

  if (props.schema.enum !== undefined) {
    return (
      <select
        id={props.id}
        value={valeur}
        onChange={(e) => props.onChange((e.target as HTMLSelectElement).value)}
      >
        {props.schema.enum.map((o) => (
          <option value={o} key={o}>
            {o}
          </option>
        ))}
      </select>
    )
  }

  // Au-delà de cent vingt caractères on écrit un paragraphe, pas une ligne.
  if ((props.schema.maxLength ?? 0) > 120) {
    return (
      <textarea
        id={props.id}
        rows={4}
        value={valeur}
        onInput={(e) => props.onChange((e.target as HTMLTextAreaElement).value)}
      />
    )
  }

  return (
    <input
      id={props.id}
      type="text"
      value={valeur}
      maxLength={props.schema.maxLength ?? undefined}
      onInput={(e) => props.onChange((e.target as HTMLInputElement).value)}
    />
  )
}

export function ChampsSchema(props: ProprietesChamps): JSX.Element | null {
  const chemin = props.chemin ?? '$'
  const masques = props.masques ?? []
  if (masques.includes(chemin)) return null

  const schema = props.schema

  if (schema.type === 'object') {
    const valeur = props.valeur
    const champs = Object.entries(schema.properties).map(([clef, sous]) => (
      <ChampsSchema
        key={clef}
        schema={sous}
        chemin={`${chemin}.${clef}`}
        masques={masques}
        valeur={
          typeof valeur === 'object' && valeur !== null
            ? (valeur as Record<string, unknown>)[clef]
            : undefined
        }
        onChange={(v) => props.onChange(objetAvec(valeur, clef, v))}
      />
    ))

    /*
     * Un objet imbriqué qui se nomme devient un bloc.
     *
     * Sans ça, un devis est un ruban de dix-sept champs où « Téléphone » —
     * celui de l'entreprise — et « Téléphone du client » se ressemblent trop
     * pour qu'on sache lequel on remplit. Le schéma porte déjà les noms des
     * blocs (« Ton entreprise », « Le client ») : il n'y a rien à inventer.
     *
     * La racine, elle, reste à plat : un cadre autour de tout le formulaire
     * n'entoure rien.
     */
    if (chemin !== '$' && schema.title !== undefined) {
      return (
        <fieldset class="champ-groupe">
          <legend>{schema.title}</legend>
          {champs}
        </fieldset>
      )
    }

    return <>{champs}</>
  }

  if (schema.type === 'array') {
    const liste = Array.isArray(props.valeur) ? (props.valeur as unknown[]) : []
    const plein = schema.maxItems !== undefined && liste.length >= schema.maxItems
    return (
      <fieldset class="champ-groupe">
        <legend>{libelle(schema, chemin)}</legend>
        {liste.length === 0 && <p class="champ-vide">Rien pour l’instant.</p>}
        {liste.map((element, i) => (
          <div class="champ-element" key={`${chemin}-${i}`}>
            <ChampsSchema
              schema={schema.items}
              chemin={`${chemin}[]`}
              masques={masques}
              valeur={element}
              onChange={(v) => props.onChange(liste.map((x, j) => (j === i ? v : x)))}
            />
            <button
              type="button"
              class="champ-retirer"
              aria-label={`Retirer la ligne ${i + 1}`}
              onClick={() => props.onChange(liste.filter((_, j) => j !== i))}
            >
              Retirer
            </button>
          </div>
        ))}
        <button
          type="button"
          class="champ-ajouter"
          disabled={plein}
          onClick={() => props.onChange([...liste, valeurNeuve(schema.items)])}
        >
          Ajouter une ligne
        </button>
      </fieldset>
    )
  }

  const id = `champ-${chemin.replace(/[^a-zA-Z0-9]+/g, '-')}`

  if (schema.type === 'boolean') {
    return (
      <label class="champ champ-case" for={id}>
        <input
          id={id}
          type="checkbox"
          checked={props.valeur === true}
          onChange={(e) => props.onChange((e.target as HTMLInputElement).checked)}
        />
        <span>{libelle(schema, chemin)}</span>
      </label>
    )
  }

  if (schema.type === 'integer' || schema.type === 'number') {
    return (
      <label class="champ" for={id}>
        <span class="champ-libelle">{libelle(schema, chemin)}</span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={typeof props.valeur === 'number' ? String(props.valeur) : ''}
          onInput={(e) => {
            // Les claviers d'Android d'entrée de gamme envoient volontiers des
            // espaces et des virgules : on les accepte plutôt que de refuser.
            const brut = (e.target as HTMLInputElement).value.replace(/\s/g, '').replace(',', '.')
            const nombre = brut === '' ? 0 : Number(brut)
            props.onChange(Number.isFinite(nombre) ? nombre : 0)
          }}
        />
        {schema.description !== undefined && <span class="champ-aide">{schema.description}</span>}
      </label>
    )
  }

  if (schema.type === 'string') {
    return (
      <label class="champ" for={id}>
        <span class="champ-libelle">{libelle(schema, chemin)}</span>
        <ChampTexte schema={schema} id={id} valeur={props.valeur} onChange={props.onChange} />
        {schema.description !== undefined && <span class="champ-aide">{schema.description}</span>}
      </label>
    )
  }

  return null
}

/** Une valeur neuve conforme au schéma, pour l'ajout d'une ligne. */
export function valeurNeuve(schema: JsonSchema): unknown {
  switch (schema.type) {
    case 'string':
      return schema.enum?.[0] ?? ''
    case 'number':
    case 'integer':
      return schema.minimum ?? 0
    case 'boolean':
      return false
    case 'array':
      return []
    case 'object':
      return Object.fromEntries(
        (schema.required ?? Object.keys(schema.properties)).map((clef) => [
          clef,
          valeurNeuve(schema.properties[clef] ?? { type: 'string' }),
        ]),
      )
  }
}
