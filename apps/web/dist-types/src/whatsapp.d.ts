/**
 * Les liens `wa.me`.
 *
 * C'est tout ce que le produit emploie de WhatsApp, et c'est délibéré
 * (BRIEF.md § 5) : l'API Groups plafonne à huit participants et exige un
 * compte officiel, l'Embedded Signup n'est pas ouvert au Cameroun, et une
 * relance envoyée par une plateforme n'a de toute façon aucune autorité dans un
 * njangi. `wa.me` est gratuit, sans compte, sans validation de gabarit — et le
 * message part du pouce du propriétaire (invariant § 2.4).
 */
/** Indicatif du Cameroun. */
export declare const INDICATIF_CM = "237";
/**
 * Met un numéro au format international attendu par `wa.me`.
 *
 * Accepte ce qu'un utilisateur tape vraiment : espaces, tirets, points, `+`,
 * `00`, avec ou sans indicatif. Rend `null` si rien d'exploitable n'en sort —
 * mieux vaut proposer de copier le message que d'ouvrir WhatsApp sur un
 * mauvais numéro.
 */
export declare function numeroInternational(brut: string): string | null;
/** Le lien qui ouvre WhatsApp avec le message déjà écrit. */
export declare function lienWhatsApp(tel: string, message: string): string | null;
