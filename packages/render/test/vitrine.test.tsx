import type { PageDemande } from '@a237/engine'
import { render as enChaine } from 'preact-render-to-string'
import { describe, expect, it } from 'vitest'
import { PageVitrine } from '../src/page/vitrine.js'

/**
 * La vitrine, qui est ce qu'un client voit.
 *
 * Le même composant sert l'aperçu dans l'application et la page publiée : deux
 * dessins pour une même configuration finiraient par ne plus montrer la même
 * chose, et c'est celui que le client voit qui aurait tort. C'est donc ici
 * qu'on éprouve les deux à la fois.
 */

const PAGE: PageDemande = {
  titre: 'Quincaillerie Bépanda',
  kicker: 'QUINCAILLERIE',
  accroche: 'Tôles, ciment et outillage, à Bépanda depuis 2012.',
  sections: [
    {
      titre: 'Ce que je vends',
      sorte: 'liste',
      lignes: [{ nom: 'Tôles bac 30/100', detail: 'toutes longueurs' }, { nom: 'Ciment' }],
    },
    {
      titre: 'Quelques prix',
      sorte: 'prix',
      lignes: [{ nom: 'Sac de ciment 50 kg', valeur: '5 800 F' }],
    },
    {
      titre: 'La livraison',
      sorte: 'texte',
      texte: 'Nous livrons sur tout Douala.\n\nÀ partir de dix sacs, c’est offert.',
    },
  ],
  telephone: '699412708',
  adresse: 'Rue Bépanda-Omnisport',
  horaires: 'Lundi à samedi, 7 h – 19 h',
}

const html = (page: PageDemande): string => enChaine(<PageVitrine page={page} />)

describe('ce que la page montre', () => {
  it('le nom, le sur-titre et l’accroche', () => {
    const h = html(PAGE)
    expect(h).toContain('Quincaillerie Bépanda')
    expect(h).toContain('QUINCAILLERIE')
    expect(h).toContain('depuis 2012')
  })

  it('coupe le texte sur les sauts de ligne, et rien d’autre', () => {
    // Pas de balisage : le modèle n'écrit que des chaînes, et il n'y a donc
    // rien à interpréter — l'invariant § 2.1 tient par la forme du contrat.
    const h = html(PAGE)
    expect((h.match(/Nous livrons/g) ?? []).length).toBe(1)
    expect(h).toContain('<p>Nous livrons sur tout Douala.</p>')
    expect(h).toContain('<p>À partir de dix sacs, c’est offert.</p>')
  })

  it('met le prix à droite, et la précision sous le nom', () => {
    const h = html(PAGE)
    expect(h).toContain('<span class="combien">5 800 F</span>')
    expect(h).toContain('<span class="detail">toutes longueurs</span>')
  })

  it('ne rend aucun montant vide : une ligne sans prix n’a pas de colonne', () => {
    expect(html(PAGE)).not.toContain('<span class="combien"></span>')
  })
})

describe('le bouton qui rapporte', () => {
  it('ouvre WhatsApp avec le message déjà écrit', () => {
    const h = html(PAGE)
    expect(h).toContain('wa.me/237699412708')
    expect(h).toContain('Bonjour%20Quincaillerie')
  })

  it('disparaît quand il n’y a pas de numéro — on n’en invente pas', () => {
    const { telephone, ...sans } = PAGE
    void telephone
    expect(html(sans)).not.toContain('wa.me')
  })

  it('disparaît aussi sur un numéro vide, que l’éditeur laisse passer', () => {
    // Le formulaire rend une chaîne vide quand on efface le champ : c'est le
    // cas courant, pas l'exception.
    expect(html({ ...PAGE, telephone: '' })).not.toContain('wa.me')
  })

  it('disparaît sur un numéro que personne ne saurait composer', () => {
    expect(html({ ...PAGE, telephone: 'au comptoir' })).not.toContain('wa.me')
  })
})

