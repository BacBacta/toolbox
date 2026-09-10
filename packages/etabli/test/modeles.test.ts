import { describe, expect, it } from 'vitest'
import { modeles } from '../src/modeles.js'
import { assembler, verifierNomDeFichier } from '../src/assembler.js'
import { MAX_FICHIERS, MAX_OCTETS_PROJET, poidsDuProjet } from '../src/projet.js'

/**
 * Un modèle cassé est pire que pas de modèle.
 *
 * C'est la toute première chose que quelqu'un ouvre. S'il ne s'exécute pas, la
 * conclusion n'est pas « ce modèle a un bogue » : c'est « je n'y arrive pas ».
 * Ces essais coûtent trois lignes et tiennent cette promesse-là.
 */
describe('chaque modèle', () => {
  it.each(modeles('fr').map((m) => [m.nom, m] as const))('« %s » tient le contrat', (_nom, modele) => {
    const projet = { id: modele.id, nom: modele.nom, fichiers: modele.fichiers, maj: 0 }

    // Des noms que l'éditeur accepterait si on les tapait à la main.
    const vus: string[] = []
    for (const f of modele.fichiers) {
      expect(verifierNomDeFichier(f.nom, vus), f.nom).toBe(null)
      vus.push(f.nom)
    }

    expect(modele.fichiers.length).toBeLessThanOrEqual(MAX_FICHIERS)
    expect(poidsDuProjet(projet)).toBeLessThan(MAX_OCTETS_PROJET)

    // Il produit une page, et cette page montre quelque chose.
    const doc = assembler(projet)
    expect(doc).toContain('<body>')
    expect(doc.length).toBeGreaterThan(100)
  })

  it('dit en une ligne ce qu’on y apprend', () => {
    for (const m of modeles('fr')) {
      expect(m.dit.length, m.nom).toBeGreaterThan(10)
      expect(m.dit.length, m.nom).toBeLessThan(60)
    }
  })

  it('porte un identifiant unique : deux modèles du même nom en cacheraient un', () => {
    expect(new Set(modeles('fr').map((m) => m.id)).size).toBe(modeles('fr').length)
  })

  /*
   * Les exemples parlent d'ici. Un tutoriel qui convertit des dollars demande à
   * quelqu'un de Douala de faire deux traductions avant d'apprendre quoi que ce
   * soit — et c'est exactement la marche qu'on essaie de retirer.
   */
  it('et le premier exemple chiffré parle en francs', () => {
    const monnaie = modeles('fr').find((m) => m.id === 'monnaie')
    expect(JSON.stringify(monnaie)).toContain(' F')
    expect(JSON.stringify(monnaie)).not.toMatch(/\$|€/)
  })
})

/**
 * Les modèles existent dans les deux langues, code compris.
 *
 * Traduire le nom seulement aurait laissé un anglophone devant
 * `const bouton = document.getElementById("bouton")`. Le tout premier code
 * qu'on lit est celui qui apprend à nommer les choses ; le donner dans une
 * langue qu'on ne lit pas, c'est apprendre à recopier sans comprendre.
 */
describe('les modèles dans les deux langues', () => {
  it('portent les mêmes identifiants : on ne perd pas son projet en changeant de langue', () => {
    expect(modeles('fr').map((m) => m.id)).toEqual(modeles('en').map((m) => m.id))
  })

  it('et chacun tient le même contrat que son jumeau français', () => {
    for (const m of modeles('en')) {
      const projet = { id: m.id, nom: m.nom, fichiers: m.fichiers, maj: 0 }
      const vus: string[] = []
      for (const f of m.fichiers) {
        expect(verifierNomDeFichier(f.nom, vus, 'en'), f.nom).toBe(null)
        vus.push(f.nom)
      }
      expect(poidsDuProjet(projet)).toBeLessThan(MAX_OCTETS_PROJET)
      expect(assembler(projet)).toContain('<body>')
    }
  })

  /*
   * Le code anglais ne doit pas garder des noms français : c'est exactement ce
   * qu'on essaie d'éviter.
   */
  it('le code anglais est en anglais, pas seulement son titre', () => {
    const m = modeles('en').find((mod) => mod.id === 'bouton')
    /*
     * On regarde ce qui se lit, pas les clefs.
     *
     * `id` reste « bouton » dans les deux langues — délibérément : c'est
     * l'identité du modèle, et la changer ferait qu'ouvrir l'Établi en anglais
     * ne retrouverait plus le projet créé en français. Les noms de champs sont
     * du code, pas de la traduction.
     */
    const lu = [m?.nom, m?.dit, ...(m?.fichiers ?? []).map((f) => f.contenu)].join(' ')
    for (const francais of ['bouton', 'appuyé', 'fois', 'numéro', 'Appuie']) {
      expect(lu, francais).not.toContain(francais)
    }
  })

  /*
   * La monnaie du pays ne change pas avec la langue : le Nord-Ouest paie en
   * francs comme le reste.
   */
  it('mais les prix restent en francs dans les deux', () => {
    expect(JSON.stringify(modeles('en').find((m) => m.id === 'monnaie'))).toContain(' F')
  })
})
