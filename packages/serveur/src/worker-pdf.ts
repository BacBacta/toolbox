import type { Instantane, RenderContext } from '@a237/engine'
import { lienValide } from '@a237/engine'
import { pageAImprimer } from './pdf.js'

/**
 * `GET /p/:lien` — le devis, en PDF.
 *
 * Le rendu se fait **une fois, sur le serveur**, et c'est tout l'intérêt : le
 * fichier porte ses glyphes, et la machine qui l'ouvre n'a plus rien à
 * décider. C'est ce que demande le § 7 — « un même devis produit un PDF
 * identique sur Windows, macOS et Android ». Un `window.print()` sur le
 * téléphone du client donnerait autant de PDF différents que de navigateurs.
 *
 * Le brief prévoyait un service Playwright sur un petit VPS. Cloudflare rend le
 * même service par une liaison, sans second hébergeur à tenir, à jour et à
 * surveiller — et sans paquet à installer : `quickAction` ne demande ni
 * `puppeteer` ni jeton d'API.
 */

interface Navigateur {
  quickAction(action: 'pdf', options: Record<string, unknown>): Promise<ArrayBuffer | Response>
}

interface KVNamespace {
  get(clef: string, type: 'json'): Promise<unknown>
}

interface Contexte {
  readonly request: Request
  readonly params: Readonly<Record<string, string | string[]>>
  readonly env: {
    readonly INSTANTANES: KVNamespace
    readonly NAVIGATEUR?: Navigateur
  }
}

function texte(statut: number, message: string): Response {
  return new Response(message, {
    status: statut,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  })
}

export async function onRequest(contexte: Contexte): Promise<Response> {
  const brut = contexte.params.lien
  const lien = Array.isArray(brut) ? (brut[0] ?? '') : (brut ?? '')
  if (!lienValide(lien)) return texte(404, 'Ce lien ne mène à rien.')

  const instantane = (await contexte.env.INSTANTANES.get(lien, 'json')) as Instantane | null
  if (instantane === null) return texte(404, 'Ce lien ne mène à rien.')

  const ctx: RenderContext = {
    lien: `${new URL(contexte.request.url).host}/d/${lien}`,
    maintenant: new Date(),
  }

  const page = pageAImprimer(instantane, ctx)
  if (page === null) {
    /*
     * Un registre n'a pas de feuille : son lien mène à une carte, qui est un
     * résumé d'écran. On le dit plutôt que de rendre un papier qui ne servirait
     * à rien.
     */
    return texte(415, 'Cet outil n’a pas de version imprimable : ouvre son lien pour le voir.')
  }

  const navigateur = contexte.env.NAVIGATEUR
  if (navigateur === undefined) {
    // La liaison peut manquer — configuration incomplète, ou déploiement de
    // prévisualisation. 503 : ce n'est pas cassé, ce n'est pas branché.
    return texte(503, 'L’impression n’est pas encore ouverte.')
  }

  let rendu: ArrayBuffer | Response
  try {
    rendu = await navigateur.quickAction('pdf', {
      html: page.html,
      /*
       * `preferCSSPageSize` fait autorité à la feuille et non au format
       * demandé : c'est `@page { size: 210mm 297mm }` qui décide, et les
       * marges sont déjà dans le document. Sans lui, un format imposé ici et
       * une taille déclarée là se disputeraient la page.
       */
      pdfOptions: { printBackground: true, preferCSSPageSize: true },
    })
  } catch (cause) {
    console.error('pdf_echoue', cause)
    return texte(502, 'L’impression n’a pas abouti. Réessaie dans un instant.')
  }

  const corps = rendu instanceof Response ? await rendu.arrayBuffer() : rendu

  /*
   * On regarde ce qu'on a reçu avant de l'appeler un PDF.
   *
   * `quickAction` ne rend pas toujours un PDF : sous limitation de débit —
   * sept demandes d'affilée suffisent — il rend une poignée d'octets qui n'en
   * sont pas un. Les renvoyer étiquetés `application/pdf` fait télécharger un
   * fichier cassé, en silence, à quelqu'un qui voulait imprimer son devis.
   *
   * Cinq octets suffisent à trancher : un PDF commence par `%PDF-`, toujours.
   *
   * La cause la plus fréquente n'est pas une panne mais le débit : le plan
   * gratuit admet **une impression toutes les dix secondes pour tout le
   * compte**. `quickAction` avale le 429 et rend une poignée d'octets à la
   * place, sans lever d'exception — c'est donc ici, et nulle part ailleurs,
   * que ça se voit. Le message le dit dans ces termes : réessayer marche.
   */
  const debut = new Uint8Array(corps.slice(0, 5))
  if (String.fromCharCode(...debut) !== '%PDF-') {
    console.error(
      JSON.stringify({
        evenement: 'pdf_pas_un_pdf',
        octets: corps.byteLength,
        debut: new TextDecoder().decode(corps.slice(0, 200)),
      }),
    )
    return texte(503, 'L’impression est occupée. Réessaie dans quelques secondes.')
  }

  return new Response(corps, {
    headers: {
      'content-type': 'application/pdf',
      // `inline` : le téléphone l'ouvre au lieu de le déposer dans les
      // téléchargements sans rien montrer. Le nom sert quand on l'enregistre.
      'content-disposition': `inline; filename="${page.nomFichier}"`,
      /*
       * Une minute, comme la page de lecture, et pour la même raison : on
       * republie une facture parce qu'on s'est trompé d'un chiffre, et le
       * client rouvre le lien qu'il a déjà.
       */
      'cache-control': 'public, max-age=60',
      'x-content-type-options': 'nosniff',
    },
  })
}
