import { createStore, del, entries, get, set } from 'idb-keyval';
/**
 * L'état vit sur le téléphone, dans IndexedDB.
 *
 * `localStorage` plafonne vers 5 Mo, il est synchrone — donc il bloque le fil
 * d'exécution pendant qu'on écrit — et il ne sait stocker que du texte, alors
 * qu'on y mettra des PNG de carte. IndexedDB coche les trois cases, et
 * `idb-keyval` en fait une clef-valeur pour un kilo-octet.
 *
 * Deux bases séparées, et non deux magasins d'une même base : `createStore`
 * d'idb-keyval crée son magasin à la version 1 de la base, donc deux appels sur
 * la même base ne peuvent pas coexister.
 */
const OUTILS = createStore('atelier237-outils', 'outils');
const FILE = createStore('atelier237-file', 'file');
export function nouvelIdentifiant() {
    return crypto.randomUUID();
}
/** Les outils, le plus récemment touché en premier. */
export async function listerOutils() {
    const tout = await entries(OUTILS);
    return tout.map(([, o]) => o).sort((a, b) => b.majLe - a.majLe);
}
export async function lireOutil(id) {
    return (await get(id, OUTILS)) ?? null;
}
export async function enregistrerOutil(outil) {
    await set(outil.id, outil, OUTILS);
}
export async function supprimerOutil(id) {
    await del(id, OUTILS);
}
/**
 * Range un nouvel état et fait avancer la version.
 *
 * La version monte à chaque enregistrement, pas seulement à chaque publication :
 * c'est ce qui permet au serveur de reconnaître un état plus ancien même quand
 * l'appareil est resté longtemps hors ligne.
 */
export async function majEtat(outil, etat, maintenant) {
    const suivant = {
        ...outil,
        etat,
        version: outil.version + 1,
        majLe: maintenant.getTime(),
    };
    await enregistrerOutil(suivant);
    return suivant;
}
/**
 * Note qu'un dépôt a été accepté.
 *
 * Le lien et la version publiée sont écrits **après** la réponse du serveur, et
 * jamais avant : un lien inscrit d'avance serait une adresse morte, envoyée
 * sous le nom de celui qui la partage.
 */
export async function noterPublication(outil, lien, version) {
    const suivant = { ...outil, lien, versionPubliee: version };
    await enregistrerOutil(suivant);
    return suivant;
}
/**
 * Range un outil neuf.
 *
 * L'état initial est fourni par le fragment de l'outil, pas construit ici : le
 * stockage ne connaît aucun squelette, et la coquille ne tire donc pas les
 * dix-sept schémas dans son fragment de départ pour créer un devis.
 */
export async function creerOutil(skeletonId, nom, etat, maintenant, compose) {
    const outil = {
        id: nouvelIdentifiant(),
        skeleton: skeletonId,
        nom,
        etat,
        ...(compose?.registre !== undefined ? { registre: compose.registre } : {}),
        ...(compose?.calcul !== undefined ? { calcul: compose.calcul } : {}),
        version: 0,
        creeLe: maintenant.getTime(),
        majLe: maintenant.getTime(),
    };
    await enregistrerOutil(outil);
    return outil;
}
/**
 * Met une publication en file d'attente.
 *
 * Le réseau ne sert qu'à publier, payer et appeler le modèle — trois choses qui
 * peuvent attendre (invariant § 2.7). Ce qui n'est pas parti est rejoué au
 * prochain lancement.
 */
export async function filerPublication(entree) {
    await set(entree.id, entree, FILE);
}
export async function lireFile() {
    const tout = await entries(FILE);
    return tout.map(([, e]) => e).sort((a, b) => a.creeLe - b.creeLe);
}
export async function retirerDeLaFile(id) {
    await del(id, FILE);
}
