import { MAX_COLONNES, schemaRegistre } from '@a237/engine'

/**
 * L'invite qui impose la sortie en JSON conforme au schéma (§ 3).
 *
 * Elle est courte exprès. Le schéma porte déjà les consignes là où le modèle
 * les lit vraiment — dans les `description` de chaque champ — et rallonger
 * l'invite pour redire ce que le schéma dit coûte des jetons d'entrée à chaque
 * appel, sur un budget d'un franc.
 *
 * Trois choses seulement ne peuvent pas vivre dans le schéma : le métier
 * (Cameroun, francs CFA, téléphone), l'interdiction de sortir du cadre, et le
 * fait que la réponse doit être du JSON nu.
 */

const CONSIGNES = `Tu configures un registre pour un petit commerçant camerounais.

Réponds par un objet JSON seul, sans texte autour, sans bloc de code.
Il doit être conforme au schéma donné plus bas.

Règles :
- Les montants sont en francs CFA, entiers, sans décimale.
- Les libellés sont en français, courts, tutoiement, sans jargon comptable.
- ${MAX_COLONNES} colonnes au maximum : ça se lit sur un téléphone de 360 pixels.
- La première colonne nomme la ligne : mets devant celle qui l'identifie.
- Au plus une colonne de type bascule.
- N'invente pas de colonne que la demande ne réclame pas.
- Si la demande décrit une dette entre personnes, ne mets aucun montant en
  sur-titre : ça se partage, et humilier quelqu'un fait perdre le client avec
  l'argent.`

export function batirInvite(demande: string): string {
  return `${CONSIGNES}

Schéma :
${JSON.stringify(schemaRegistre)}

Demande de l'utilisateur :
${demande}`
}

/**
 * Le tour de reprise. Un seul est prévu (§ 3), donc il doit porter.
 *
 * On renvoie les reproches tels que `verifierRegistre` les a écrits — chemin et
 * message — parce qu'ils nomment le champ fautif et la correction. « Ce n'est
 * pas valide » ferait recommencer au hasard.
 */
export function batirReproches(erreurs: readonly { chemin: string; message: string }[]): string {
  const liste = erreurs.map((e) => `- ${e.chemin} : ${e.message}`).join('\n')
  return `Ta réponse n'est pas conforme. Corrige exactement ceci et renvoie l'objet JSON entier :

${liste}`
}
