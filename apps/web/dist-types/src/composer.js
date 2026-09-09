import { lireReponseModele } from '@a237/engine';
export async function composer(demande, signal) {
    let reponse;
    try {
        reponse = await fetch('/api/ai', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ demande }),
            ...(signal !== undefined ? { signal } : {}),
        });
    }
    catch {
        // Hors ligne, ou réseau capricieux : c'est le cas courant ici, pas l'exception.
        return { sorte: 'echoue', pourquoi: 'pas de réseau' };
    }
    if (reponse.status === 503)
        return { sorte: 'pas-ouvert' };
    if (reponse.status === 402) {
        const corps = (await reponse.json().catch(() => null));
        return corps?.erreur === 'abonnement-requis'
            ? {
                sorte: 'abonnement-requis',
                pourquoi: typeof corps.pourquoi === 'string' ? corps.pourquoi : '',
            }
            : { sorte: 'sans-credit' };
    }
    if (!reponse.ok) {
        return {
            sorte: 'echoue',
            pourquoi: reponse.status === 422 ? 'la description n’a pas suffi' : 'le service a refusé',
        };
    }
    const corps = (await reponse.json().catch(() => null));
    const fcfa = typeof corps?.fcfa === 'number' ? corps.fcfa : 0;
    /*
     * Le refus se lit sur l'enveloppe, pas au validateur.
     *
     * L'enveloppe porte `fcfa` à côté de la charge utile, et le schéma de refus
     * interdit tout champ supplémentaire : lui passer l'enveloppe entière faisait
     * rejeter un refus parfaitement valide, et l'écran disait « je n'ai pas pu
     * composer » à la place de la phrase du modèle.
     */
    if (typeof corps?.impossible === 'string' && corps.impossible !== '') {
        return { sorte: 'hors-sujet', pourquoi: corps.impossible };
    }
    // Le même lecteur que le serveur, sur la charge utile seule.
    const lu = lireReponseModele(corps?.registre ?? corps?.calcul);
    if (lu.sorte === 'registre')
        return { sorte: 'compose', registre: lu.registre, fcfa };
    if (lu.sorte === 'calcul')
        return { sorte: 'calcule', calcul: lu.calcul, fcfa };
    return { sorte: 'echoue', pourquoi: 'la réponse ne décrit pas un outil valide' };
}
