import { describe, expect, it } from 'vitest'
import { batirInvite, batirReproches } from '../src/invite.js'

/**
 * L'invite est ce qu'on paie à chaque appel, et le brief plafonne la
 * génération à un franc (§ 8). Sa taille est donc un budget, pas un détail.
 *
 * Elle a déjà dérapé : un schéma de formule récursif, déplié faute de `$ref`,
 * embarquait soixante-quatre copies de sa feuille — quarante mille caractères,
 * dix mille jetons, et le coût d'une génération multiplié par six. Rien
 * n'échouait ; seule la facture le disait.
 */

/**
 * Huit mille caractères, soit environ deux mille jetons. L'invite en fait
 * aujourd'hui six mille six cents, ce qui cadre avec les ~1 500 jetons que le
 * brief prévoit pour l'étage 2 (§ 4).
 *
 * Le plafond laisse de la marge sans cesser de mordre : la version dépliée en
 * faisait quarante-quatre mille, soit cinq fois trop.
 */
const PLAFOND = 8_000

describe('l’invite tient dans son budget', () => {
  it('reste sous le plafond', () => {
    const invite = batirInvite('je veux suivre mes livraisons de gaz')
    expect(invite.length).toBeLessThan(PLAFOND)
  })

  it('ne grossit pas avec la demande', () => {
    // La demande est la seule part variable : le reste est constant, donc
    // mis en cache par le fournisseur quand il sait le faire.
    const courte = batirInvite('a')
    const longue = batirInvite('x'.repeat(400))
    expect(longue.length - courte.length).toBeLessThan(500)
  })
})

describe('l’invite dit ce qu’elle doit dire', () => {
  it('offre les trois issues', () => {
    const invite = batirInvite('un registre')
    expect(invite).toContain('registre')
    expect(invite).toContain('calculatrice')
    expect(invite).toContain('impossible')
  })

  it('décrit la formule sans la déplier', () => {
    const invite = batirInvite('un calcul')
    expect(invite).toContain('op')
    expect(invite).toContain('pourcent')
    // Dépliée, la feuille apparaissait soixante-quatre fois.
    expect((invite.match(/"nombre"/g) ?? []).length).toBeLessThan(6)
  })
})

describe('le reproche porte, sinon la reprise est perdue', () => {
  it('nomme le chemin et la correction', () => {
    const r = batirReproches([{ chemin: '$.total.clef', message: '« prix » ne désigne aucune colonne' }])
    expect(r).toContain('$.total.clef')
    expect(r).toContain('ne désigne aucune colonne')
  })
})
