/**
 * La feuille de style, allégée de ce qui ne sert qu'à la relire.
 *
 * Le CSS est inliné dans la page publiée — une feuille séparée serait une
 * requête de plus sur une connexion qui hoquette. Inlinée telle quelle, elle
 * emportait aussi ses commentaires : **vingt-neuf pour cent de la page**, six
 * kilo-octets qui expliquent au prochain lecteur du code pourquoi la feuille
 * A4 fait ses millimètres. Le destinataire d'un devis, lui, les télécharge
 * sans jamais les lire. Six mille octets de moins font deux mille trois cents
 * octets de moins une fois comprimés, sur la seule page que le produit envoie
 * à des gens qui ne l'ont pas demandée.
 *
 * Un lecteur caractère par caractère et non une expression régulière : `/*`
 * dans une chaîne CSS — `content: "/*"` — est du texte, et une expression
 * régulière qui ne compte pas les guillemets couperait la règle en deux. Le
 * cas ne se présente pas aujourd'hui dans ces deux feuilles ; c'est justement
 * pour qu'il puisse se présenter demain sans casser la page.
 */
export function sansCommentaires(css: string): string {
  let sortie = ''
  let i = 0
  /** Le guillemet ouvrant en cours, ou '' hors chaîne. */
  let chaine = ''

  while (i < css.length) {
    const c = css[i] ?? ''

    if (chaine !== '') {
      sortie += c
      // Une barre oblique inverse échappe le caractère suivant, guillemet
      // fermant compris : on l'emporte avec elle.
      if (c === '\\' && i + 1 < css.length) {
        sortie += css[i + 1]
        i += 2
        continue
      }
      if (c === chaine) chaine = ''
      i += 1
      continue
    }

    if (c === '"' || c === "'") {
      chaine = c
      sortie += c
      i += 1
      continue
    }

    if (c === '/' && css[i + 1] === '*') {
      const fin = css.indexOf('*/', i + 2)
      // Un commentaire jamais fermé : le reste du fichier en fait partie, et
      // c'est aussi ce que le navigateur en ferait.
      if (fin === -1) break
      i = fin + 2
      // Le commentaire tenait une ligne à lui seul : on emporte le saut de
      // ligne qui suit, sinon il reste une ligne vide par commentaire.
      if (css[i] === '\n' && /(^|\n)[ \t]*$/.test(sortie)) i += 1
      continue
    }

    sortie += c
    i += 1
  }

  return sortie
}
