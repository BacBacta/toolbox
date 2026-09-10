import { facture, squeletteParId } from '@a237/engine'
import { describe, expect, it } from 'vitest'
import { controler } from '../src/publier.js'
import type { Depot } from '../src/publier.js'

/**
 * Le contrôle d'un dépôt, éprouvé sans KV.
 *
 * Le serveur ne fait pas confiance à ce qu'il reçoit — pas parce que le client
 * serait malveillant, mais parce qu'un client peut être une version plus
 * ancienne, une file d'attente qui rejoue, ou n'importe qui avec `curl`.
 */

const LIEN = 'K7M2XQ4BN9PZ'

/*
 * L'état est celui du squelette, pas un objet réduit à son numéro.
 *
 * Le serveur refuse désormais ce qu'il ne saura pas dessiner, et un `{ numero }`
 * seul n'est l'état valide d'aucun document : le prendre pour dépôt d'essai
 * aurait fait passer tous ces contrôles pour des refus de contenu.
 */
function depot(modif: Partial<Depot['instantane']> = {}, lien = LIEN): Depot {
  const skeleton = typeof modif.skeleton === 'string' ? modif.skeleton : 'facture'
  const parDefaut = squeletteParId(skeleton)?.defaults ?? facture.defaults
  return {
    lien,
    instantane: {
      skeleton: 'facture',
      nom: 'Facture',
      etat: parDefaut,
      version: 1,
      publieLe: '2026-09-09T07:45:00.000Z',
      ...modif,
    },
  }
}

/** Un registre composé : sa configuration voyage avec lui. */
const COMPOSE = {
  etat: { nom: 'Ponte des poules', lignes: [{ jour: 'Lundi', pondus: 12 }] },
  registre: {
    titre: 'Ponte des poules',
    titreNom: 'Jour',
    kicker: 'REGISTRE',
    colonnes: [
      { clef: 'jour', titre: 'Jour', type: 'texte' as const },
      { clef: 'pondus', titre: 'Pondus', type: 'nombre' as const },
    ],
    libelleVide: 'Aucun jour noté.',
    libelleAjout: 'Ajouter un jour',
    relancesVides: 'Un registre de ponte ne se relance pas.',
  },
}

/** Et une calculatrice composée : sa formule est un arbre, pas du code. */
const CALCUL = {
  etat: { nom: 'Marge du sac', valeurs: { achat: 25_000, vente: 18_000 } },
  calcul: {
    titre: 'Marge du sac',
    titreNom: 'Marge',
    kicker: 'CALCUL',
    entrees: [
      { clef: 'achat', titre: 'Prix d’achat', unite: 'F' as const, defaut: 0 },
      { clef: 'vente', titre: 'Prix de vente', unite: 'F' as const, defaut: 0 },
    ],
    sortie: {
      libelle: 'Marge',
      unite: 'F' as const,
      formule: { op: 'moins' as const, gauche: { ref: 'vente' }, droite: { ref: 'achat' } },
    },
  },
}

