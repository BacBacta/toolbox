import { describe, expect, it } from 'vitest'
import { MAX_CHAMPS, MAX_PARAGRAPHE, MAX_TEXTE, depouiller, verifierFormulaire } from '../src/formulaire.js'
import type { FormulaireDemande } from '../src/formulaire.js'

/**
 * Le contrat du formulaire, qui est la frontière — dans les deux sens.
 *
 * Les trois autres formes se lisent : ce que le modèle écrit sort, et rien
 * n'entre. Celle-ci **reçoit**, et c'est la seule écriture que le produit
 * accepte d'un inconnu. Ce qui revient d'un visiteur est donc relu contre cette
 * même configuration : le nom des champs, leur nombre, leur longueur, et les
 * valeurs possibles d'un choix. Personne ne fait confiance à un corps de
 * requête.
 */

const BON: FormulaireDemande = {
  titre: 'Commandes du week-end',
  kicker: 'TRAITEUR MAMA NGO',
  accroche: 'Commande avant vendredi 18 h, livraison samedi et dimanche.',
  champs: [
    { clef: 'nom', titre: 'Ton nom', sorte: 'texte', obligatoire: true },
    { clef: 'telephone', titre: 'Ton numéro', sorte: 'telephone', obligatoire: true },
    { clef: 'plat', titre: 'Quel plat ?', sorte: 'choix', options: ['Ndolè', 'Poulet DG', 'Eru'] },
    { clef: 'parts', titre: 'Combien de parts ?', sorte: 'nombre' },
    { clef: 'livraison', titre: 'À livrer ?', sorte: 'oui-non' },
    { clef: 'remarque', titre: 'Une précision', sorte: 'paragraphe', aide: 'Allergies, heure…' },
  ],
  bouton: 'Envoyer ma commande',
  merci: 'C’est noté. Je te confirme par WhatsApp dans la journée.',
}

describe('un formulaire bien composé', () => {
  it('passe', () => {
    expect(verifierFormulaire(BON)).toEqual([])
  })

  it('refuse plus de questions qu’on n’en remplit sur un téléphone', () => {
    const trop = {
      ...BON,
      champs: Array.from({ length: MAX_CHAMPS + 1 }, (_, i) => ({
        clef: `c${i}`, titre: `Question ${i}`, sorte: 'texte' as const,
      })),
    }
    expect(verifierFormulaire(trop).length).toBeGreaterThan(0)
  })
})

describe('les incohérences que le schéma ne sait pas dire', () => {
  it('refuse un choix sans options : il n’y aurait rien à choisir', () => {
    const erreurs = verifierFormulaire({
      ...BON,
      champs: [{ clef: 'plat', titre: 'Quel plat ?', sorte: 'choix' }],
    })
    expect(erreurs[0]?.message).toContain('au moins deux options')
  })

  it('refuse un choix à une seule option, qui n’est pas un choix', () => {
    const erreurs = verifierFormulaire({
      ...BON,
      champs: [{ clef: 'plat', titre: 'Quel plat ?', sorte: 'choix', options: ['Ndolè'] }],
    })
    expect(erreurs.length).toBeGreaterThan(0)
  })

  it('refuse des options sur un champ qui n’en montre pas', () => {
    const erreurs = verifierFormulaire({
      ...BON,
      champs: [{ clef: 'nom', titre: 'Ton nom', sorte: 'texte', options: ['a', 'b'] }],
    })
    expect(erreurs[0]?.message).toContain('ne s’afficheraient nulle part')
  })

  it('refuse deux clefs identiques : la seconde réponse écraserait la première', () => {
    const erreurs = verifierFormulaire({
      ...BON,
      champs: [
        { clef: 'nom', titre: 'Ton nom', sorte: 'texte' },
        { clef: 'nom', titre: 'Le nom du plat', sorte: 'texte' },
      ],
    })
    expect(erreurs[0]?.message).toContain('deux fois')
  })

  it('refuse une clef qui n’en est pas une', () => {
    const erreurs = verifierFormulaire({
      ...BON,
      champs: [{ clef: 'Nom du client', titre: 'Ton nom', sorte: 'texte' }],
    })
    expect(erreurs[0]?.chemin).toBe('$.champs[0].clef')
  })
})

