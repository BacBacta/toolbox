/**
 * Le proxy IA (§ 3, « Appeler l'IA »).
 *
 * Il existe pour une seule raison : **aucune clef d'API dans le client, jamais**
 * (invariant § 2.8). La clef est lue ici, dans l'environnement de la fonction,
 * et ne traverse pas la frontière. Le client ne reçoit qu'une configuration
 * déjà validée — jamais de HTML, jamais de code (§ 3, point 5).
 *
 * Le brief place ce proxy dans le Worker Cloudflare, au même endroit que le
 * webhook de paiement et la page de lecture. On le met d'abord ici parce que
 * l'application y est déjà déployée : toute la logique vit dans `@a237/ia`,
 * pur et testé, et ce fichier n'est que la plomberie — le déménager plus tard
 * ne déplacera que ces cinquante lignes.
 *
 * **Ce qui manque encore, et qu'il faut savoir.** Le brief exige un quota par
 * compte (`credits > 0`, sinon 402) et un journal des coûts dans `ai_calls`.
 * Les comptes vivent dans D1, qui n'existe pas encore. En attendant, le
 * garde-fou est grossier mais explicite : la fonction refuse de servir tant
 * qu'on ne l'a pas **ouverte à la main**. Poser la clef ne suffit donc pas à
 * ouvrir un robinet qui coûte de l'argent à chaque appel ; il faut le vouloir.
 */
interface RequeteEntrante {
    readonly method?: string;
    readonly body?: unknown;
}
interface ReponseSortante {
    status: (code: number) => ReponseSortante;
    json: (corps: unknown) => void;
}
export default function handler(req: RequeteEntrante, res: ReponseSortante): Promise<void>;
export {};
