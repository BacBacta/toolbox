import type { BaseD1 } from '@a237/comptes'
import { combienDeReponses, empreinteSource, rangerReponse, tropTot } from '@a237/comptes'
import type { Instantane, RenderContext } from '@a237/engine'
import { MAX_REPONSES, depouiller, lienValide } from '@a237/engine'
import { CHAMP_PIEGE } from '@a237/render/page'
import { pageDeLecture, pageDeMerci, pageIntrouvable } from './html.js'
import { formulaireDe } from './rendu.js'

/**
 * `GET /d/:lien` — la page de lecture. `POST /d/:lien` — une réponse à un
 * formulaire.
 *
 * Un seul aller-retour, mis en cache au bord (§ 1, point 7 de la lecture du
 * brief). Ce que le client reçoit est fini quand il le reçoit : pas de script,
 * rien à charger ensuite — et le `POST` d'un formulaire n'en demande pas
 * davantage, parce que le navigateur sait poster un `<form>` tout seul.
 */

interface Liaisons {
  readonly INSTANTANES: KVNamespace
  readonly CARTES: R2Bucket
  readonly COMPTES: BaseD1
}

interface KVNamespace {
  get(clef: string, type: 'json'): Promise<unknown>
}

interface R2Bucket {
  head(clef: string): Promise<unknown>
}

interface Contexte {
  readonly request: Request
  readonly params: Readonly<Record<string, string | string[]>>
  readonly env: Liaisons
}

/**
 * `form-action` : `'none'` partout, `'self'` sur un formulaire.
 *
 * La politique interdisait tout envoi de formulaire — ce qui était juste tant
 * qu'aucune page n'en portait, et devient exactement le mur qui empêche la
 * réponse de partir. On ne l'ouvre donc que sur les pages qui reçoivent, et
 * seulement vers leur propre origine : une page de devis qui poste ailleurs
 * n'a aucune raison d'exister.
 */
function politique(recoit: boolean): string {
  return (
    "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; " +
    `form-action ${recoit ? "'self'" : "'none'"}; frame-ancestors 'none'`
  )
}

function html(statut: number, corps: string, cache: string, recoit = false): Response {
  return new Response(corps, {
    status: statut,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': cache,
      // La page ne charge rien d'elle-même, la politique peut donc être aussi
      // stricte que celle de l'application. `img-src` reste ouvert au domaine
      // des cartes, qui arrivera avec R2.
      'content-security-policy': politique(recoit),
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
    },
  })
}

/** Un corps de formulaire plus gros que ça vient d'ailleurs que d'un pouce. */
const CORPS_MAX = 16 * 1024

export async function onRequest(contexte: Contexte): Promise<Response> {
  const brut = contexte.params.lien
  const lien = Array.isArray(brut) ? (brut[0] ?? '') : (brut ?? '')
  // Un lien mal formé ne touche pas KV : on refuse sur la forme.
  if (!lienValide(lien)) return html(404, pageIntrouvable(), 'no-store')

  const instantane = (await contexte.env.INSTANTANES.get(lien, 'json')) as Instantane | null
  if (instantane === null) return html(404, pageIntrouvable(), 'no-store')

  if (contexte.request.method === 'POST') {
    return repondreAuFormulaire(contexte, lien, instantane)
  }

  /*
   * La page de remerciement, servie après la redirection du `POST`.
   *
   * Elle vit sur le même chemin avec un paramètre plutôt que sur une adresse à
   * elle : le lien qu'on a en main est celui-ci, et revenir en arrière depuis
   * une adresse voisine ramène sur un formulaire qu'on a déjà rempli.
   */
  if (new URL(contexte.request.url).searchParams.has('merci')) {
    const formulaire = formulaireDe(instantane)
    if (formulaire !== null) return html(200, pageDeMerci(instantane, lien), 'no-store')
  }

  /*
   * L'origine vient de la requête et non d'un `https://` écrit en dur.
   * L'adresse absolue sert à `og:image` et `og:url`, que WhatsApp suit tels
   * quels : bâtie sur un schéma supposé, elle est fausse partout où le schéma
   * diffère — à commencer par un serveur local, où l'on éprouve justement la
   * chaîne complète.
   */
  const origine = new URL(contexte.request.url).origin
  const ctx: RenderContext = {
    lien: `${new URL(contexte.request.url).host}/d/${lien}`,
    maintenant: new Date(),
  }

  /*
   * On demande si la carte existe plutôt que de supposer qu'elle est là.
   *
   * Une `og:image` annoncée qui rend 404 fait un aperçu cassé — pire qu'un
   * aperçu sobre, parce qu'il donne l'air d'un lien douteux. Un `head` ne
   * transfère pas l'image : il coûte une consultation de métadonnées.
   */
  const carte = (await contexte.env.CARTES.head(lien)) === null
    ? undefined
    : `${origine}/c/${lien}.png`

  /*
   * Soixante secondes au bord, et non une heure.
   *
   * Une publication se corrige : on republie une facture parce qu'on s'est
   * trompé d'un chiffre, et le client rouvre le lien qu'il a déjà. Une minute
   * absorbe le partage d'un lien dans un groupe de cent personnes sans figer
   * une erreur pour l'après-midi.
   */
  const recoit = formulaireDe(instantane) !== null
  /*
   * Un formulaire ne se met pas en cache.
   *
   * La page dit combien il reste de place et si le formulaire est clos : une
   * version d'il y a une minute invite à remplir ce qui vient de fermer, et la
   * réponse part pour rien.
   */
  const ferme = recoit && (await combienDeReponses(contexte.env.COMPTES, lien)) >= MAX_REPONSES
  return html(
    200,
    pageDeLecture(instantane, ctx, `${origine}/d/${lien}`, carte, { ferme }),
    recoit ? 'no-store' : 'public, max-age=60',
    recoit,
  )
}

