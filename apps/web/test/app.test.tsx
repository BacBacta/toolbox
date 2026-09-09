// @vitest-environment happy-dom
import 'fake-indexeddb/auto'
import { render as monter } from 'preact'
import { act } from 'preact/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { App } from '../src/app.js'
import { CHARGEURS } from '../src/outils.js'
import { listerOutils, supprimerOutil } from '../src/stockage.js'

let hote: HTMLDivElement

/**
 * Laisse retomber les effets, les promesses d'IndexedDB et les imports
 * différés. Plusieurs tours : ouvrir un outil enchaîne un import dynamique,
 * une écriture en base et deux rendus, qui ne tiennent pas dans un seul.
 */
async function reposer(tours = 8): Promise<void> {
  for (let i = 0; i < tours; i += 1) {
    await new Promise((r) => setTimeout(r, 0))
  }
  // Un dernier tour dans `act` pour vider la file de rendu de Preact.
  act(() => undefined)
}

beforeEach(async () => {
  // Vitest ne fait pas avancer son chargeur de modules pour un import
  // dynamique lancé depuis un gestionnaire d'événement : la promesse reste
  // pendante indéfiniment. On préchauffe donc le cache. La chaîne exercée par
  // les tests reste la même — clic, création, enregistrement, ouverture — seul
  // le premier chargement du fragment est déplacé hors du chemin mesuré.
  await Promise.all(Object.values(CHARGEURS).map((chargeur) => chargeur()))

  for (const o of await listerOutils()) await supprimerOutil(o.id)
  hote = document.createElement('div')
  document.body.appendChild(hote)
  act(() => monter(<App />, hote))
  await reposer()
})

afterEach(() => {
  monter(null, hote)
  hote.remove()
})

/**
 * Le clic se fait **hors** `act`, et la vidange vient après.
 *
 * `act` de preact/test-utils empêche une chaîne asynchrone démarrée dans son
 * rappel d'aboutir : un import dynamique lancé depuis un gestionnaire de clic
 * enveloppé dans `act` ne se résout jamais, et le test échoue sans rien dire.
 */
function cliquerTexte(texte: string): void {
  const bouton = [...hote.querySelectorAll('button')].find((b) => b.textContent?.includes(texte))
  if (bouton === undefined) throw new Error(`bouton introuvable : ${texte}`)
  bouton.click()
}

function cliquer(selecteur: string): void {
  const bouton = hote.querySelector<HTMLButtonElement>(selecteur)
  if (bouton === null) throw new Error(`bouton introuvable : ${selecteur}`)
  bouton.click()
}

function saisir(selecteur: string, valeur: string): void {
  const champ = hote.querySelector<HTMLInputElement>(selecteur)
  if (champ === null) throw new Error(`champ introuvable : ${selecteur}`)
  act(() => {
    champ.value = valeur
    champ.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function demander(valeur: string): void {
  saisir('#demande', valeur)
}

describe('l’accueil', () => {
  it('propose les outils qui ont un écran', () => {
    expect(hote.textContent).toContain('Devis')
    expect(hote.textContent).toContain('Facture')
    expect(hote.textContent).toContain('Carnet de njangi')
  })

  it('dit qu’il n’y a rien plutôt que de montrer une liste vide', () => {
    expect(hote.textContent).toContain('Rien pour l’instant')
  })
})

describe('l’atelier comprend la demande, sans appeler personne', () => {
  it('propose l’outil quand la demande est claire', () => {
    demander('il me faut un devis')
    expect(hote.textContent).toContain('Ouvrir devis')
  })

  it('reconnaît le vocabulaire du terrain', () => {
    demander('noter la tontine du quartier')
    expect(hote.textContent).toContain('Ouvrir carnet de njangi')
  })

  it('montre ce qu’il a compris avant d’ouvrir', () => {
    // Le résumé n'est pas décoratif : si « 20 000 F » avait été pris pour
    // autre chose, ça se verrait ici, avant le clic et non après.
    demander('njangi de 20 000 F par mois')
    expect(hote.textContent).toContain('Ouvrir carnet de njangi')
    expect(hote.textContent).toContain('par mois')
  })

  it('demande plutôt que de parier quand deux outils répondent', () => {
    demander('je veux un devis puis une facture')
    expect(hote.textContent).toContain('Lequel veux-tu ?')
  })

  it('le dit quand c’est hors de sa portée, sans faire semblant', () => {
    demander('il me faut un contrat de bail')
    expect(hote.textContent).toContain('Je ne sais pas encore faire ça')
  })

  it('garde la grille complète sous la main', () => {
    // La demande ne cache pas les autres outils : on peut toujours parcourir.
    demander('devis')
    expect(hote.textContent).toContain('Carnet de njangi')
  })
})

describe('créer et rouvrir un outil', () => {
  it('crée l’outil, l’ouvre, et le garde sur le téléphone', async () => {
    cliquerTexte('Carnet de njangi')
    await reposer()

    expect(hote.textContent).toContain('Aucun membre pour l’instant')
    expect(await listerOutils()).toHaveLength(1)
  })

  it('revient à l’accueil, où l’outil est listé', async () => {
    cliquerTexte('Carnet de njangi')
    await reposer()
    cliquerTexte('Mes outils')
    await reposer()

    expect(hote.textContent).toContain('Carnet de njangi')
    expect(hote.querySelectorAll('.outil-rangee')).toHaveLength(1)
  })

  it('rouvre un outil déjà créé, avec son état', async () => {
    cliquerTexte('Devis')
    await reposer()
    cliquerTexte('Mes outils')
    await reposer()

    cliquer('.lien-outil')
    await reposer()
    // Le numéro est figé à la création : le retrouver prouve que c'est bien
    // l'état enregistré qui revient, et non un devis neuf.
    expect(hote.textContent).toContain('DV-2026-0001')
  })

  it('supprime un outil depuis la liste', async () => {
    cliquerTexte('Facture')
    await reposer()
    cliquerTexte('Mes outils')
    await reposer()

    cliquer('.outil-retirer')
    await reposer()
    expect(await listerOutils()).toHaveLength(0)
    expect(hote.textContent).toContain('Rien pour l’instant')
  })

  it('enregistre chaque modification et fait monter la version', async () => {
    cliquerTexte('Carnet de njangi')
    await reposer()

    // Onglet Membres, puis ajout d'un membre.
    const onglets = hote.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    act(() => onglets[1]?.click())
    saisir('[aria-label="Nom du membre"]', 'Adèle')
    cliquerTexte('Ajouter au carnet')
    await reposer()

    const [range] = await listerOutils()
    expect(range?.version).toBe(1)
    expect((range?.etat as { membres: { nom: string }[] }).membres[0]?.nom).toBe('Adèle')
  })
})
