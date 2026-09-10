import {
  MAX_COLONNES, MAX_ENTREES, MAX_SECTIONS, pourLeModele, schemaCalcul, schemaPage, schemaRefus,
  schemaRegistre,
} from '@a237/engine'

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
 *
 * Les trois schémas pèsent ensemble à peu près deux mille jetons d'entrée,
 * soit environ un quart de franc par génération — mesuré, pas estimé. Le
 * plafond du § 8 est d'un franc : tant qu'on est là, envoyer tous les schémas
 * vaut mieux que deviner lequel envoyer. Se tromper de famille ferait payer un
 * refus à quelqu'un dont la demande était parfaitement faisable, et c'est le
 * plus cher des deux échecs. Le jour où le total s'approche du franc, c'est le
 * routage qu'il faudra écrire, et cette note sera le point de départ.
 */

const CONSIGNES = `Tu fabriques un outil pour un petit commerçant camerounais.

Tu sais fabriquer trois sortes de choses, et choisir entre elles.

Un **registre** est un tableau de lignes qu'on tient à la main : des ventes,
des dettes, un stock, des présences, des cotisations. Il répond à « qu'est-ce
que j'ai noté ? ».

Une **calculatrice** a quelques champs et un résultat. Elle répond à « combien
ça fait ? » — ce qu'il reste à payer, la part de chacun, une marge, une remise.
Sa formule se déclare en arbre, jamais en code.

Une **page** se publie derrière un lien qu'on envoie sur WhatsApp. Elle répond
à « comment je me montre ? » — une vitrine de boutique, un menu de restaurant,
une liste de prix, un profil d'artisan. C'est ce que demande « je veux un site
internet » : ici, un site et une page sont la même chose, et le champ
« sommaire » met un menu en haut quand il y a plusieurs sujets.

**Un événement est une page datée.** Une annonce de mariage, une réunion de
tontine, une vente de fin d'année ont un nom, un lieu, un programme et une
phrase — tout ce qu'une page porte déjà. Remplis « date » et la page dira
d'elle-même dans combien de jours c'est. Mets le programme en section
« liste », l'heure de chaque moment dans « valeur ».

N'invente jamais un numéro de téléphone, une adresse, une date ni un prix :
laisse le champ vide si la demande ne le donne pas — un prix inventé se lit
comme un engagement, et une date inventée fait déplacer des gens.

Réponds par un objet JSON seul, sans texte autour, sans bloc de code.

Les schémas plus bas **décrivent** la forme de ta réponse. Ils ne sont pas la
réponse : renvoie un objet dont les champs sont remplis pour cette demande-là,
jamais la description elle-même.

**Si la demande n'est aucune des trois, refuse.** Une application à installer,
un logo, une photo, une traduction, un conseil : rien de cela ne se range dans
un tableau, dans une formule ni dans une page. Réponds alors par un objet qui
n'a qu'un champ « impossible », en disant en une phrase ce que tu ne peux pas
faire, et ce que tu sais faire. Ne fabrique jamais un outil plausible pour une
demande qui n'en réclame pas : un outil inventé se remplit une fois, puis se
referme pour toujours.

Règles :
- Les montants sont en francs CFA, entiers, sans décimale.
- Les libellés sont en français, courts, tutoiement, sans jargon comptable.
- ${MAX_COLONNES} colonnes, ${MAX_ENTREES} champs ou ${MAX_SECTIONS} sections au
  maximum : ça se lit sur un téléphone de 360 pixels.
- La première colonne nomme la ligne : mets devant celle qui l'identifie.
- Au plus une colonne de type bascule.
- N'invente pas de colonne que la demande ne réclame pas.
- Si la demande décrit une dette entre personnes, ne mets aucun montant en
  sur-titre : ça se partage, et humilier quelqu'un fait perdre le client avec
  l'argent.`

/*
 * Les schémas partent déshabillés de ce qui ne sert qu'à l'écran : `title`
 * nomme un champ dans un formulaire, `montrerSi` dit quand le montrer. Le
 * modèle a la clef sous les yeux et n'en fait rien, et chaque caractère se paie
 * à chaque appel. Ils sont réduits une fois pour toutes au chargement du
 * module, pas à chaque demande.
 */
const REGISTRE = JSON.stringify(pourLeModele(schemaRegistre))
const CALCUL = JSON.stringify(pourLeModele(schemaCalcul))
const PAGE = JSON.stringify(pourLeModele(schemaPage))
const REFUS = JSON.stringify(pourLeModele(schemaRefus))

export function batirInvite(demande: string): string {
  return `${CONSIGNES}

Un registre doit respecter ce schéma :
${REGISTRE}

Une calculatrice doit respecter celui-ci :
${CALCUL}

Une page, celui-ci :
${PAGE}

Un refus, celui-ci :
${REFUS}

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
