import { describe, expect, it } from 'vitest'
import { lienWhatsApp, numeroInternational, numeroLisible } from '../src/whatsapp.js'

describe('numeroInternational — ce qu’un utilisateur tape vraiment', () => {
  it.each([
    ['699112233', '237699112233'],
    ['6 99 11 22 33', '237699112233'],
    ['6-99-11-22-33', '237699112233'],
    ['+237 699 112 233', '237699112233'],
    ['00237699112233', '237699112233'],
    ['237699112233', '237699112233'],
    ['222 11 22 33', '237222112233'],
  ])('« %s » → %s', (brut, attendu) => {
    expect(numeroInternational(brut)).toBe(attendu)
  })

  it('laisse passer un numéro étranger sans le réécrire', () => {
    expect(numeroInternational('+33 6 12 34 56 78')).toBe('33612345678')
  })

  it('refuse ce qui n’est pas exploitable, plutôt que d’ouvrir sur un mauvais numéro', () => {
    expect(numeroInternational('')).toBeNull()
    expect(numeroInternational('à demander')).toBeNull()
    expect(numeroInternational('12345')).toBeNull()
    expect(numeroInternational('9'.repeat(20))).toBeNull()
  })
})

describe('lienWhatsApp', () => {
  it('encode le message dans l’URL', () => {
    const lien = lienWhatsApp('699112233', 'Bonjour Adèle, ta part de 5 000 F ?')
    expect(lien).toContain('https://wa.me/237699112233?text=')
    expect(lien).toContain('Bonjour%20Ad%C3%A8le')
    expect(lien).not.toContain(' ')
  })

  it('rend null quand le numéro ne tient pas debout', () => {
    expect(lienWhatsApp('à demander', 'coucou')).toBeNull()
  })

  it('survit à un message qui contient des caractères d’URL', () => {
    const lien = lienWhatsApp('699112233', 'Le détail : atl.cm/n/ZBV3?t=36&x=1')
    expect(lien).toContain('%3Ft%3D36%26x%3D1')
  })
})

describe('le numéro tel qu’on l’écrit sur une enseigne', () => {
  /*
   * Le modèle rend « 699412708 » aussi souvent que « +237 6 99 41 27 08 »,
   * selon ce que la demande contenait, et la vitrine affichait ce qu'elle
   * recevait : neuf chiffres collés sous le bouton. Un numéro qu'un client
   * recopie à la main sur un cahier doit se lire par groupes.
   */
  it.each([
    ['699412708', '+237 6 99 41 27 08'],
    ['+237 699 41 27 08', '+237 6 99 41 27 08'],
    ['00237-6.99.41.27.08', '+237 6 99 41 27 08'],
    ['237699412708', '+237 6 99 41 27 08'],
    ['233 41 27 08', '+237 2 33 41 27 08'],
  ])('%s se lit « %s »', (brut, attendu) => {
    expect(numeroLisible(brut)).toBe(attendu)
  })

  it('ne regroupe pas un numéro d’ailleurs : on ignore comment son pays le coupe', () => {
    expect(numeroLisible('+33 6 12 34 56 78')).toBe('+33612345678')
  })

  it('rend tel quel ce qui n’est pas un numéro', () => {
    // C'est ce que quelqu'un a écrit. Le remplacer par du vide effacerait la
    // seule chose qu'il savait.
    expect(numeroLisible('au comptoir')).toBe('au comptoir')
    expect(numeroLisible('')).toBe('')
  })
})
