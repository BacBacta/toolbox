import { SQUELETTES, devis, publiable } from '@a237/engine'
import type { Instantane, RenderContext } from '@a237/engine'
import { describe, expect, it } from 'vitest'
import { nomFichier, pageAImprimer } from '../src/pdf.js'

const CTX: RenderContext = {
  lien: 'atelier237.pages.dev/d/K7M2XQ4BN9PZ',
  maintenant: new Date('2026-09-09T07:45:00.000Z'),
}

function instantane(skeleton: string, etat: unknown): Instantane {
  return { skeleton, nom: 'Essai', etat, version: 1, publieLe: '2026-09-09T07:45:00.000Z' }
}

const DEVIS = instantane('devis', {
  ...devis.defaults,
  numero: 'DV-2026-0118',
  lignes: [{ designation: 'Tôles bac 30/100', quantite: 24, prixUnitaire: 12_500 }],
})

describe('la page qui part à l’imprimante', () => {
  const page = pageAImprimer(DEVIS, CTX)

  it('porte la feuille, et pas l’écran autour', () => {
    /*
     * La page de lecture met la feuille à l'échelle, l'entoure d'un pied et
     * d'une marque, et dit « document en lecture seule ». Rien de tout cela
     * n'a sa place sur un papier qu'on remet à un client.
     */
    if (page === null) throw new Error('impossible')
    expect(page.html).toContain('Tôles bac 30/100')
    expect(page.html).not.toContain('Document en lecture seule')
    expect(page.html).not.toContain('class="lecture-pied"')
    /*
     * `--echelle` appartient à la feuille A4 elle-même, et vaut 1 : c'est
     * `lecture.css` qui la recalcule selon la largeur de l'écran. Ce qu'on
     * vérifie est donc l'absence de **ce calcul-là**, pas du mot.
     */
    expect(page.html).not.toContain('min(1, calc(')
    expect(page.html).not.toContain('lecture-carte')
  })

  it('dit à l’imprimante la taille de la feuille', () => {
    // Sans `@page`, le moteur prend le format par défaut de sa locale — A4 ici,
    // Letter ailleurs — et une feuille de 210 × 297 mm se retrouve recadrée.
    if (page === null) throw new Error('impossible')
    expect(page.html).toContain('@page { size: 210mm 297mm; margin: 0; }')
  })

  it('sans un script, comme la page de lecture', () => {
    if (page === null) throw new Error('impossible')
    expect(page.html).not.toContain('<script')
    expect(page.html).not.toMatch(/\son[a-z]+=/)
  })

  it('nomme sa police au lieu de la deviner', () => {
    /*
     * `system-ui` sur le serveur est ce que l'image du jour contient. Le jour
     * où elle change, tous les devis changent d'allure sans que personne ait
     * rien demandé — sur un papier qu'on remet à un client, et qui est parfois
     * une pièce comptable.
     */
    if (page === null) throw new Error('impossible')
    expect(page.html).toContain('"DejaVu Sans"')
    expect(page.html.split('.a4 { font-family')[1]).not.toContain('system-ui')
  })

  it('et sans les commentaires de la feuille de style', () => {
    if (page === null) throw new Error('impossible')
    expect(page.html).not.toContain('/*')
  })
})

describe('ce qui ne s’imprime pas', () => {
  it('un registre : son lien mène à une carte, pas à une feuille', () => {
    // Un PDF d'un résumé d'écran serait un papier qui ne sert à rien : ni
    // preuve, ni pièce comptable, ni chose qu'on classe.
    expect(pageAImprimer(instantane('njangi', { nom: 'Njangi', membres: [], versements: [] }), CTX)).toBeNull()
  })

  it('et les sept écrits A4 s’impriment tous', () => {
    const imprimables = SQUELETTES.filter((s) => publiable(s.id))
      .filter((s) => pageAImprimer(instantane(s.id, s.defaults), CTX) !== null)
      .map((s) => s.id)
    expect(imprimables.sort()).toEqual(
      ['attestation', 'cv', 'dette', 'devis', 'facture', 'motivation', 'recu'].sort(),
    )
  })
})

describe('le nom du fichier', () => {
  it('porte le numéro, qui est ce qu’on cherche dans un dossier', () => {
    expect(nomFichier(DEVIS)).toBe('devis-DV-2026-0118.pdf')
  })

  it('et se rabat sur le squelette quand il n’y a pas de numéro', () => {
    expect(nomFichier(instantane('cv', { nom: 'Mon CV' }))).toBe('cv.pdf')
  })

  it('et se rabat sur « document » quand il ne reste rien', () => {
    // Un numéro fait de ponctuation seule ne laisse rien après nettoyage :
    // « .pdf » n'est pas un nom de fichier.
    expect(nomFichier(instantane('«»', { numero: '«»' }))).toBe('document.pdf')
  })

  it('sans jamais porter un caractère qui casse un nom de fichier', () => {
    // Un numéro vient de l'utilisateur : il peut contenir une barre oblique,
    // et une barre oblique dans un nom de fichier n'est pas un nom de fichier.
    for (const numero of ['../../etc/passwd', '..', '/', '  ', '«"»']) {
      const nom = nomFichier(instantane('facture', { numero }))
      expect(nom, numero).not.toMatch(/[/\\]/)
      expect(nom, numero).not.toContain('..')
      expect(nom, numero).toMatch(/^[A-Za-z0-9][A-Za-z0-9._-]*\.pdf$/)
    }
  })
})
