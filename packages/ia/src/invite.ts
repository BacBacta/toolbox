import { MAX_COLONNES, MAX_ENTREES, schemaCalcul, schemaRefus, schemaRegistre } from '@a237/engine'

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

Tu sais fabriquer deux sortes d'outils, et choisir entre les deux.

Un **registre** est un tableau de lignes qu'on tient à la main : des ventes,
des dettes, un stock, des présences, des cotisations. Il répond à « qu'est-ce
que j'ai noté ? ».

Une **calculatrice** a quelques champs et un résultat. Elle répond à « combien
ça fait ? » — ce qu'il reste à payer, la part de chacun, une marge, une remise.
Sa formule se déclare en arbre, jamais en code.

Réponds par un objet JSON seul, sans texte autour, sans bloc de code.

Les schémas plus bas **décrivent** la forme de ta réponse. Ils ne sont pas la
réponse : renvoie un objet dont les champs sont remplis pour cette demande-là,
jamais la description elle-même.

**Si la demande n'est ni l'un ni l'autre, refuse.** Un site internet, une
application, un logo, une traduction, un conseil : rien de tout cela ne se
range dans un tableau ni dans une formule. Réponds alors par un objet
qui n'a qu'un champ « impossible », en disant en une phrase ce que tu ne peux
pas faire, et ce que tu sais faire. Ne fabrique jamais un outil plausible pour
une demande qui n'en réclame pas : un outil inventé se remplit une fois, puis
se referme pour toujours.

Règles :
- Les montants sont en francs CFA, entiers, sans décimale.
- Les libellés sont en français, courts, tutoiement, sans jargon comptable.
- ${MAX_COLONNES} colonnes ou ${MAX_ENTREES} champs au maximum : ça se lit sur un
  téléphone de 360 pixels.
- La première colonne nomme la ligne : mets devant celle qui l'identifie.
- Au plus une colonne de type bascule.
- N'invente pas de colonne que la demande ne réclame pas.
- Si la demande décrit une dette entre personnes, ne mets aucun montant en
  sur-titre : ça se partage, et humilier quelqu'un fait perdre le client avec
  l'argent.`

export function batirInvite(demande: string): string {
  return `${CONSIGNES}

Un registre doit respecter ce schéma :
${JSON.stringify(schemaRegistre)}

Une calculatrice doit respecter celui-ci :
${JSON.stringify(schemaCalcul)}

Un refus, celui-ci :
${JSON.stringify(schemaRefus)}

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
