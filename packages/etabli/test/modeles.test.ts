import { describe, expect, it } from 'vitest'
import { MODELES } from '../src/modeles.js'
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
  it.each(MODELES.map((m) => [m.nom, m] as const))('« %s » tient le contrat', (_nom, modele) => {
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
    for (const m of MODELES) {
      expect(m.dit.length, m.nom).toBeGreaterThan(10)
      expect(m.dit.length, m.nom).toBeLessThan(60)
    }
  })

  it('porte un identifiant unique : deux modèles du même nom en cacheraient un', () => {
    expect(new Set(MODELES.map((m) => m.id)).size).toBe(MODELES.length)
  })

  /*
   * Les exemples parlent d'ici. Un tutoriel qui convertit des dollars demande à
   * quelqu'un de Douala de faire deux traductions avant d'apprendre quoi que ce
   * soit — et c'est exactement la marche qu'on essaie de retirer.
   */
  it('et le premier exemple chiffré parle en francs', () => {
    const monnaie = MODELES.find((m) => m.id === 'monnaie')
    expect(JSON.stringify(monnaie)).toContain(' F')
    expect(JSON.stringify(monnaie)).not.toMatch(/\$|€/)
  })
})
