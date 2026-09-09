import { devis, njangi, prix } from '@a237/engine'
import type { Instantane, RenderContext } from '@a237/engine'
import { describe, expect, it } from 'vitest'
import { metaDe, pageDeLecture, pageIntrouvable, rendable } from '../src/html.js'

const CTX: RenderContext = {
  lien: 'atelier237.pages.dev/d/K7M2XQ4BN9PZ',
  maintenant: new Date('2026-09-09T07:45:00.000Z'),
}
const LIEN = 'https://atelier237.pages.dev/d/K7M2XQ4BN9PZ'

function instantane(skeleton: string, etat: unknown, nom = 'Essai'): Instantane {
  return { skeleton, nom, etat, version: 1, publieLe: '2026-09-09T07:45:00.000Z' }
}

const DEVIS = instantane('devis', {
  ...devis.defaults,
  numero: 'DV-2026-0118',
  emisLe: '2026-09-09T07:45:00.000Z',
  emetteur: { ...devis.defaults.emetteur, nom: 'Quincaillerie Bépanda', niu: 'M022114873829Y' },
  client: { ...devis.defaults.client, nom: 'Ets Mbarga & Fils' },
  lignes: [{ designation: 'Tôles bac 30/100', quantite: 24, prixUnitaire: 12_500 }],
}, 'Devis')

