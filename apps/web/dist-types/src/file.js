import { lireFile, lireOutil, noterPublication, retirerDeLaFile } from './stockage.js';
import { publier } from './publier.js';
/** Une seule vidange à la fois : le montage et le retour du réseau se suivent de près. */
let enCours = false;
export async function viderLaFile(maintenant) {
    if (enCours)
        return { publies: 0, attendent: 0, abandonnes: 0 };
    enCours = true;
    try {
        return await vider(maintenant);
    }
    finally {
        enCours = false;
    }
}
async function vider(maintenant) {
    const entrees = await lireFile();
    let publies = 0;
    let attendent = 0;
    let abandonnes = 0;
    // Un même outil peut avoir été mis en file plusieurs fois — une par tentative
    // hors ligne. Le publier une fois suffit : c'est son état d'aujourd'hui qui
    // part, et il est le même pour toutes les entrées.
    const traites = new Set();
    for (const entree of entrees) {
        if (traites.has(entree.outilId)) {
            await retirerDeLaFile(entree.id);
            continue;
        }
        const outil = await lireOutil(entree.outilId);
        if (outil === null) {
            // Supprimé depuis. Rien à publier, et rien à dire : c'est un choix qui a
            // été fait après coup.
            await retirerDeLaFile(entree.id);
            abandonnes += 1;
            continue;
        }
        /*
         * Déjà déposé dans cette version-là. L'écran fait le même raisonnement
         * avant de diffuser : le lien vaut toujours, et une requête pour le redire
         * repartirait en conflit — le serveur n'accepte que du strictement plus
         * récent. Sans ce court-circuit, la file dépensait cette requête, puis
         * comptait le refus comme un abandon.
         */
        if (outil.lien !== undefined && outil.versionPubliee === outil.version) {
            await retirerDeLaFile(entree.id);
            traites.add(entree.outilId);
            publies += 1;
            continue;
        }
        const issue = await publier(outil, maintenant, outil.lien);
        if (issue.sorte === 'publie') {
            await noterPublication(outil, issue.lien, outil.version);
            await retirerDeLaFile(entree.id);
            traites.add(entree.outilId);
            publies += 1;
            continue;
        }
        if (issue.sorte === 'differe') {
            // Toujours hors ligne : on garde l'entrée et on arrête là. Insister sur
            // les suivantes ferait autant de requêtes vouées à échouer.
            attendent += entrees.length - publies - abandonnes;
            break;
        }
        /*
         * Refusé, ou périmé côté serveur. Réessayer n'y changera rien : un refus
         * tient à ce qu'est l'outil, un conflit à ce que le serveur détient déjà.
         * On retire l'entrée plutôt que de rejouer indéfiniment ; l'utilisateur le
         * verra à sa prochaine diffusion, avec la raison.
         */
        await retirerDeLaFile(entree.id);
        traites.add(entree.outilId);
        abandonnes += 1;
    }
    return { publies, attendent, abandonnes };
}
