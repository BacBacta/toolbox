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
  /**
   * La conversation, quand il y en a une.
   *
   * L'invite porte les consignes et le schéma ; ceci porte ce qui s'est dit.
   * Les deux sont séparés parce que le premier est constant — un fournisseur
   * qui sait mettre en cache son préfixe ne paie qu'une fois ce qui ne change
   * pas — et que le second grandit à chaque tour.
   */
  readonly conversation?: readonly TourConversation[]
}

export interface TourConversation {
  readonly qui: 'personne' | 'agent'
  readonly texte: string
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

/**
 * Une panne de fournisseur, nommée.
 *
 * Une seule distinction compte vraiment : **le crédit épuisé n'est pas une
 * panne**. C'est un compte à recharger, et le dire « le modèle n'a pas
 * répondu » envoie l'utilisateur chercher un problème qui n'existe pas
 * pendant que la vraie cause tient en une phrase. Le brief en fait un critère
 * d'arrêt : « le chemin plus de crédits est propre » (§ 8).
 */
export class ErreurFournisseur extends Error {
  constructor(
    readonly sorte: 'credit-epuise' | 'refuse' | 'panne',
    message: string,
  ) {
    super(message)
    this.name = 'ErreurFournisseur'
  }
}

/** Ce qu'un flux rapporte : des morceaux, puis le compte des jetons. */
export interface MorceauModele {
  readonly texte: string
}

export interface Fournisseur {
  readonly nom: string
  /** Prix par million de jetons, en dollars. Sert au journal des coûts. */
  readonly prix: { readonly entree: number; readonly sortie: number }
  readonly appeler: (demande: DemandeModele) => Promise<ReponseModele>
  /**
   * Le même appel, mais rendu au fur et à mesure.
   *
   * C'est ce qui permet de montrer l'outil s'écrire plutôt que de faire
   * patienter huit secondes devant un écran vide — et sur une connexion qui
   * hoquette, huit secondes deviennent trente. La dernière valeur rendue porte
   * le compte des jetons, qui n'arrive qu'à la fin.
   *
   * Facultatif : un fournisseur qui ne sait pas diffuser reste utilisable, et
   * l'appelant retombe sur `appeler`. Mieux vaut un aperçu qui apparaît d'un
   * coup qu'un modèle qu'on ne peut pas essayer.
   */
  readonly diffuser?: (
    demande: DemandeModele,
    signal?: AbortSignal,
  ) => AsyncGenerator<MorceauModele, ReponseModele>
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
      const tours = toursGemini(demande)
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
        throw new ErreurFournisseur(
          reponse.status === 429 ? 'credit-epuise' : reponse.status === 403 ? 'refuse' : 'panne',
          `le modèle a répondu ${reponse.status}`,
        )
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
      const messages = messagesOpenAI(demande)
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
        throw new ErreurFournisseur(
          reponse.status === 402 ? 'credit-epuise' : reponse.status === 401 ? 'refuse' : 'panne',
          `le routeur a répondu ${reponse.status}`,
        )
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

    /**
     * Le même appel, rendu au fur et à mesure.
     *
     * Le compte des jetons n'arrive qu'à la toute fin du flux, dans le dernier
     * événement : c'est pour ça que le générateur rend des morceaux et
     * **retourne** un total. Un appel diffusé qui ne journaliserait pas son
     * coût serait un appel qu'on ne compte pas, et le § 8 en fait un critère.
     */
    async *diffuser(demande, signal) {
      /*
       * `response_format` sur le flux aussi, et ce n'est pas un détail.
       *
       * Il était posé sur l'appel d'un seul tenant et oublié ici. Mesuré sur
       * de vrais deuxièmes tours : deux fois sur trois, le modèle répondait en
       * **prose** — « Voilà, j'ai retiré la date et ajouté la colonne » — sans
       * une accolade. Une conversation qui ressemble à une conversation le
       * fait glisser dans le registre de la conversation, et le contrat JSON,
       * énoncé une seule fois au début, ne pèse plus assez.
       *
       * La prose était pire qu'illisible : elle **affirmait** une modification
       * qui n'était nulle part. L'accepter comme réponse aurait montré à
       * quelqu'un « j'ai retiré la date » au-dessus d'un outil où la date est
       * toujours là.
       */
      const base = {
        model: modele,
        messages: messagesOpenAI(demande),
        temperature: 0,
        max_tokens: 2048,
        stream: true,
        usage: { include: true },
      }

      let reponse = await diffuserVers(clef, { ...base, response_format: { type: 'json_object' } }, signal)
      if (reponse.status >= 400 && reponse.status < 500 && reponse.status !== 401) {
        // Le modèle choisi ne sait peut-être pas contraindre son format. Ce
        // n'est pas une raison de le refuser : l'invite le demande déjà.
        reponse = await diffuserVers(clef, base, signal)
      }

      if (!reponse.ok || reponse.body === null) {
        throw new ErreurFournisseur(
          reponse.status === 402 ? 'credit-epuise' : reponse.status === 401 ? 'refuse' : 'panne',
          `le routeur a répondu ${reponse.status}`,
        )
      }

      let texte = ''
      let jetonsEntree = 0
      let jetonsSortie = 0
      let dollars: number | undefined

      for await (const ligne of lignesSSE(reponse.body)) {
        if (!ligne.startsWith('data:')) continue
        const charge = ligne.slice(5).trim()
        if (charge === '' || charge === '[DONE]') continue

        let evenement: {
          choices?: { delta?: { content?: string } }[]
          usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number }
        }
        try {
          evenement = JSON.parse(charge)
        } catch {
          // Un commentaire de maintien en vie, ou une ligne coupée : la
          // suivante dira la même chose en mieux.
          continue
        }

        const morceau = evenement.choices?.[0]?.delta?.content
        if (typeof morceau === 'string' && morceau !== '') {
          texte += morceau
          yield { texte: morceau }
        }
        if (evenement.usage !== undefined) {
          jetonsEntree = evenement.usage.prompt_tokens ?? jetonsEntree
          jetonsSortie = evenement.usage.completion_tokens ?? jetonsSortie
          if (typeof evenement.usage.cost === 'number') dollars = evenement.usage.cost
        }
      }

