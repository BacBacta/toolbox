import { createStore, get, set } from 'idb-keyval';
import { entetesDAppareil } from './appareil.js';
/**
 * Les réponses reçues par un formulaire publié.
 *
 * Elles vivent sur le serveur — c'est le seul endroit possible, puisque c'est
 * là qu'elles arrivent — et sont **gardées sur l'appareil dès qu'elles sont
 * lues**. Un traiteur qui a ramassé quinze commandes doit pouvoir les relire
 * dans son taxi, hors ligne, comme il relit tout le reste (§ 2.7). Le réseau
 * sert à en chercher de nouvelles, pas à consulter celles qu'on a déjà.
 *
 * C'est la seule lecture réseau du produit. Les trois autres — publier, payer,
 * appeler le modèle — écrivent ; celle-ci va chercher ce que d'autres ont
 * écrit, et l'invariant tient de la même façon : elle peut attendre.
 */
const REPONSES = createStore('atelier237-reponses', 'reponses');
export async function dernieresConnues(lien) {
    const range = await get(lien, REPONSES);
    return range === undefined
        ? { reponses: [], leA: null, horsLigne: false }
        : { ...range, horsLigne: false };
}
/**
 * Va chercher les réponses, et range ce qu'elle rapporte.
 *
 * En cas d'échec réseau elle rend ce qu'on avait, en le disant : un écran vide
 * ferait croire que personne n'a répondu, ce qui est le pire des malentendus
 * pour quelqu'un qui attend des commandes.
 */
export async function rafraichir(lien, maintenant) {
    const gardees = await dernieresConnues(lien);
    let reponse;
    try {
        reponse = await fetch(`/api/reponses/${lien}`, { headers: await entetesDAppareil() });
    }
    catch {
        return { ...gardees, horsLigne: true };
    }
    if (!reponse.ok)
        return { ...gardees, horsLigne: true };
    const corps = (await reponse.json().catch(() => null));
    const brutes = Array.isArray(corps?.reponses) ? corps.reponses : [];
    const reponses = brutes.filter(estUneReponse);
    const recolte = { reponses, leA: maintenant.getTime() };
    await set(lien, recolte, REPONSES);
    return { ...recolte, horsLigne: false };
}
/**
 * Le serveur est le nôtre, mais ce qu'il renvoie a été écrit par des inconnus
 * et a fait un aller-retour en base. Une ligne qui n'a pas la forme attendue
 * est écartée plutôt que de faire tomber l'affichage des autres.
 */
function estUneReponse(valeur) {
    if (typeof valeur !== 'object' || valeur === null)
        return false;
    const r = valeur;
    return typeof r.recuLe === 'number' && typeof r.contenu === 'object' && r.contenu !== null;
}
