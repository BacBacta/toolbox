import { verifierRegistre } from '@a237/engine';
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
    if (!reponse.ok) {
        return {
            sorte: 'echoue',
            pourquoi: reponse.status === 422 ? 'la description n’a pas suffi' : 'le service a refusé',
        };
    }
    const corps = (await reponse.json().catch(() => null));
    if (typeof corps?.impossible === 'string' && corps.impossible !== '') {
        return { sorte: 'hors-sujet', pourquoi: corps.impossible };
    }
    const erreurs = verifierRegistre(corps?.registre);
    if (erreurs.length > 0) {
        return { sorte: 'echoue', pourquoi: 'la réponse ne décrit pas un registre valide' };
    }
    return {
        sorte: 'compose',
        registre: corps?.registre,
        fcfa: typeof corps?.fcfa === 'number' ? corps.fcfa : 0,
    };
}