/**
 * Une réponse à un formulaire publié.
 *
 * C'est la seule écriture que le produit accepte d'un inconnu, et trois choses
 * tiennent la porte ouverte sans la laisser fracturer : le piège à robots qui
 * vit dans la page, un délai entre deux envois du même endroit, et un plafond
 * par formulaire. Aucune ne demande quoi que ce soit au visiteur — ni image à
 * déchiffrer, ni case à cocher qui charge trois cents kilo-octets de script.
 *
 * Ce qui est renvoyé est **revalidé contre la configuration publiée** : le nom
 * des champs, leur nombre, leur longueur et les valeurs possibles d'un choix.
 * Personne ne fait confiance à un corps de requête.
 */
async function repondreAuFormulaire(
  contexte: Contexte,
  lien: string,
  instantane: Instantane,
): Promise<Response> {
  const formulaire = formulaireDe(instantane)
  // Poster sur un devis n'est pas une erreur du visiteur : c'est quelqu'un qui
  // essaie. On ne lui explique rien.
  if (formulaire === null) return html(404, pageIntrouvable(), 'no-store')

  const db = contexte.env.COMPTES
  const maintenant = new Date()
  const url = new URL(contexte.request.url)
  const versLaPage = (etat: { readonly manques?: readonly string[]; readonly ferme?: boolean }) => {
    const ctx: RenderContext = { lien: `${url.host}/d/${lien}`, maintenant }
    return html(200, pageDeLecture(instantane, ctx, `${url.origin}/d/${lien}`, undefined, etat), 'no-store', true)
  }

  const brut = await contexte.request.text()
  if (brut.length > CORPS_MAX) return versLaPage({})

  const champs = new URLSearchParams(brut)

  /*
   * Le piège, d'abord et sans rien dire.
   *
   * Un robot qui remplit tout ce qu'il trouve remplit aussi le champ caché. On
   * répond alors comme si tout s'était bien passé — un refus lui apprendrait
   * quoi corriger.
   */
  if ((champs.get(CHAMP_PIEGE) ?? '') !== '') {
    return Response.redirect(`${url.origin}/d/${lien}?merci=1`, 303)
  }

  const recu: Record<string, string> = {}
  for (const [clef, valeur] of champs.entries()) recu[clef] = valeur
  const { contenu, manques } = depouiller(formulaire, recu)

  /*
   * Ce qui manque se dit **sur la page**, avec ce qui a déjà été tapé perdu :
   * c'est le prix d'un formulaire sans script, et il est plus honnête qu'une
   * validation qui laisse partir une réponse vide. Le navigateur refuse déjà
   * d'envoyer un champ `required` vide ; ce contrôle-ci est pour ce qui n'est
   * pas passé par la page.
   */
  if (manques.length > 0) return versLaPage({ manques })

  // Une réponse entièrement vide n'est pas une réponse.
  if (Object.keys(contenu).length === 0) return versLaPage({})

  if ((await combienDeReponses(db, lien)) >= MAX_REPONSES) return versLaPage({ ferme: true })

  const source = await empreinteSource(lien, contexte.request.headers.get('cf-connecting-ip'))
  if (source !== null && (await tropTot(db, lien, source, maintenant))) {
    // Deux envois coup sur coup depuis le même endroit : le premier est passé,
    // et on ne dit pas au second qu'il a été écarté. Il l'a déjà envoyé.
    return Response.redirect(`${url.origin}/d/${lien}?merci=1`, 303)
  }

  await rangerReponse(db, { lien, contenu, source }, maintenant)

  /*
   * Une redirection, et non la page de remerciement rendue ici.
   *
   * Rafraîchir après un `POST` renvoie la même réponse une deuxième fois, et
   * personne ne le sait avant de compter les commandes. Le `303` remet le
   * navigateur sur un `GET`, qu'on peut rafraîchir tant qu'on veut.
   */
  return Response.redirect(`${url.origin}/d/${lien}?merci=1`, 303)
}
