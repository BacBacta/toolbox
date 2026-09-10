/**
 * Les liens `wa.me`.
 *
 * C'est tout ce que le produit emploie de WhatsApp, et c'est délibéré
 * (BRIEF.md § 5) : l'API Groups plafonne à huit participants et exige un
 * compte officiel, l'Embedded Signup n'est pas ouvert au Cameroun, et une
 * relance envoyée par une plateforme n'a de toute façon aucune autorité dans un
 * njangi. `wa.me` est gratuit, sans compte, sans validation de gabarit — et le
 * message part du pouce du propriétaire (invariant § 2.4).
 */

/** Indicatif du Cameroun. */
export const INDICATIF_CM = '237'

/**
 * Met un numéro au format international attendu par `wa.me`.
 *
 * Accepte ce qu'un utilisateur tape vraiment : espaces, tirets, points, `+`,
 * `00`, avec ou sans indicatif. Rend `null` si rien d'exploitable n'en sort —
 * mieux vaut proposer de copier le message que d'ouvrir WhatsApp sur un
 * mauvais numéro.
 */
export function numeroInternational(brut: string): string | null {
  let chiffres = brut.replace(/[^\d+]/g, '')
  if (chiffres.startsWith('+')) chiffres = chiffres.slice(1)
  else if (chiffres.startsWith('00')) chiffres = chiffres.slice(2)
  chiffres = chiffres.replace(/\D/g, '')

  if (chiffres === '') return null
  // Un numéro camerounais fait neuf chiffres et commence par 6 (mobile) ou 2.
  if (/^[62]\d{8}$/.test(chiffres)) return INDICATIF_CM + chiffres
  // Déjà international : on ne réécrit pas ce qu'on ne comprend pas.
  if (chiffres.length >= 10 && chiffres.length <= 15) return chiffres
  return null
}

/** Le lien qui ouvre WhatsApp avec le message déjà écrit. */
export function lienWhatsApp(tel: string, message: string): string | null {
  const numero = numeroInternational(tel)
  if (numero === null) return null
  return `https://wa.me/${numero}?text=${encodeURIComponent(message)}`
}

/**
 * Le numéro tel qu'on l'écrit sur une enseigne.
 *
 * Le modèle rend « 699412708 » aussi souvent que « +237 6 99 41 27 08 », selon
 * ce que la demande contenait, et la page affichait ce qu'elle recevait : une
 * vitrine sur deux montrait neuf chiffres collés sous son bouton. Le numéro
 * qu'un client recopie à la main sur un cahier doit se lire par groupes.
 *
 * Neuf chiffres, un seul puis quatre paires : c'est la façon dont un numéro
 * camerounais se dicte au téléphone. Un numéro d'ailleurs n'est pas regroupé —
 * on ne sait pas comment son pays le coupe, et le couper au hasard le rendrait
 * plus difficile à lire, pas moins. Ce qui n'est pas un numéro du tout revient
 * tel quel : c'est ce que quelqu'un a écrit, et le remplacer par du vide
 * effacerait la seule chose qu'il savait.
 */
export function numeroLisible(brut: string): string {
  const numero = numeroInternational(brut)
  if (numero === null) return brut

  if (numero.startsWith(INDICATIF_CM) && numero.length === INDICATIF_CM.length + 9) {
    const local = numero.slice(INDICATIF_CM.length)
    const paires = (local.slice(1).match(/\d{2}/g) ?? []).join(' ')
    return `+${INDICATIF_CM} ${local.charAt(0)} ${paires}`
  }
  return `+${numero}`
}

/**
 * Ce numéro était-il dans la demande ?
 *
 * Mesuré en production, deux fois, sur deux invites différentes : le modèle
 * remplit le champ « téléphone » d'une page même quand la demande n'en donne
 * aucun. Il a d'abord recopié l'exemple du schéma, puis — l'exemple retiré — il
 * en a inventé un : « 699 12 34 56 », qui est un numéro camerounais valide, et
 * qui appartient donc à quelqu'un. La page serait publiée sous le nom d'un
 * commerçant, et ses clients appelleraient un inconnu. Personne ne relit dix
 * chiffres avant de partager un lien.
 *
 * Une interdiction dans l'invite n'a pas suffi, et ne pouvait pas suffire : un
 * champ vide appelle une valeur plus fort qu'une phrase ne l'en dissuade. Ce
 * qui suffit est une vérification, et elle est possible parce que la demande
 * est là — c'est le seul endroit d'où un vrai numéro peut venir.
 *
 * On compare les neuf chiffres du local, indicatif retiré de part et d'autre :
 * quelqu'un écrit son numéro comme il veut — « 699 41 27 08 », « +237 6.99.41 »
 * — et ces espaces-là ne doivent rien décider.
 */
export function numeroDansLaDemande(numero: string, demande: string): boolean {
  const chiffresDemande = demande.replace(/\D/g, '')
  const chiffres = numero.replace(/\D/g, '')
  if (chiffres.length < 8) return false
  const local = chiffres.length > 9 ? chiffres.slice(-9) : chiffres
  return chiffresDemande.includes(local)
}
