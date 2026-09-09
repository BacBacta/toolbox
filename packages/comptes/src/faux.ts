import type { Amorce, DemandePaiement, Fournisseur, Rappel } from './paiement.js'

/**
 * Un fournisseur qui n'encaisse rien, et qui se comporte comme s'il encaissait.
 *
 * Il existe pour que tout le reste soit fini avant qu'un compte marchand ne le
 * soit : ouvrir un compte CamPay ou Fapshi demande des pièces et du délai
 * (§ 7, phase 0), et rien de ce qui est écrit autour du paiement n'a besoin
 * d'attendre ça.
 *
 * Il **signe vraiment** ses rappels. Un faux qui répondrait « oui » à tout
 * n'éprouverait pas la seule chose qui compte vraiment ici : sans vérification
 * de signature, n'importe qui s'offre un abonnement avec `curl`. Le jour où un
 * vrai fournisseur arrive, c'est le même chemin qui s'exécute.
 */

const ENTETE_SIGNATURE = 'x-signature-a237'

function hex(octets: Uint8Array): string {
  return Array.from(octets, (o) => o.toString(16).padStart(2, '0')).join('')
}

async function clef(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

/** La signature d'un corps. Publique : le faux fournisseur s'en sert aussi. */
export async function signer(corps: string, secret: string): Promise<string> {
  const octets = await crypto.subtle.sign('HMAC', await clef(secret), new TextEncoder().encode(corps))
  return hex(new Uint8Array(octets))
}

/**
 * Comparaison à durée constante.
 *
 * Un `===` sur des chaînes s'arrête au premier caractère qui diffère, et le
 * temps que ça prend dit combien de caractères étaient bons. On compare donc
 * tout, toujours.
 */
export function memeSignature(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let ecart = 0
  for (let i = 0; i < a.length; i++) ecart |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return ecart === 0
}

export function fauxFournisseur(secret: string): Fournisseur {
  return {
    nom: 'faux',

    demarrer(demande: DemandePaiement): Promise<Amorce> {
      /*
       * Un vrai fournisseur pousse une demande de confirmation sur le
       * téléphone. Celui-ci ne pousse rien : il rend la référence, et c'est le
       * rappel — déclenché à la main — qui joue la suite.
       */
      return Promise.resolve({
        reference: demande.reference,
        consigne:
          `Fournisseur d’essai : aucun paiement n’est demandé sur ${demande.telephone}. ` +
          'Le rappel se déclenche à la main.',
      })
    },

    async lireRappel(corps: string, entetes: Headers): Promise<Rappel | null> {
      const donnee = entetes.get(ENTETE_SIGNATURE)
      if (donnee === null) return null
      if (!memeSignature(donnee, await signer(corps, secret))) return null

      let lu: unknown
      try {
        lu = JSON.parse(corps)
      } catch {
        return null
      }
      const r = lu as { reference?: unknown; reussi?: unknown; montantXaf?: unknown }
      if (typeof r.reference !== 'string' || typeof r.reussi !== 'boolean') return null
      if (typeof r.montantXaf !== 'number' || !Number.isFinite(r.montantXaf)) return null
      return { reference: r.reference, reussi: r.reussi, montantXaf: r.montantXaf }
    },
  }
}

export { ENTETE_SIGNATURE }
