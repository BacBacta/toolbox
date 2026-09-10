import { lireDepot, nouvelleClef, nouveauLien, pourLeDepot } from '@a237/etabli';
const REFUS = {
    'projet-trop-gros': 'Ce projet est trop lourd pour être partagé.',
    'projet-invalide': 'Un des fichiers ne passe pas : renomme-le et réessaie.',
    'clef-invalide': 'Cette sauvegarde est abîmée. Enregistre-la sous un nouveau lien.',
    'lien-inconnu': 'Ce lien ne t’appartient pas.',
};
/**
 * Dépose le projet, et rend le projet muni de son lien.
 *
 * Le lien et la clef se tirent **sur l'appareil**, pas sur le serveur : celui
 * qui dépose n'a donc rien à demander à personne, et un premier dépôt tient en
 * un aller simple. Le serveur ne fait qu'accepter ou refuser.
 */
export async function deposer(projet) {
    const lien = projet.lien ?? nouveauLien();
    const clef = projet.clef ?? nouvelleClef();
    let reponse;
    try {
        reponse = await fetch(`/api/p/${lien}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ clef, ...pourLeDepot(projet) }),
        });
    }
    catch {
        // Hors ligne, ou réseau capricieux : c'est le cas courant ici, et ce n'est
        // pas une panne. Le projet reste sur le téléphone, entier.
        return { sorte: 'pas-de-reseau' };
    }
    if (reponse.ok)
        return { sorte: 'depose', projet: { ...projet, lien, clef } };
    const corps = (await reponse.json().catch(() => null));
    const pourquoi = REFUS[corps?.erreur ?? ''] ?? 'Le partage a échoué. Réessaie tout à l’heure.';
    return { sorte: 'refuse', pourquoi };
}
/** Ouvre un projet reçu. Ce qui revient est vérifié avant d'exister. */
export async function recuperer(lien) {
    let reponse;
    try {
        reponse = await fetch(`/api/p/${lien}`);
    }
    catch {
        return { sorte: 'pas-de-reseau' };
    }
    if (reponse.status === 404)
        return { sorte: 'introuvable' };
    if (!reponse.ok)
        return { sorte: 'refuse', pourquoi: 'Ce lien n’a pas pu être ouvert.' };
    const depot = lireDepot(await reponse.json().catch(() => null));
    if (depot === null)
        return { sorte: 'refuse', pourquoi: 'Ce lien ne contient pas un projet lisible.' };
    return { sorte: 'ouvert', nom: depot.nom, fichiers: depot.fichiers };
}
/**
 * Le lien tel qu'on l'envoie sur WhatsApp.
 *
 * Il ouvre l'éditeur sur le projet — il ne sert **jamais** la page directement.
 * Servir du HTML écrit par un inconnu ferait de cette adresse un hébergement de
 * pages piégées ; ici, le code reçu s'exécute dans le cadre isolé de celui qui
 * l'ouvre, comme n'importe quel autre projet.
 */
export function adressePartagee(lien, origine) {
    return `${origine}/?p=${lien}`;
}
/** Le lien demandé dans l'adresse, s'il y en a un. */
export function lienDemande(recherche) {
    const p = new URLSearchParams(recherche).get('p');
    return p === null || p === '' ? null : p;
}