describe('ce qu’un visiteur renvoie', () => {
  it('garde ce que le formulaire demandait', () => {
    const { contenu, manques } = depouiller(BON, {
      nom: ' Awa ', telephone: '699412708', plat: 'Ndolè', parts: '3', livraison: 'oui',
      remarque: 'Sans piment',
    })
    expect(manques).toEqual([])
    expect(contenu).toEqual({
      nom: 'Awa', telephone: '699412708', plat: 'Ndolè', parts: '3', livraison: 'oui',
      remarque: 'Sans piment',
    })
  })

  it('jette sans un mot ce qui n’était pas demandé', () => {
    // Un champ ajouté à la main dans les outils de développement, ou un robot
    // qui poste au hasard : ça n'entre pas en base.
    const { contenu } = depouiller(BON, { nom: 'Awa', admin: 'oui', __proto__: 'x' })
    expect(Object.keys(contenu)).toEqual(['nom'])
  })

  it('refuse un choix qui n’est pas dans la liste', () => {
    // Une valeur hors liste vient d'ailleurs que de la page : la laisser
    // passer ferait compter un choix inventé comme un vote.
    const { contenu } = depouiller(BON, { nom: 'Awa', plat: 'Caviar' })
    expect(contenu.plat).toBeUndefined()
  })

  it('coupe plutôt que de rejeter : une réponse tronquée vaut mieux que perdue', () => {
    const { contenu } = depouiller(BON, { nom: 'a'.repeat(500), remarque: 'b'.repeat(5_000) })
    expect(contenu.nom).toHaveLength(MAX_TEXTE)
    expect(contenu.remarque).toHaveLength(MAX_PARAGRAPHE)
  })

  it('nomme ce qui manque, plutôt que de dire « formulaire incomplet »', () => {
    // Huit questions à relire, c'est huit occasions d'abandonner.
    const { manques } = depouiller(BON, { plat: 'Eru' })
    expect(manques).toEqual(['Ton nom', 'Ton numéro'])
  })

  it('ne range pas un nombre qu’on n’a pas rempli', () => {
    /*
     * `Number('')` vaut zéro : un « Combien de parts ? » laissé vide se
     * rangeait comme une commande de zéro part, impossible à distinguer de
     * quelqu'un qui aurait vraiment tapé 0. Et un champ nombre obligatoire ne
     * manquait jamais, puisqu'il n'était jamais vide.
     */
    expect(depouiller(BON, { nom: 'A', telephone: '6' }).contenu.parts).toBeUndefined()
    expect(depouiller(BON, { nom: 'A', telephone: '6', parts: '0' }).contenu.parts).toBe('0')

    const obligatoire = {
      ...BON,
      champs: [{ clef: 'parts', titre: 'Combien de parts ?', sorte: 'nombre' as const, obligatoire: true }],
    }
    expect(depouiller(obligatoire, {}).manques).toEqual(['Combien de parts ?'])
  })

  it('ne réclame pas ce qui est facultatif', () => {
    const { manques, contenu } = depouiller(BON, { nom: 'Awa', telephone: '699412708' })
    expect(manques).toEqual([])
    expect(contenu.plat).toBeUndefined()
  })

  it('ramène une case cochée à « oui », quoi qu’elle porte', () => {
    expect(depouiller(BON, { nom: 'A', telephone: '6', livraison: 'on' }).contenu.livraison).toBe('oui')
    expect(depouiller(BON, { nom: 'A', telephone: '6' }).contenu.livraison).toBeUndefined()
  })

  it('accepte un nombre tapé sur un clavier d’Android', () => {
    expect(depouiller(BON, { nom: 'A', telephone: '6', parts: '2 500' }).contenu.parts).toBe('2500')
    expect(depouiller(BON, { nom: 'A', telephone: '6', parts: '1,5' }).contenu.parts).toBe('1.5')
  })

  it('jette un nombre qui n’en est pas un plutôt que de ranger « NaN »', () => {
    expect(depouiller(BON, { nom: 'A', telephone: '6', parts: 'beaucoup' }).contenu.parts)
      .toBeUndefined()
  })
})
