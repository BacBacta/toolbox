import type { RegistreDemande } from '@a237/engine'
import type { Fournisseur } from './fournisseur.js'
import { ErreurFournisseur, gemini, openrouter } from './fournisseur.js'
import { traiter } from './traiter.js'

/**
 * Le proxy IA (§ 3, « Appeler l'IA »).
 *
 * Il existe pour une seule raison : **aucune clef d'API dans le client, jamais**
 * (invariant § 2.8). La clef est lue ici, dans l'environnement de la fonction,
 * et ne traverse pas la frontière. Le client ne reçoit qu'une configuration
 * déjà validée — jamais de HTML, jamais de code (§ 3, point 5).
 *
 * Le brief place ce proxy dans le Worker Cloudflare, au même endroit que le
 * webhook de paiement et la page de lecture. On le met d'abord sur Vercel
 * parce que l'application y est déjà déployée ; le déménager ne déplacera que
 * ce fichier, tout le reste étant pur et testé.
 *
 * Il vit ici et non dans `api/`, et il est **assemblé en un seul fichier
 * JavaScript** avant d'y être déposé. Vercel compile lui-même le TypeScript
 * qu'il trouve dans `api/`, avec sa propre résolution de modules — qui ne suit
 * pas les liens d'un espace de travail pnpm et échouait sur `@types/node`. On
 * ne lui donne donc plus de TypeScript : le service worker est bâti de la même
 * façon, et pour la même raison.
 *
 * **Ce qui manque encore, et qu'il faut savoir.** Le brief exige un quota par
 * compte (`credits > 0`, sinon 402) et un journal des coûts dans `ai_calls`.
 * Les comptes vivent dans D1, qui n'existe pas encore. En attendant, le
 * garde-fou est grossier mais explicite : la fonction refuse de servir tant
 * qu'on ne l'a pas **ouverte à la main**. Poser la clef ne suffit donc pas à
 * ouvrir un robinet qui coûte de l'argent à chaque appel ; il faut le vouloir.
 */

interface RequeteEntrante {
  readonly method?: string
  readonly body?: unknown
}

interface ReponseSortante {
  status: (code: number) => ReponseSortante
  json: (corps: unknown) => void
}

/** Une demande plus longue qu'un paragraphe n'est pas une demande d'outil. */
const MAX_DEMANDE = 400

/** Le taux sert au journal des coûts. Une décision de gestion, pas une constante. */
const TAUX_FCFA_PAR_DOLLAR = Number(process.env.A237_TAUX_FCFA ?? '600')

/**
 * Le fournisseur et le modèle se choisissent dans l'environnement.
 *
 * Le brief pose un **budget** — moins d'un franc la génération (§ 8) — et non
 * une marque. Pouvoir changer de modèle sans redéployer, c'est pouvoir tenir
 * ce budget quand les prix bougent, et essayer mieux quand un modèle plus
 * fidèle au schéma apparaît. Une reprise double le coût : un modèle qui se
 * trompe moins peut revenir moins cher qu'un modèle moins cher.
 *
 * Le prix sert au journal quand le fournisseur ne dit pas ce qu'il a facturé.
 * OpenRouter, lui, le dit, et son chiffre l'emporte — il applique sa marge.
 */
function fournisseurChoisi(clef: string): Fournisseur {
  const modele = process.env.A237_MODELE
  const prix = {
    entree: Number(process.env.A237_PRIX_ENTREE ?? '0.1'),
    sortie: Number(process.env.A237_PRIX_SORTIE ?? '0.4'),
  }
  return process.env.A237_FOURNISSEUR === 'gemini'
    ? gemini(clef, modele ?? 'gemini-2.5-flash-lite')
    : openrouter(clef, modele ?? 'google/gemini-2.5-flash-lite', prix)
}

export default async function handler(req: RequeteEntrante, res: ReponseSortante): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ erreur: 'méthode non permise' })
    return
  }

  const clef = process.env.A237_CLEF_IA ?? ''
  const ouverte = process.env.A237_IA_OUVERTE === '1'
  if (clef === '' || !ouverte) {
    // 503 et non 500 : ce n'est pas cassé, ce n'est pas encore branché. Le
    // client le dit tel quel à l'utilisateur au lieu de tourner dans le vide.
    res.status(503).json({ erreur: 'la composition par le modèle n’est pas encore ouverte' })
    return
  }

  const corps = req.body as { demande?: unknown } | undefined
  const demande = typeof corps?.demande === 'string' ? corps.demande.trim() : ''
  if (demande === '' || demande.length > MAX_DEMANDE) {
    res.status(400).json({ erreur: 'demande absente ou trop longue' })
    return
  }

  try {
    const resultat = await traiter(demande, fournisseurChoisi(clef), TAUX_FCFA_PAR_DOLLAR)

    // Le coût part dans le journal du serveur en attendant `ai_calls` : la
    // promesse du brief est « moins d'un franc par génération », et une
    // promesse qu'on ne mesure pas est une croyance.
    console.log(
      JSON.stringify({
        evenement: 'appel_ia',
        modele: process.env.A237_MODELE ?? 'google/gemini-2.5-flash-lite',
        essais: resultat.essais,
        fcfa: resultat.cout.fcfa,
        issue: resultat.sorte,
      }),
    )

    if (resultat.sorte === 'hors-sujet') {
      /*
       * Le modèle a dit non, et c'est une réponse, pas une panne. Un 200 : la
       * requête a abouti, la réponse est négative. Renvoyer une erreur ferait
       * réessayer le client, et repayer.
       */
      res.status(200).json({ impossible: resultat.pourquoi, fcfa: resultat.cout.fcfa })
      return
    }

    if (resultat.sorte === 'calcule') {
      res.status(200).json({ calcul: resultat.calcul, fcfa: resultat.cout.fcfa })
      return
    }

    if (resultat.sorte !== 'reussi') {
      res.status(422).json({
        erreur: 'le modèle n’a pas produit un registre utilisable',
        details: resultat.erreurs.map((e) => `${e.chemin} : ${e.message}`),
        // Un échec a coûté deux tours. L'omettre ferait sous-estimer la
        // dépense réelle, et le brief demande le coût de chaque appel (§ 8).
        fcfa: resultat.cout.fcfa,
      })
      return
    }

    const registre: RegistreDemande = resultat.registre
    res.status(200).json({ registre, fcfa: resultat.cout.fcfa })
  } catch (cause) {
    // Le message d'un fournisseur peut contenir la clef en écho : on ne le
    // propage pas au client, on le garde côté serveur.
    console.error('appel_ia_echoue', cause)

    if (cause instanceof ErreurFournisseur && cause.sorte === 'credit-epuise') {
      /*
       * 402, comme le brief le prévoit (§ 3). Ce n'est pas une panne : le
       * compte est à recharger, et le dire autrement enverrait quelqu'un
       * chercher un problème qui n'existe pas.
       */
      res.status(402).json({ erreur: 'plus de crédit pour composer' })
      return
    }

    res.status(502).json({ erreur: 'le modèle n’a pas répondu' })
  }
}