      return { texte, jetonsEntree, jetonsSortie, ...(dollars === undefined ? {} : { dollars }) }
    },
  }
}

/**
 * La conversation, mise en messages.
 *
 * L'invite constante d'abord, seule dans son message : un fournisseur qui sait
 * mettre en cache son préfixe ne paie qu'une fois ce qui ne change pas, et
 * c'est ce qui rend une conversation abordable. Ce qui s'est dit suit, dans
 * l'ordre où ça s'est dit.
 */
function messagesOpenAI(demande: DemandeModele): { role: string; content: string }[] {
  const messages = [{ role: 'user', content: demande.invite }]
  for (const tour of demande.conversation ?? []) {
    messages.push({ role: tour.qui === 'agent' ? 'assistant' : 'user', content: tour.texte })
  }
  return messages
}

function toursGemini(demande: DemandeModele): { role: string; parts: { text: string }[] }[] {
  const tours = [{ role: 'user', parts: [{ text: demande.invite }] }]
  for (const tour of demande.conversation ?? []) {
    tours.push({ role: tour.qui === 'agent' ? 'model' : 'user', parts: [{ text: tour.texte }] })
  }
  return tours
}

/**
 * Les lignes d'un flux d'événements, une par une.
 *
 * Un morceau de réseau ne s'arrête pas à la fin d'une ligne : il coupe au
 * milieu d'un mot, et parfois au milieu d'un caractère accentué. Le tampon
 * garde ce qui dépasse, et `TextDecoder` en mode continu recolle les octets
 * d'un « é » arrivé en deux fois — sans quoi l'aperçu afficherait des losanges
 * là où le modèle a écrit du français.
 */
async function* lignesSSE(corps: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const lecteur = corps.getReader()
  const decodeur = new TextDecoder()
  let tampon = ''
  try {
    for (;;) {
      const { done, value } = await lecteur.read()
      if (done) break
      tampon += decodeur.decode(value, { stream: true })
      let coupure = tampon.indexOf('\n')
      while (coupure !== -1) {
        yield tampon.slice(0, coupure).trim()
        tampon = tampon.slice(coupure + 1)
        coupure = tampon.indexOf('\n')
      }
    }
    if (tampon.trim() !== '') yield tampon.trim()
  } finally {
    // Abandonner sans relâcher le lecteur laisse la connexion ouverte, et un
    // Worker qui garde des connexions ouvertes finit par ne plus en avoir.
    lecteur.cancel().catch(() => undefined)
  }
}

function diffuserVers(clef: string, corps: unknown, signal?: AbortSignal): Promise<Response> {
  return fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${clef}`,
      'content-type': 'application/json',
      'http-referer': 'https://atelier237.pages.dev',
      'x-title': 'Atelier 237',
    },
    body: JSON.stringify(corps),
    ...(signal !== undefined ? { signal } : {}),
  })
}

function envoyer(clef: string, corps: unknown): Promise<Response> {
  return fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${clef}`,
      'content-type': 'application/json',
      // OpenRouter s'en sert pour son classement public. Poli, et utile le
      // jour où il faut retrouver d'où vient une consommation.
      'http-referer': 'https://atelier237.pages.dev',
      'x-title': 'Atelier 237',
    },
    body: JSON.stringify(corps),
  })
}
