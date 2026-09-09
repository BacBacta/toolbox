/**
 * Ce qu'une génération a coûté, en francs CFA.
 *
 * Le brief en fait un critère de réussite chiffré : **moins d'un franc par
 * génération** (§ 8), journalisé dans `ai_calls` avec le coût réel. Sans cette
 * mesure, « ça ne coûte presque rien » est une croyance ; avec elle, c'est un
 * nombre qu'on peut voir monter.
 *
 * Le taux est passé en argument et non lu quelque part : c'est une décision de
 * gestion qui bouge, et une constante cachée dans un calcul est une décision
 * que personne ne revoit jamais.
 */

export interface Cout {
  readonly dollars: number
  readonly fcfa: number
}

export function couter(
  jetons: { readonly entree: number; readonly sortie: number },
  prix: { readonly entree: number; readonly sortie: number },
  tauxFcfaParDollar: number,
): Cout {
  const dollars = (jetons.entree * prix.entree + jetons.sortie * prix.sortie) / 1_000_000
  // Arrondi au centime de franc : en dessous, on journalise du bruit.
  return { dollars, fcfa: Math.round(dollars * tauxFcfaParDollar * 100) / 100 }
}
