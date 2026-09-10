import { createStore, get, set } from 'idb-keyval';
import { entetesDAppareil } from './appareil.js';
async function appeler(chemin, options = {}) {
    let reponse;
    try {
        reponse = await fetch(chemin, {
            ...options,
            headers: { 'content-type': 'application/json', ...(await entetesDAppareil()), ...options.headers },
        });
    }
    catch {
        return { sorte: 'differe' };
    }
    const corps = (await reponse.json().catch(() => null));
    if (reponse.ok)
        return { sorte: 'ok', valeur: corps };
    // 503 est le seul refus qui se réessaie : le serveur n'est pas branché, ce
    // n'est ni la faute ni l'affaire de qui regarde.
    if (reponse.status === 503)
        return { sorte: 'differe' };
    const pourquoi = typeof corps?.pourquoi === 'string' ? corps.pourquoi : '';
    const erreur = typeof corps?.erreur === 'string' ? corps.erreur : 'refus';
    return { sorte: 'refuse', pourquoi: pourquoi === '' ? erreur : pourquoi };
}
export function lireCompte() {
    return appeler('/api/compte');
}
/** Un code neuf annule le précédent : c'est ce qu'on veut si on l'a laissé traîner. */
export function demanderCode() {
    return appeler('/api/compte/code', { method: 'POST' });
}
export function reprendreAvecCode(code) {
    return appeler('/api/compte/reprendre', {
        method: 'POST',
        body: JSON.stringify({ code }),
    });
}
export function demarrerPaiement(telephone) {
    return appeler('/api/pay/demarrer', {
        method: 'POST',
        body: JSON.stringify({ telephone }),
    });
}
export function suivrePaiement(id) {
    return appeler(`/api/pay/${id}`);
}
/*
 * Le dernier état connu, gardé à part.
 *
 * Un magasin qui n'est pas celui des outils : effacer ses outils ne doit pas
 * effacer ce qu'on sait de son abonnement.
 */
const COMPTE = createStore('atelier237-compte', 'compte');
const CLEF = 'etat';
export async function dernierEtatConnu() {
    return (await get(CLEF, COMPTE)) ?? null;
}
export async function retenirEtat(etat) {
    await set(CLEF, etat, COMPTE);
}
/**
 * Ce qu'une réponse du modèle apprend au passage.
 *
 * Le proxy renvoie le solde avec la composition : le compte se tient à jour
 * sans qu'on l'interroge, et sans coûter un aller-retour de plus.
 */
export async function noterApresComposition(plan, credits) {
    if ((plan !== 'essai' && plan !== 'atelier') || typeof credits !== 'number')
        return;
    const connu = await dernierEtatConnu();
    await retenirEtat({
        plan,
        credits,
        expire: connu?.expire ?? null,
        aUnCode: connu?.aUnCode ?? false,
    });
}
