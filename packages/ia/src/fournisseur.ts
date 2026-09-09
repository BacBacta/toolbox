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
