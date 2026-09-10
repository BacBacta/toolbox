import { describe, expect, it } from 'vitest'
import { couter } from '../src/cout.js'
import { batirInviteAgent } from '../src/agent.js'

/**
 * L'invite de l'agent, et son prix.
 *
 * Une conversation fait plusieurs appels là où un bouton en faisait un. Ce qui
 * la rend abordable n'est pas un rabais : c'est que **seul le premier tour a
 * besoin de choisir**. Dès que la famille est connue, les tours suivants
 * n'emportent que son schéma — un affinage n'a aucune raison de payer la
 * description d'un formulaire quand on retouche une page.
 */

const PRIX = { entree: 0.1, sortie: 0.4 }
const TAUX_FCFA = 600
const CAR_PAR_JETON = 3.5
const JETONS_SORTIE = 900

const francs = (invite: string): number =>
  couter(
    { entree: Math.ceil(invite.length / CAR_PAR_JETON), sortie: JETONS_SORTIE },
    PRIX,
    TAUX_FCFA,
  ).fcfa

describe('le prix d’un tour', () => {
  it('tient sous le franc du § 8, au premier tour comme aux suivants', () => {
    expect(francs(batirInviteAgent())).toBeLessThan(1)
    expect(francs(batirInviteAgent('page'))).toBeLessThan(1)
  })

  it('un affinage coûte nettement moins que le premier tour', () => {
    // C'est ce qui fait qu'on peut discuter plutôt que de tout redemander.
    const premier = batirInviteAgent().length
    const suivant = batirInviteAgent('page').length
    expect(suivant).toBeLessThan(premier * 0.6)
  })

  it('et une conversation de quatre tours reste sous deux francs', () => {
    // Un outil vaut cinquante francs de recette à l'abonnement : la marge est
    // large. Ce qui compte est de savoir le chiffre, pas de le minimiser.
    const total =
      francs(batirInviteAgent()) + 3 * francs(batirInviteAgent('registre'))
    expect(total).toBeLessThan(2)
  })
})

describe('ce que l’invite dit', () => {
  /*
   * Le modèle a rendu, trois fois de suite en production, une section
   * « liste » sans lignes — les deux seuls champs obligatoires du schéma.
   * Il obéissait : la règle d'à côté lui dit de laisser vide ce qu'il ignore.
   * Elle parlait des champs ; il l'a appliquée à la section.
   */
  it('distingue un champ qu’on laisse vide d’une section qu’on n’ouvre pas', () => {
    const invite = batirInviteAgent('page')
    expect(invite).toContain('Une section porte toujours son contenu')
    expect(invite).toMatch(/n’ouvre pas une liste vide/)
  })

  /*
   * « Un menu pour mon restaurant » : trois fois sur trois, le modèle
   * annonçait « je te prépare ça tout de suite » et rendait une page à zéro
   * section. Le mot s'affiche, l'outil ne s'ouvre pas, et la personne attend.
   * Une question aurait coûté le même tour et aurait servi.
   */
  /*
   * Quatre schémas devant lui et aucun endroit où dire lequel il a pris : le
   * modèle se le disait à lui-même, en tête de l'outil. La frontière jette
   * cette étiquette ; autant ne pas la lui faire écrire.
   */
  it('dit que la forme de l’outil suffit à le nommer', () => {
    expect(batirInviteAgent()).toMatch(/sa forme le dit déjà/)
  })

  /*
   * « Un menu pour mon restaurant » : le modèle rendait « Nos entrées », « Nos
   * plats », « Nos desserts » — trois sections « prix » à zéro ligne. La règle
   * abstraite ne l'attrapait pas : il croyait connaître le contenu parce qu'il
   * connaissait les rubriques. Les modèles suivent un exemple nommé bien mieux
   * qu'un principe, et celui-ci a coûté six générations sur six.
   */
  it('nomme le plan de menu vide, parce que la règle abstraite ne l’attrapait pas', () => {
    const invite = batirInviteAgent('page')
    expect(invite).toMatch(/Des titres ne sont pas un plan à remplir/)
    expect(invite).toMatch(/Nos entrées/)
  })

  it('interdit de promettre dans le mot ce que l’outil ne porte pas', () => {
    const invite = batirInviteAgent()
    expect(invite).toContain('Un outil vide n’est pas un outil')
    expect(invite).toMatch(/ne rends que le mot/)
  })

  it('donne le droit de ne rendre qu’un mot', () => {
    // Personne ne décrit du premier coup l'outil qu'il veut, et une question
    // coûte le même tour qu'un outil inventé.
    expect(batirInviteAgent()).toContain('droit de ne rendre que le mot')
  })

  it('demande l’outil entier à chaque modification, pas une différence', () => {
    expect(batirInviteAgent('page')).toContain('renvoie l’outil\nentier')
  })

  it('met le mot avant l’outil dans l’enveloppe', () => {
    /*
     * Le modèle écrit ses clefs dans l'ordre du schéma : la phrase arrive donc
     * avant l'outil, et s'écrit dans la conversation pendant que l'outil se
     * construit à côté. L'inverse laisserait quelqu'un devant un aperçu qui
     * bouge sans un mot d'explication.
     */
    const invite = batirInviteAgent()
    expect(invite.indexOf('"mot"')).toBeLessThan(invite.indexOf('"outil"'))
  })

  it('interdit d’inventer ce qui engage ou déplace quelqu’un', () => {
    const invite = batirInviteAgent().replace(/\s+/g, ' ')
    expect(invite).toContain('N’invente jamais un numéro de téléphone, une adresse, une date ni un prix')
    expect(invite).toContain('un numéro inventé appartient à quelqu’un')
  })

  it('n’emporte que le schéma de la famille en cours', () => {
    const page = batirInviteAgent('page')
    expect(page).toContain('"sections"')
    expect(page).not.toContain('"colonnes"')
    expect(page).not.toContain('"champs"')
  })

  it('les emporte tous au premier tour, où il faut pouvoir choisir', () => {
    const premier = batirInviteAgent()
    for (const clef of ['"colonnes"', '"entrees"', '"sections"', '"champs"']) {
      expect(premier).toContain(clef)
    }
  })

  it('ne montre au modèle rien de ce qui ne sert qu’à l’écran', () => {
    const invite = batirInviteAgent()
    expect(invite).not.toContain('"title"')
    expect(invite).not.toContain('"ecran"')
  })
})
