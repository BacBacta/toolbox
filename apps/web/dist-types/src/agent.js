import { entetesDAppareil } from './appareil.js';
import { noterApresComposition } from './compte.js';
/**
 * Un tour, rendu signe par signe.
 *
 * Un générateur et non un rappel : celui qui appelle décide du rythme auquel il
 * redessine, et `for await` s'arrête tout seul quand on quitte l'écran.
 */
export async function* parler(tour, signal) {
    let reponse;
    try {
        reponse = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...(await entetesDAppareil()) },
            body: JSON.stringify(tour),
            ...(signal !== undefined ? { signal } : {}),
        });
    }
    catch {
        // Hors ligne, ou réseau capricieux : c'est le cas courant ici.
        yield { sorte: 'panne', pourquoi: 'pas de réseau' };
        return;
    }
    if (reponse.status === 503) {
        yield { sorte: 'pas-ouvert' };
        return;
    }
    if (reponse.status === 402) {
        const corps = (await reponse.json().catch(() => null));
        const pourquoi = typeof corps?.pourquoi === 'string' ? corps.pourquoi : '';
        yield corps?.erreur === 'abonnement-requis'
            ? { sorte: 'abonnement-requis', pourquoi }
            : { sorte: 'sans-credit', pourquoi };
        return;
    }
    if (!reponse.ok || reponse.body === null) {
        yield { sorte: 'panne', pourquoi: 'le service a refusé' };
        return;
    }
    let fini = false;
    try {
        for await (const signe of lireLeFlux(reponse.body)) {
            // Le solde revient avec le dernier événement : le compte se tient à jour
            // sans qu'on l'interroge, et sans coûter un aller-retour de plus.
            if (signe.sorte === 'fin') {
                await noterApresComposition(signe.plan, signe.credits);
                fini = true;
            }
            if (signe.sorte === 'panne')
                fini = true;
            yield versSigne(signe);
        }
    }
    catch {
        /*
         * Le flux a cassé pendant qu'on le lisait.
         *
         * Une connexion mobile qui lâche en plein milieu ne rend pas un code
         * d'erreur : elle jette. Sans ce filet, le rejet remonte jusqu'à l'écran,
         * qui n'a rien pour l'attraper — la conversation reste figée sur une
         * phrase à moitié écrite, et le tour a été payé. Le mot ci-dessous est le
         * même que pour un flux qui s'arrête sans conclure, parce que c'est la
         * même chose vue de l'utilisateur.
         */
    }
    /*
     * Un flux qui s'arrête sans conclure.
     *
     * C'est le cas courant ici, pas l'exception : une connexion mobile qui
     * lâche pendant qu'on écrit coupe la réponse au milieu. Sans ce mot, l'écran
     * revenait au repos avec une phrase à moitié écrite et rien pour dire
     * pourquoi — et le tour, lui, a bien été payé.
     */
    if (!fini)
        yield { sorte: 'panne', pourquoi: 'la réponse s’est coupée en route' };
}
function versSigne(e) {
    if (e.sorte === 'ebauche' && e.ebauche !== undefined) {
        return { sorte: 'ebauche', ebauche: e.ebauche };
    }
    if (e.sorte === 'fin' && e.tour !== undefined) {
        return {
            sorte: 'fin',
            tour: e.tour,
            fcfa: typeof e.fcfa === 'number' ? e.fcfa : 0,
            conversation: e.conversation ?? '',
        };
    }
    const pourquoi = e.pourquoi ?? 'le modèle n’a pas répondu';
    return e.sansCredit === true
        ? { sorte: 'sans-credit', pourquoi }
        : { sorte: 'panne', pourquoi };
}
/**
 * Les événements d'un flux, un par un.
 *
 * Le tampon garde ce qui dépasse : un morceau de réseau ne s'arrête pas à la
 * fin d'un événement, et `TextDecoder` en mode continu recolle les octets d'un
 * « é » arrivé en deux fois — sans quoi la conversation afficherait des
 * losanges là où l'agent a écrit du français.
 */
async function* lireLeFlux(corps) {
    const lecteur = corps.getReader();
    const decodeur = new TextDecoder();
    let tampon = '';
    try {
        for (;;) {
            const { done, value } = await lecteur.read();
            if (done)
                break;
            tampon += decodeur.decode(value, { stream: true });
            let fin = tampon.indexOf('\n\n');
            while (fin !== -1) {
                const brut = tampon.slice(0, fin).trim();
                tampon = tampon.slice(fin + 2);
                fin = tampon.indexOf('\n\n');
                if (!brut.startsWith('data:'))
                    continue;
                try {
                    yield JSON.parse(brut.slice(5).trim());
                }
                catch {
                    // Un événement abîmé ne doit pas emporter les suivants.
                }
            }
        }
    }
    finally {
        lecteur.cancel().catch(() => undefined);
    }
}
