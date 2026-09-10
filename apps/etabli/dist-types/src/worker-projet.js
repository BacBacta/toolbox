import { MAX_OCTETS_DEPOT, clefValide, lienValide, lireDepot } from '@a237/etabli';
function json(statut, corps) {
    return new Response(JSON.stringify(corps), {
        status: statut,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
}
function segment(params) {
    const brut = params['lien'];
    return Array.isArray(brut) ? (brut[0] ?? '') : (brut ?? '');
}
export async function onRequest(contexte) {
    const rangement = contexte.env.PROJETS;
    if (rangement === undefined)
        return json(503, { erreur: 'le partage n’est pas ouvert' });
    const lien = segment(contexte.params);
    if (!lienValide(lien))
        return json(404, { erreur: 'lien-inconnu' });
    if (contexte.request.method === 'GET') {
        const range = (await rangement.get(lien, 'json'));
        if (range === null)
            return json(404, { erreur: 'lien-inconnu' });
        // La clef ne ressort jamais : elle autorise à réécrire, et le lien se
        // partage. Les rendre ensemble donnerait ce droit à tout destinataire.
        return json(200, { nom: range.nom, fichiers: range.fichiers });
    }
    if (contexte.request.method !== 'PUT')
        return json(405, { erreur: 'méthode non permise' });
    /*
     * On refuse au poids avant de lire le corps.
     *
     * Sans ça, n'importe qui pousse un fichier de cent mégaoctets et c'est le
     * Worker qui le porte en mémoire avant de le rejeter. L'en-tête ment
     * parfois — d'où le second contrôle, sur ce qui a réellement été lu.
     */
    const annonce = Number(contexte.request.headers.get('content-length') ?? '0');
    if (annonce > MAX_OCTETS_DEPOT * 2)
        return json(413, { erreur: 'projet-trop-gros' });
    let recu;
    try {
        recu = (await contexte.request.json());
    }
    catch {
        return json(400, { erreur: 'corps-illisible' });
    }
    if (!clefValide(recu.clef))
        return json(400, { erreur: 'clef-invalide' });
    const depot = lireDepot({ nom: recu.nom, fichiers: recu.fichiers });
    if (depot === null)
        return json(400, { erreur: 'projet-invalide' });
    /*
     * Le premier qui écrit sur un lien en devient le propriétaire.
     *
     * Il n'y a pas de compte : c'est la clef, tirée sur l'appareil et jamais
     * partagée, qui tient lieu d'identité. Un lien tiré sur cinquante bits ne se
     * devine pas, et sans la bonne clef on ne réécrit pas dessus.
     */
    const existant = (await rangement.get(lien, 'json'));
    if (existant !== null && existant.clef !== recu.clef) {
        // 404 et non 403 : dire « ce lien existe mais tu n'as pas la clef »
        // apprendrait à qui tâtonne quels liens sont pris.
        return json(404, { erreur: 'lien-inconnu' });
    }
    const range = {
        nom: depot.nom,
        fichiers: depot.fichiers,
        clef: recu.clef,
        depuis: existant?.depuis ?? Date.now(),
    };
    await rangement.put(lien, JSON.stringify(range));
    return json(200, { lien });
}
