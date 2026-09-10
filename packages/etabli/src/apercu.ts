import { assembler } from './assembler.js'
import type { Langue } from './expliquer.js'
import type { Projet } from './projet.js'

/**
 * L'aperçu : le projet, exécuté dans un cadre qui ne peut rien atteindre.
 *
 * On exécute ici du code écrit par quelqu'un — le sien, ou celui d'un projet
 * reçu sur WhatsApp. L'isolement est ce qui rend cela acceptable, et il tient en
 * un attribut : sans `allow-same-origin`, le cadre s'exécute dans une origine
 * opaque et n'a aucun accès à la page qui le contient — ni son DOM, ni son
 * stockage, ni ses cookies, ni les comptes de l'atelier.
 *
 * Les deux ensemble, `allow-scripts` et `allow-same-origin`, se neutralisent :
 * le code du cadre peut alors retirer son propre bac à sable. C'est la faute
 * classique, et un essai la rend impossible à commettre distraitement.
 */

/** Ce que le cadre a le droit de faire : exécuter, et rien d'autre. */
export const BAC_A_SABLE = 'allow-scripts'

/**
 * Le pont : ce qui fait qu'on voit ses erreurs sur un téléphone.
 *
 * C'est la pièce la plus importante de l'Établi, et elle n'a l'air de rien. Sur
 * un ordinateur, une erreur s'ouvre dans la console du navigateur ; sur un
 * Android d'entrée de gamme il n'y a pas de console, pas de touche F12, et rien
 * du tout. Une page blanche est alors indiscernable d'une page qui charge, et
 * quelqu'un qui apprend en conclut qu'il n'y arrive pas.
 *
 * Le pont s'installe **avant** le code de la personne : une erreur à la
 * première ligne est justement celle qu'il faut voir passer.
 *
 * Il parle à la fenêtre parente avec `*` pour cible, parce qu'un cadre sans
 * origine n'en a pas d'autre à donner. Ce n'est pas une faiblesse : le message
 * ne contient que ce que le code a déjà écrit, et celui qui le reçoit vérifie
 * qu'il vient bien de son cadre à lui.
 */
const PONT = (mot: string): string => `<script id="a237-etabli">
(function () {
  var envoyer = function (sorte, args) {
    var bouts = []
    for (var i = 0; i < args.length; i += 1) {
      var v = args[i]
      try {
        bouts.push(typeof v === 'string' ? v : JSON.stringify(v))
      } catch (e) {
        // Un objet qui se contient lui-même fait jeter JSON.stringify, et une
        // console qui casse en affichant une erreur est pire que pas de console.
        bouts.push(String(v))
      }
    }
    try {
      parent.postMessage({ a237: 'etabli', sorte: sorte, texte: bouts.join(' ') }, '*')
    } catch (e) { /* la fenêtre parente est partie : on se tait */ }
  }
  var vrai = window.console || {}
  window.console = {
    log: function () { envoyer('journal', arguments) },
    info: function () { envoyer('journal', arguments) },
    warn: function () { envoyer('journal', arguments) },
    error: function () { envoyer('erreur', arguments) },
    debug: function () { envoyer('journal', arguments) },
    table: vrai.table ? vrai.table.bind(vrai) : function () {},
  }
  window.onerror = function (message, source, ligne) {
    envoyer('erreur', [ligne ? message + ' (${mot} ' + ligne + ')' : message])
    return false
  }
  window.addEventListener('unhandledrejection', function (e) {
    envoyer('erreur', [(e.reason && e.reason.message ? e.reason.message : e.reason)])
  })
})()
</script>`

/**
 * Le document tel qu'on l'exécute dans le cadre.
 *
 * C'est `assembler` plus le pont, et rien d'autre : ce qu'on regarde à l'écran
 * est ce qu'on exporte, à la console près. Deux assemblages différents
 * finiraient par diverger, et on découvrirait la différence chez quelqu'un
 * d'autre, sur son téléphone, sans pouvoir la reproduire.
 */
/*
 * Le mot « ligne », dans la langue de la personne.
 *
 * Le pont s'exécute dans le cadre et ne sait rien de l'écran qui le contient :
 * il faut donc le lui donner au moment de l'assembler. Sans ça, une console en
 * anglais annonçait « (ligne 64) » — un seul mot français au milieu, qui suffit
 * à rappeler à un anglophone que l'outil n'a pas été fait pour lui.
 */
const LIGNE: Readonly<Record<Langue, string>> = { fr: 'ligne', en: 'line' }

export function pourApercu(projet: Projet, langue: Langue = 'fr'): string {
  const doc = assembler(projet)
  return doc.replace('<head>', `<head>\n${PONT(LIGNE[langue])}`)
}

export interface MessageApercu {
  readonly sorte: 'journal' | 'erreur'
  readonly texte: string
}

/**
 * Deux mille caractères par ligne.
 *
 * Une boucle qui journalise peut écrire un million de caractères en une
 * seconde. Les garder ferait ramer l'écran de celui qui essaie justement de
 * comprendre pourquoi sa boucle s'emballe.
 */
const MAX_LIGNE = 2000

/**
 * Ce qui revient du cadre, vérifié.
 *
 * Le cadre n'a pas d'origine — c'est le prix de l'isolement — donc vérifier
 * l'origine du message ne dirait rien. Ce qui se vérifie ici est la **forme** ;
 * l'appelant vérifie de son côté que le message vient de son cadre à lui, ce
 * qui est la vraie identité.
 */
export function lireMessageDApercu(donnees: unknown): MessageApercu | null {
  if (typeof donnees !== 'object' || donnees === null) return null
  const m = donnees as { a237?: unknown; sorte?: unknown; texte?: unknown }
  if (m.a237 !== 'etabli') return null
  if (m.sorte !== 'journal' && m.sorte !== 'erreur') return null
  if (typeof m.texte !== 'string') return null
  return {
    sorte: m.sorte,
    texte: m.texte.length > MAX_LIGNE ? `${m.texte.slice(0, MAX_LIGNE)}…` : m.texte,
  }
}
