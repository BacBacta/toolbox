/**
 * `GET /api/p/:lien` et `PUT /api/p/:lien` — le dépôt d'un projet.
 *
 * C'est la seule écriture venue de l'extérieur dans tout l'Établi, et la seule
 * raison pour laquelle il touche à un réseau. Elle referme les deux écarts qui
 * bloquaient : un projet survit au téléphone perdu, et « regarde ce que j'ai
 * fait » devient une adresse.
 *
 * **Ce qui est déposé n'est jamais servi comme une page.** Le lien ouvre
 * l'éditeur, qui charge le projet et l'exécute dans son cadre isolé, comme
 * n'importe quel autre. Servir directement du HTML écrit par un inconnu ferait
 * de cette adresse un hébergement de pages piégées — et l'Établi vit déjà sur
 * son propre domaine précisément pour que ce genre de question reste loin des
 * comptes de l'atelier.
 *
 * Pas de compte, donc pas d'identité : un lien qu'on garde, une clef qui
 * autorise à réécrire. La clef ne voyage jamais avec le lien.
 */
interface Rangement {
    get(clef: string, sorte: 'json'): Promise<unknown>;
    put(clef: string, valeur: string): Promise<void>;
}
interface ContextePages {
    readonly request: Request;
    readonly params: Record<string, string | string[]>;
    readonly env: {
        readonly PROJETS?: Rangement;
    };
}
export declare function onRequest(contexte: ContextePages): Promise<Response>;
export {};
