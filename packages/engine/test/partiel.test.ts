import { describe, expect, it } from 'vitest'
import { lireJsonPartiel } from '../src/partiel.js'

/**
 * Le lecteur d'aperçu, éprouvé sur ce qui arrive vraiment.
 *
 * Le modèle écrit caractère par caractère. Les cas ci-dessous sont les états
 * successifs d'une même réponse, pris à intervalles quelconques : c'est
 * exactement ce que le flux donne, et il n'y a aucune raison qu'il coupe à un
 * endroit commode.
 *
 * La règle qui gouverne tout : **on ne devine jamais**. Une clef sans valeur
 * est abandonnée plutôt que remplie, parce qu'une valeur inventée clignoterait
 * à l'écran comme si le modèle l'avait écrite.
 */

/** Les états successifs d'une page en train de s'écrire. */
const ARRIVEE = [
  '',
  '{',
  '{"',
  '{"mot"',
  '{"mot":',
  '{"mot": "Je te fais une pa',
  '{"mot": "Je te fais une page.", ',
  '{"mot": "Je te fais une page.", "outil": {',
  '{"mot": "Je te fais une page.", "outil": {"titre": "Quincaill',
  '{"mot": "Je te fais une page.", "outil": {"titre": "Quincaillerie Bépanda", "sections": [',
  '{"mot": "Je te fais une page.", "outil": {"titre": "Quincaillerie Bépanda", "sections": [{"titre": "Nos prix", "sorte": "pr',
  '{"mot": "Je te fais une page.", "outil": {"titre": "Quincaillerie Bépanda", "sections": [{"titre": "Nos prix", "sorte": "prix"}]}}',
]

describe('une réponse qui arrive', () => {
  it('ne jette jamais, quel que soit l’endroit où elle est coupée', () => {
    const entier = ARRIVEE.at(-1) as string
    for (let i = 0; i <= entier.length; i++) {
      expect(() => lireJsonPartiel(entier.slice(0, i))).not.toThrow()
    }
  })

  it('rend une valeur dessinable dès qu’il y a quelque chose à dessiner', () => {
    expect(lireJsonPartiel(ARRIVEE[0] as string)).toBeUndefined()
    // Une accolade seule rend un objet vide, et c'est plus juste que rien :
    // le modèle a commencé, il n'a simplement encore rien dit.
    expect(lireJsonPartiel(ARRIVEE[1] as string)).toEqual({})
    expect(lireJsonPartiel(ARRIVEE[5] as string)).toEqual({ mot: 'Je te fais une pa' })
  })

  it('montre le texte s’écrire, plutôt que d’attendre le guillemet fermant', () => {
    // C'est tout l'intérêt : la phrase apparaît lettre par lettre dans la
    // conversation, comme quelqu'un qui écrit.
    expect(lireJsonPartiel('{"mot": "Je te f')).toEqual({ mot: 'Je te f' })
  })

  it('n’invente pas la valeur d’une clef commencée', () => {
    // « mot » n'a encore rien : l'inventer ferait clignoter à l'écran quelque
    // chose que le modèle n'a pas écrit.
    expect(lireJsonPartiel('{"mot":')).toEqual({})
    expect(lireJsonPartiel('{"titre": "Quincaillerie", "kick')).toEqual({ titre: 'Quincaillerie' })
  })

  it('referme les objets et les tableaux ouverts', () => {
    expect(lireJsonPartiel(ARRIVEE[9] as string)).toEqual({
      mot: 'Je te fais une page.',
      outil: { titre: 'Quincaillerie Bépanda', sections: [] },
    })
  })

  it('garde la ligne qui s’écrit dans un tableau', () => {
    expect(lireJsonPartiel(ARRIVEE[10] as string)).toEqual({
      mot: 'Je te fais une page.',
      outil: {
        titre: 'Quincaillerie Bépanda',
        sections: [{ titre: 'Nos prix', sorte: 'pr' }],
      },
    })
  })

  it('rend l’objet entier quand il est entier', () => {
    expect(lireJsonPartiel(ARRIVEE[11] as string)).toEqual({
      mot: 'Je te fais une page.',
      outil: {
        titre: 'Quincaillerie Bépanda',
        sections: [{ titre: 'Nos prix', sorte: 'prix' }],
      },
    })
  })

  it('avance à chaque caractère sans jamais reculer sur ce qui est acquis', () => {
    /*
     * Le titre, une fois écrit, ne doit plus disparaître : un aperçu qui
     * clignote se lit comme une panne. On vérifie qu'une fois qu'une clef a
     * une valeur, elle la garde jusqu'au bout.
     */
    const entier = ARRIVEE.at(-1) as string
    let vuLeTitre = false
    for (let i = 0; i <= entier.length; i++) {
      const v = lireJsonPartiel(entier.slice(0, i)) as { outil?: { titre?: string } } | undefined
      const titre = v?.outil?.titre
      if (titre === 'Quincaillerie Bépanda') vuLeTitre = true
      else if (vuLeTitre) {
        expect(titre, `le titre a disparu au caractère ${i}`).toBe('Quincaillerie Bépanda')
      }
    }
    expect(vuLeTitre).toBe(true)
  })
})

describe('ce que le modèle met parfois autour', () => {
  it('déshabille un bloc de code qui commence, sans attendre qu’il se ferme', () => {
    expect(lireJsonPartiel('```json\n{"mot": "Bonjour')).toEqual({ mot: 'Bonjour' })
  })

  it('ignore ce qui précède l’accolade', () => {
    expect(lireJsonPartiel('Voici :\n{"mot": "Bonjour"')).toEqual({ mot: 'Bonjour' })
  })

  it('rend rien du tout quand il n’y a pas d’accolade', () => {
    expect(lireJsonPartiel('Je réfléchis…')).toBeUndefined()
  })
})

describe('les valeurs qui ne sont pas du texte', () => {
  it('garde un nombre entier une fois qu’il est suivi de quelque chose', () => {
    expect(lireJsonPartiel('{"parts": 12,')).toEqual({ parts: 12 })
    expect(lireJsonPartiel('{"parts": 12}')).toEqual({ parts: 12 })
  })

  it('abandonne un nombre qu’on est peut-être en train d’écrire', () => {
    // « 12 » suivi de rien peut devenir « 125 » : le montrer serait montrer
    // un chiffre faux.
    expect(lireJsonPartiel('{"parts": 12')).toEqual({})
  })

  it('garde un booléen clos', () => {
    expect(lireJsonPartiel('{"sommaire": true,')).toEqual({ sommaire: true })
  })

  it('tient les caractères échappés', () => {
    expect(lireJsonPartiel('{"mot": "il a dit \\"oui\\" et')).toEqual({ mot: 'il a dit "oui" et' })
    expect(lireJsonPartiel('{"mot": "une barre \\\\')).toEqual({ mot: 'une barre \\' })
    // Une barre oblique qui attend encore ce qu'elle échappe est jetée : sans
    // ça, le guillemet ajouté deviendrait le caractère échappé.
    expect(lireJsonPartiel('{"mot": "une barre \\')).toEqual({ mot: 'une barre ' })
  })
})