describe('le pied', () => {
  it('ne s’affiche pas du tout quand il n’aurait rien à dire', () => {
    // Un filet horizontal au-dessus de rien se lit comme une page coupée.
    const nue: PageDemande = {
      titre: 'Atelier Awa', kicker: 'COUTURE', accroche: 'Boubous et retouches.',
      sections: [{ titre: 'Ce que je fais', sorte: 'texte', texte: 'Sur rendez-vous.' }],
    }
    expect(html(nue)).not.toContain('vitrine-pied')
  })

  it('s’affiche pour la seule adresse, sans numéro', () => {
    const { telephone, horaires, ...sans } = PAGE
    void telephone
    void horaires
    const h = html(sans)
    expect(h).toContain('vitrine-pied')
    expect(h).toContain('Rue Bépanda-Omnisport')
  })
})

describe('le sommaire, qui est tout ce qu’un « site » ajoute', () => {
  it('reste absent quand on a demandé une page', () => {
    expect(html(PAGE)).not.toContain('vitrine-sommaire')
  })

  it('saute dans la page, sans recharger et sans script', () => {
    const h = html({ ...PAGE, sommaire: true })
    expect(h).toContain('href="#ce-que-je-vends"')
    expect(h).toContain('id="ce-que-je-vends"')
    expect(h).not.toContain('<script')
  })

  it('ne pose d’identifiant sur rien quand il n’y a pas de menu pour y sauter', () => {
    // Une ancre sans lien est du poids sans usage, et elle occupe un
    // identifiant qui pourrait entrer en conflit ailleurs dans la page.
    expect(html(PAGE)).not.toContain('id="ce-que-je-vends"')
  })
})

/**
 * Ce composant ne doit jamais jeter, quoi qu'on lui donne.
 *
 * `verifierPage` refuse déjà une section sans contenu, et l'écran comme la
 * publication passent par lui. Mais ce qui est **déjà** dans KV a pu être
 * déposé par une version plus ancienne du contrôle, et un rendu qui jette
 * transforme un lien envoyé hier en page d'erreur chez le destinataire — qui
 * n'a rien demandé et n'a personne à qui le dire.
 */
describe('une page à trous, telle qu’un vieux dépôt peut en porter', () => {
  it('rend une liste vide plutôt que de tomber', () => {
    const h = html({ ...PAGE, sections: [{ titre: 'Nos prix', sorte: 'prix' }] })
    expect(h).toContain('Nos prix')
    expect(h).toContain('vitrine-prix')
  })

  it('rend une section de texte sans texte comme un titre seul', () => {
    const h = html({ ...PAGE, sections: [{ titre: 'La livraison', sorte: 'texte' }] })
    expect(h).toContain('La livraison')
  })

  it('ne rend aucun paragraphe pour du texte qui n’est que des blancs', () => {
    const h = html({ ...PAGE, sections: [{ titre: 'Vide', sorte: 'texte', texte: '\n  \n' }] })
    expect(h).not.toContain('<p>')
  })
})

describe('ce que la page ne peut pas contenir', () => {
  it('échappe ce qu’on essaie d’y glisser, parce que rien n’est du balisage', () => {
    /*
     * Ce qui compte est le chevron ouvrant : échappé, aucune balise ne se
     * forme, et « onerror » n'est plus qu'un mot dans une phrase. Chercher
     * l'absence du mot serait chercher la mauvaise chose — le contrat n'a
     * aucun champ qui accepte du balisage, et c'est par là que l'invariant
     * § 2.1 tient, pas par un filtre de mots.
     */
    const h = html({
      ...PAGE,
      titre: '<script>alert(1)</script>',
      sections: [{ titre: 'Essai', sorte: 'texte', texte: '<img onerror="x">' }],
    })
    expect(h).not.toContain('<script>')
    expect(h).not.toContain('<img')
    expect(h).toContain('&lt;script>alert(1)&lt;/script>')
    expect(h).toContain('&lt;img onerror=&quot;x&quot;>')
  })
})
