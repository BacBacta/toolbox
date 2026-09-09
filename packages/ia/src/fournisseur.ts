/**
 * L'interface d'un fournisseur de modèle, et rien d'autre.
 *
 * Le brief met le paiement derrière une interface pour pouvoir changer de rail
 * sans réécrire (§ 3.2, CamPay ou Fapshi). La même raison vaut ici, et plus
 * fort : le choix par défaut est Gemini 2.5 Flash-Lite parce qu'il tient le
 * budget d'**une génération à moins d'un franc** (§ 8), et ce budget est la
 * contrainte, pas la marque. Le jour où un modèle moins cher ou plus fidèle au
 * schéma apparaît, seul ce fichier bouge.
 *
 * Aucune clef ne vit ici. Elle est lue par la fonction serveur dans son
 * environnement, et ne traverse jamais la frontière du client (§ 2.8).
 */

export interface DemandeModele {
  readonly invite: string
  /** Le tour de reprise, s'il y en a un : ce que le modèle a dit, et pourquoi c'était faux. */
  readonly reprise?: { readonly sortie: string; readonly reproches: string }
}

export interface ReponseModele {
  /** Le texte brut. Personne ne lui fait confiance avant validation. */
  readonly texte: string
  readonly jetonsEntree: number
  readonly jetonsSortie: number
  /**
   * Ce que l'appel a réellement coûté, en dollars, quand le fournisseur le
   * dit. Un routeur applique sa propre marge : son chiffre vaut mieux que
   * notre estimation, et c'est lui qu'on journalise quand il existe.
   */
  readonly dollars?: number
}

export interface Fournisseur {
  readonly nom: string
  /** Prix par million de jetons, en dollars. Sert au journal des coûts. */
  readonly prix: { readonly entree: number; readonly sortie: number }
  readonly appeler: (demande: DemandeModele) => Promise<ReponseModele>
}

/**
 * Gemini 2.5 Flash-Lite, le choix par défaut du brief.
 *
 * `responseMimeType: application/json` fait produire du JSON par construction
 * plutôt que par prière. Ça ne dispense pas de valider — un JSON bien formé
 * peut décrire n'importe quoi — mais ça supprime la classe d'échec la plus
 * bête : la réponse enveloppée dans un bloc de code et des politesses.
 */
export function gemini(clef: string, modele = 'gemini-2.5-flash-lite'): Fournisseur {
  return {
    nom: modele,
    // Relevés septembre 2026 (BRIEF.md § 5). Ne pas redériver sans source.
    prix: { entree: 0.1, sortie: 0.4 },
    async appeler(demande) {
      const tours = [{ role: 'user', parts: [{ text: demande.invite }] }]
      if (demande.reprise !== undefined) {
        tours.push({ role: 'model', parts: [{ text: demande.reprise.sortie }] })
        tours.push({ role: 'user', parts: [{ text: demande.reprise.reproches }] })
      }

      const reponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': clef },
          body: JSON.stringify({
            contents: tours,
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0,
              maxOutputTokens: 2048,
            },
          }),
        },
      )

      if (!reponse.ok) {
        // Le corps peut contenir la clef en écho : on ne le propage pas.
        throw new Error(`le modèle a répondu ${reponse.status}`)
      }

      const corps = (await reponse.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[]
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
      }

      return {
        texte: corps.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
        jetonsEntree: corps.usageMetadata?.promptTokenCount ?? 0,
        jetonsSortie: corps.usageMetadata?.candidatesTokenCount ?? 0,
      }
    },
  }
}

/**
 * OpenRouter : un routeur, pas un modèle.
 *
 * Il parle la forme d'API d'OpenAI et mène à des centaines de modèles, dont
 * celui du brief. L'intérêt ici n'est pas la variété — c'est qu'il permet de
 * changer de modèle **sans redéployer**, par une variable d'environnement.
 * Le brief pose un budget (moins d'un franc la génération, § 8) et non une
 * marque ; pouvoir en essayer un autre le lendemain vaut mieux que d'avoir
 * bien deviné le premier jour.
 *
 * Deux prudences.
 *
 * `response_format` n'est pas compris par tous les modèles du routeur. On le
 * demande — il réduit les reprises, et une reprise double le coût — mais si la
 * requête est refusée, on recommence **une fois sans lui** : l'invite exige
 * déjà du JSON nu et `lireJson` sait déshabiller un bloc de code. Ainsi
 * n'importe quel modèle reste utilisable, et le choix redevient une décision
 * de gestion plutôt qu'une contrainte technique.
 *
 * Et le coût vient du routeur quand il le donne (`usage.cost`), parce qu'il
 * applique sa marge et que notre table de prix ne la connaît pas.
 */
export function openrouter(
  clef: string,
  modele = 'google/gemini-2.5-flash-lite',
  prix = { entree: 0.1, sortie: 0.4 },
): Fournisseur {
  return {
    nom: modele,
    prix,
    async appeler(demande) {
      const messages: { role: string; content: string }[] = [
        { role: 'user', content: demande.invite },
      ]
      if (demande.reprise !== undefined) {
        messages.push({ role: 'assistant', content: demande.reprise.sortie })
        messages.push({ role: 'user', content: demande.reprise.reproches })
      }

      const base = {
        model: modele,
        messages,
        temperature: 0,
        max_tokens: 2048,
        usage: { include: true },
      }

      let reponse = await envoyer(clef, { ...base, response_format: { type: 'json_object' } })
      if (reponse.status >= 400 && reponse.status < 500 && reponse.status !== 401) {
        // Le modèle choisi ne sait peut-être pas contraindre son format. Ce
        // n'est pas une raison de le refuser : l'invite le demande déjà.
        reponse = await envoyer(clef, base)
      }

      if (!reponse.ok) {
        // Le corps peut renvoyer la clef en écho : il ne remonte pas.
        throw new Error(`le modèle a répondu ${reponse.status}`)
      }

      const corps = (await reponse.json()) as {
        choices?: { message?: { content?: string } }[]
        usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number }
      }

      const dollars = corps.usage?.cost
      return {
        texte: corps.choices?.[0]?.message?.content ?? '',
        jetonsEntree: corps.usage?.prompt_tokens ?? 0,
        jetonsSortie: corps.usage?.completion_tokens ?? 0,
        ...(typeof dollars === 'number' ? { dollars } : {}),
      }
    },
  }
}

function envoyer(clef: string, corps: unknown): Promise<Response> {
  return fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${clef}`,
      'content-type': 'application/json',
      // OpenRouter s'en sert pour son classement public. Poli, et utile le
      // jour où il faut retrouver d'où vient une consommation.
      'http-referer': 'https://atelier237.vercel.app',
      'x-title': 'Atelier 237',
    },
    body: JSON.stringify(corps),
  })
}