describe('la page de lecture', () => {
  const page = pageDeLecture(DEVIS, CTX, LIEN)

  it('ne porte aucun script — c’est ce qui la rend fiable', () => {
    // Elle s'ouvre sur un téléphone d'entrée de gamme, sur une connexion qui
    // hoquette, dans le navigateur intégré de WhatsApp, et elle s'imprime.
    expect(page).not.toContain('<script')
    expect(page).not.toContain('onclick')
    expect(page).not.toContain('javascript:')
  })

  it('ne charge rien de l’extérieur : le CSS est dedans', () => {
    // Une feuille séparée serait une requête de plus sur une connexion qui
    // hoquette, pour trois kilo-octets.
    expect(page).toContain('<style>')
    expect(page).not.toContain('<link rel="stylesheet"')
    expect(page).not.toMatch(/src="https?:/)
  })

  it('rend le vrai document, pas un résumé', () => {
    // C'est tout l'intérêt du lien : ouvrir un devis plutôt que recevoir une
    // image qu'on ne peut ni chercher ni copier.
    expect(page).toContain('Quincaillerie Bépanda')
    expect(page).toContain('Ets Mbarga &amp; Fils')
    expect(page).toContain('DV-2026-0118')
    expect(page).toContain('a4-cadre')
  })

  it('porte ce que WhatsApp lit pour son aperçu', () => {
    expect(page).toContain('property="og:title"')
    expect(page).toContain('property="og:description"')
    expect(page).toContain(`property="og:url" content="${LIEN}"`)
    expect(page).toContain('og:site_name" content="Atelier 237"')
  })

  it('demande à ne pas être indexée', () => {
    // Un devis nommant un client n'a rien à faire dans un moteur de recherche.
    expect(page).toContain('name="robots" content="noindex"')
  })

  it('dit quand le document a été arrêté', () => {
    expect(page).toContain('9 septembre 2026')
    expect(page).toContain('lecture seule')
  })

  it('échappe ce qui part dans une métadonnée', () => {
    // Le titre de la carte d'un devis est le nom du client : c'est lui qui
    // part dans `og:title`, donc c'est là qu'il faut tenter le passage.
    const piege = instantane('devis', {
      ...devis.defaults,
      client: { ...devis.defaults.client, nom: '"><script>alert(1)</script>' },
    })
    const html = pageDeLecture(piege, CTX, LIEN)
    expect(html).not.toContain('"><script>')
    expect(html).toContain('&quot;&gt;&lt;script&gt;')
  })
})

describe('un registre, qui n’est pas un document', () => {
  const carnet = instantane('njangi', njangi.defaults, 'Njangi Nkolbisson')
  const page = pageDeLecture(carnet, CTX, LIEN)

  it('rend sa carte plutôt que de rejouer un écran à boutons', () => {
    expect(page).toContain('lecture-carte')
    expect(page).not.toContain('<button')
    expect(page).not.toContain('a4-cadre')
  })

  it('porte le titre et le grand chiffre de la carte', () => {
    expect(page).toContain('Njangi')
    expect(page).toContain('lecture-carte')
  })

  it('marche aussi pour une liste de prix', () => {
    expect(pageDeLecture(instantane('prix', prix.defaults), CTX, LIEN)).toContain('lecture-carte')
  })
})

describe('quand le lien ne mène à rien', () => {
  it('dit la seule chose utile', () => {
    // Un 404 nu laisse croire à une panne.
    const page = pageIntrouvable()
    expect(page).toContain('Ce lien ne mène à rien')
    expect(page).toContain('recopié de travers')
    expect(page).not.toContain('<script')
  })
})

describe('les métadonnées', () => {
  it('tirent leur titre de la carte du squelette, pas du nom de l’outil', () => {
    // Le nom de l'outil est celui que son propriétaire a choisi pour lui-même ;
    // la carte, elle, est écrite pour être lue par quelqu'un d'autre.
    const meta = metaDe(DEVIS, CTX, LIEN)
    expect(meta.titre).toBe('Ets Mbarga & Fils')
    expect(meta.lien).toBe(LIEN)
  })

  it('retombent sur le nom de l’outil quand le squelette est inconnu', () => {
    const meta = metaDe(instantane('bail', {}, 'Contrat'), CTX, LIEN)
    expect(meta.titre).toBe('Contrat')
  })
})

describe('un instantané que le rendu ne sait pas dessiner', () => {
  /*
   * `/api/publier` est une adresse publique : le client n'est pas la seule
   * chose qui écrit dedans. Un état auquel il manque ce que le document lit —
   * ici les lignes d'un devis — faisait jeter le rendu, et le destinataire du
   * lien recevait la page d'erreur de Cloudflare. L'envoyeur, lui, n'en savait
   * rien : sa publication avait répondu 200.
   */
  const ABIME = instantane('devis', { numero: 'DV-2026-0118' }, 'Devis')

  it('se dit irrecevable au lieu de laisser jeter', () => {
    expect(rendable(ABIME)).toBe(false)
    expect(rendable(DEVIS)).toBe(true)
  })

  it('donne une page lisible plutôt qu’une exception', () => {
    // Ce qui est déjà déposé le reste : un rendu qui change de forme ne doit
    // pas transformer un lien envoyé hier en page d'erreur du serveur.
    const page = pageDeLecture(ABIME, CTX, LIEN)
    expect(page).toContain('<!doctype html>')
    expect(page).toContain('ne peut pas être affiché')
    expect(page).not.toContain('<script')
  })
})

describe('un outil composé par le modèle', () => {
  /*
   * C'est l'outil payé (§ 4, étage 2), et c'était le seul qu'on ne pouvait pas
   * lire : sa configuration voyage avec lui et non dans un squelette, donc le
   * serveur ne trouvait rien à dessiner. Il répondait 200 avec « Ce lien ne
   * mène à rien » — la personne à qui on l'avait envoyé allait vérifier une
   * adresse qui était juste, et l'envoyeur ne savait pas qu'il y avait un
   * problème, puisque sa publication avait répondu 200.
   */
  const REGISTRE = {
    ...instantane('compose', { nom: 'Ponte des poules', lignes: [{ jour: 'Lundi', pondus: 12, vendus: 8 }] }, 'Ponte des poules'),
    registre: {
      titre: 'Ponte des poules',
      titreNom: 'Jour',
      kicker: 'REGISTRE',
      colonnes: [
        { clef: 'jour', titre: 'Jour', type: 'texte' as const },
        { clef: 'pondus', titre: 'Pondus', type: 'nombre' as const },
        { clef: 'vendus', titre: 'Vendus', type: 'nombre' as const },
      ],
      libelleVide: 'Aucun jour noté.',
      libelleAjout: 'Ajouter un jour',
      relancesVides: 'Un registre de ponte ne se relance pas.',
    },
  }

  it('se lit, au lieu de dire que le lien ne mène à rien', () => {
    const page = pageDeLecture(REGISTRE, CTX, LIEN)
    expect(page).toContain('Ponte des poules')
    expect(page).not.toContain('ne mène à rien')
    expect(page).not.toContain('ne peut pas être affiché')
  })

  it('et le serveur le juge recevable', () => {
    expect(rendable(REGISTRE)).toBe(true)
  })

  const CALCUL = {
    ...instantane('compose-calcul', { nom: 'Marge du sac', valeurs: { achat: 25000, vente: 18000 } }, 'Marge'),
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

  it('la calculatrice composée aussi', () => {
    const page = pageDeLecture(CALCUL, CTX, LIEN)
    expect(page).toContain('Marge')
    expect(page).not.toContain('ne mène à rien')
    expect(rendable(CALCUL)).toBe(true)
  })
})
