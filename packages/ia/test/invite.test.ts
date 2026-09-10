import { describe, expect, it } from 'vitest'
import { couter } from '../src/cout.js'
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
 * Le plafond se dit en francs, et non plus en caractères.
 *
 * Il valait huit mille caractères, choisis quand l'invite portait trois
 * schémas. En ajouter un quatrième — la page — l'a fait passer à neuf mille
 * sept cents, et la question s'est posée : lever le chiffre, ou renoncer à la
 * page. Aucune des deux n'était la bonne, parce que le chiffre n'était qu'un
 * intermédiaire. Ce que le brief plafonne, c'est **un franc la génération**
 * (§ 8) ; les caractères n'en étaient qu'une approximation, et une
 * approximation qu'on relève quand elle gêne ne garde plus rien.
 *
 * On mesure donc ce qui compte, au pire cas : deux tours — l'essai et sa
 * reprise — au tarif du modèle par défaut et au taux du jour. Ce garde-fou-là
 * ne se relève pas sans changer la promesse.
 *
 * Où en est-on : **0,75 F** au pire cas, pour une moyenne mesurée à 0,198 F sur
 * dix générations réelles — la plupart aboutissent au premier tour. Il reste
 * donc à peu près trois mille caractères avant le mur, et c'est trop peu pour
 * deux schémas de plus : un formulaire et un événement porteraient le pire cas
 * à 0,93 F. Le jour où on les ajoute, ce n'est pas ce plafond qu'il faut
 * lever, c'est l'invite qu'il faut router — n'envoyer que le schéma de la
 * famille demandée. Ce chiffre-là est la raison de le faire, et le moment.
 */
const FRANC_PAR_GENERATION = 1

/** Le tarif du fournisseur par défaut, en dollars par million de jetons. */
const PRIX = { entree: 0.1, sortie: 0.4 }
const TAUX_FCFA = 600

/**
 * Trois jetons et demi par caractère de français, mesuré sur les générations
 * réelles. Sous-estimer serait se rassurer : on arrondit vers le pire.
 */
const CAR_PAR_JETON = 3.5

/** Ce qu'un modèle rend au maximum : un registre de six colonnes bien décrit. */
const JETONS_SORTIE = 900

describe('l’invite tient dans son budget', () => {
  it('laisse une génération sous le franc du § 8, reprise comprise', () => {
    const invite = batirInvite('je veux suivre mes livraisons de gaz')
    // Deux tours : le premier, puis la reprise. C'est le pire cas facturé.
    const jetons = {
      entree: Math.ceil((invite.length / CAR_PAR_JETON) * 2),
      sortie: JETONS_SORTIE * 2,
    }
    const cout = couter(jetons, PRIX, TAUX_FCFA)
    expect(cout.fcfa).toBeLessThan(FRANC_PAR_GENERATION)
  })

  it('ne grossit pas avec la demande', () => {
    // La demande est la seule part variable : le reste est constant, donc
    // mis en cache par le fournisseur quand il sait le faire.
    const courte = batirInvite('a')
    const longue = batirInvite('x'.repeat(400))
    expect(longue.length - courte.length).toBeLessThan(500)
  })
})

describe('l’invite n’emporte pas ce qui ne sert qu’à l’écran', () => {
  it('ne montre au modèle ni libellés de formulaire ni règles d’affichage', () => {
    // `title` nomme un champ dans un formulaire ; `ecran` dit quand le montrer
    // et ce que disent ses boutons. Le modèle a la clef sous les yeux et n'en
    // fait rien — et chaque caractère se paie à chaque appel.
    //
    // Un seul nom réservé, et non un par réglage : un registre a une propriété
    // qui s'appelle `libelleAjout`, et un mot-clef d'éditeur du même nom
    // devenait indiscernable de ce contenu-là.
    const invite = batirInvite('un registre')
    expect(invite).not.toContain('"title"')
    expect(invite).not.toContain('"ecran"')
  })

  it('garde les descriptions, qui sont ce que le modèle lit vraiment', () => {
    // Ce sont elles qui font la différence entre une colonne « montant » et
    // une colonne « nombre ».
    expect(batirInvite('un registre')).toContain('"description"')
  })
})

describe('l’invite dit ce qu’elle doit dire', () => {
  it('offre les quatre issues', () => {
    const invite = batirInvite('un registre')
    expect(invite).toContain('registre')
    expect(invite).toContain('calculatrice')
    expect(invite).toContain('page')
    expect(invite).toContain('impossible')
  })

  it('dit qu’un site est une page, parce que c’est la demande qu’on refusait', () => {
    // Le défaut d'origine, rapporté depuis un téléphone : « je veux un site
    // internet » n'avait aucune issue sinon le refus.
    expect(batirInvite('un site')).toContain('je veux un site internet')
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