describe('ce que le serveur refuse', () => {
  it('un lien mal formé, avant de toucher au stockage', () => {
    expect(controler(depot({}, 'trop-court'), null)?.statut).toBe(400)
    expect(controler(depot({}, '../../../etc'), null)?.corps.erreur).toBe('lien-invalide')
    expect(controler(depot({}, ''), null)?.statut).toBe(400)
  })

  it('un instantané dont le squelette n’est pas une chaîne', () => {
    // Ce qui arrive par `curl` n'a pas de forme garantie : un squelette absent,
    // un nombre, un objet. Tous se rangent sous « squelette inconnu » plutôt
    // que de jeter.
    for (const skeleton of [undefined, 42, null, {}, []]) {
      const verdict = controler({ lien: LIEN, instantane: { ...depot().instantane, skeleton } }, null)
      expect(verdict?.corps.erreur, String(skeleton)).toBe('squelette-inconnu')
    }
  })

  it('un corps qui n’est pas un dépôt', () => {
    expect(controler(undefined, null)?.statut).toBe(400)
    expect(controler({ lien: LIEN }, null)?.corps.erreur).toBe('instantane-absent')
    expect(controler({ lien: LIEN, instantane: 'texte' }, null)?.statut).toBe(400)
  })

  it('un squelette que ce serveur ne connaît pas', () => {
    // Un lien publié par une version plus récente de l'application ne doit pas
    // être accepté à l'aveugle : la page de lecture ne saurait pas le dessiner.
    expect(controler(depot({ skeleton: 'bail' }), null)?.corps.erreur).toBe('squelette-inconnu')
  })

  it('l’ardoise et le call-box, et il dit pourquoi', () => {
    // Le refus n'est pas technique. Un bouton grisé se contourne ; une adresse
    // publique ne se reprend pas.
    const ardoise = controler(depot({ skeleton: 'ardoise' }), null)
    expect(ardoise?.statut).toBe(403)
    expect(ardoise?.corps.erreur).toBe('non-publiable')
    expect(String(ardoise?.corps.pourquoi)).toContain('noms et des dettes')
    expect(controler(depot({ skeleton: 'callbox' }), null)?.statut).toBe(403)
  })

  it('une version périmée, en disant celle qu’il détient', () => {
    // Sans `versionServeur`, un téléphone dont la file rejoue une vieille
    // publication perd son travail en silence.
    const v = controler(depot({ version: 3 }), { version: 7 })
    expect(v?.statut).toBe(409)
    expect(v?.corps.erreur).toBe('version-perimee')
    expect(v?.corps.versionServeur).toBe(7)
  })

  it('un rejeu de la même version', () => {
    expect(controler(depot({ version: 4 }), { version: 4 })?.statut).toBe(409)
  })

  it('une version qui n’en est pas une', () => {
    for (const version of [-1, 1.5, Number.NaN]) {
      expect(controler(depot({ version }), null)?.statut).toBe(409)
    }
  })

  it('mais pas la version zéro, qui est celle d’un outil qu’on vient de créer', () => {
    // Elle était refusée, et la publication d'un outil jamais modifié échouait
    // donc en silence — le cas le plus courant, puisqu'on diffuse souvent
    // juste après avoir créé.
    expect(controler(depot({ version: 0 }), null)).toBeNull()
  })
})

describe('ce que le serveur accepte', () => {
  it('un premier dépôt', () => {
    expect(controler(depot(), null)).toBeNull()
  })

  it('une version strictement supérieure', () => {
    expect(controler(depot({ version: 8 }), { version: 7 })).toBeNull()
  })

  it('les registres composés par le modèle, qui n’ont pas de squelette', () => {
    // `compose` n'est le nom d'aucun squelette, et c'est voulu : le registre
    // composé vit sur le téléphone comme les autres et se publie pareil. Sa
    // configuration voyage avec lui — c'est elle qui dit comment le dessiner,
    // et sans elle il n'y a rien à dessiner du tout.
    expect(controler(depot({ skeleton: 'compose', etat: COMPOSE.etat, registre: COMPOSE.registre }), null)).toBeNull()
    expect(controler(depot({ skeleton: 'compose-calcul', etat: CALCUL.etat, calcul: CALCUL.calcul }), null)).toBeNull()
  })

  it('mais pas un composé dont la configuration manque', () => {
    // Sans elle, la page de lecture répondait 200 avec « Ce lien ne mène à
    // rien » : l'outil payé était le seul qu'on ne pouvait pas partager.
    expect(controler(depot({ skeleton: 'compose' }), null)?.corps.erreur).toBe('instantane-illisible')
  })

  it('tous les documents et registres du catalogue, sauf les deux exclus', async () => {
    const { SQUELETTES, NON_PUBLIABLES } = await import('@a237/engine')
    for (const s of SQUELETTES) {
      const verdict = controler(depot({ skeleton: s.id, etat: s.defaults }), null)
      if (NON_PUBLIABLES.includes(s.id)) expect(verdict?.statut).toBe(403)
      else expect(verdict).toBeNull()
    }
  })
})

describe('le dépôt qu’on ne saura pas relire', () => {
  /*
   * Le refus appartient à la publication, pas à la lecture. L'envoyeur est là
   * quand il publie : on peut le lui dire. Le destinataire, lui, découvre le
   * problème seul, devant un lien qu'on lui a donné — et l'envoyeur ne sait
   * même pas qu'il y en a un, puisque sa publication avait répondu 200.
   */
  it('refuse un état que le document ne sait pas lire', () => {
    // Il manque les lignes : `calculerLignes` les parcourt, et jetait.
    const verdict = controler(depot({ etat: { numero: 'FA-2026-0001' } }), null)
    expect(verdict?.statut).toBe(400)
    expect(verdict?.corps.erreur).toBe('instantane-illisible')
  })

  it('refuse un état qui n’est pas un objet', () => {
    for (const etat of [null, 'texte', 42, []]) {
      expect(controler(depot({ etat }), null)?.corps.erreur).toBe('instantane-illisible')
    }
  })

  it('laisse passer celui qui se dessine', () => {
    expect(controler(depot(), null)).toBeNull()
  })
})
