/**
 * Un compte, un abonnement, et un rappel rejoué — par le vrai chemin HTTP.
 *
 * Le § 7 fait de l'idempotence le critère d'arrêt de la phase 3 : « rejouer le
 * même webhook trois fois ne change rien, prouvé par un test ». Les essais
 * unitaires le prouvent sur la logique et sur la base ; celui-ci le prouve sur
 * la chaîne entière — le Worker, sa liaison D1, la vérification de signature,
 * et le compte tel que l'écran le lit ensuite.
 *
 * Ce qu'il vérifie et qu'aucun essai unitaire ne voit : que les routes
 * attrape-tout de Pages répondent bien. Rollup assainit les crochets d'un nom
 * de sortie, et `functions/api/pay/[[chemin]].js` sortait `__chemin__.js` — la
 * construction réussit et **toutes les routes rendent 404**.
 *
 *   pnpm build
 *   printf 'A237_PAIEMENT_SECRET=secret-local-essai\n' > .dev.vars
 *   wrangler d1 execute COMPTES --local --file=packages/comptes/migrations/0001-comptes.sql
 *   wrangler pages dev --port 8798 --ip 127.0.0.1
 *   node e2e/comptes.mjs
 *
 * Il n'a besoin ni de navigateur ni de Playwright : tout se joue en requêtes.
 * La référence d'un paiement ne sort jamais de la base — c'est voulu — alors on
 * l'y lit, comme le fournisseur la connaîtrait.
 */
import { createHmac } from 'node:crypto'
import { execSync } from 'node:child_process'

const BASE = process.env.BASE ?? 'http://127.0.0.1:8798'
const SECRET = process.env.A237_PAIEMENT_SECRET ?? 'secret-local-essai'
const RACINE = new URL('..', import.meta.url).pathname
const JETON = Array.from({length:32},()=>'0123456789abcdef'[Math.floor(Math.random()*16)]).join('')
const AUTRE = Array.from({length:32},()=>'0123456789abcdef'[Math.floor(Math.random()*16)]).join('')
const A = (j = JETON) => ({ authorization: `Appareil ${j}`, 'content-type': 'application/json' })
// Un serveur absent doit se dire, pas se deviner.
try {
  await fetch(BASE, { method: 'HEAD' })
} catch {
  console.log(`KO  aucun serveur sur ${BASE} — lancer \`wrangler pages dev --port 8798\``)
  process.exit(1)
}

let ko = 0
const dit = (bon, quoi, d='') => { console.log(`${bon?'OK ':'KO '} ${quoi}${d?` — ${d}`:''}`); if(!bon) ko++ }
const WRANGLER = process.env.WRANGLER ?? 'wrangler'
const refDe = (id) => {
  const sortie = execSync(
    `${WRANGLER} d1 execute COMPTES --local --command "SELECT reference FROM paiements WHERE id='${id}'"`,
    { cwd: RACINE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  )
  return (sortie.match(/"reference": "([^"]+)"/) ?? [])[1]
}

const etat0 = await (await fetch(`${BASE}/api/compte`, { headers: A() })).json()
dit(etat0.plan === 'essai' && etat0.credits === 5, 'compte ouvert en essai, sans inscription', JSON.stringify(etat0))

const d = await fetch(`${BASE}/api/pay/demarrer`, { method:'POST', headers: A(), body: JSON.stringify({ telephone: '6 99 41 27 08' }) })
const amorce = await d.json()
dit(d.status === 200 && amorce.montantXaf === 1000, 'paiement démarré', `${amorce.montantXaf} F`)
dit(!JSON.stringify(amorce).includes('reference'), 'la référence ne part pas au client')

const suivi0 = await (await fetch(`${BASE}/api/pay/${amorce.id}`, { headers: A() })).json()
dit(suivi0.etat === 'attente', 'en attente avant le rappel')
const vole = await fetch(`${BASE}/api/pay/${amorce.id}`, { headers: A(AUTRE) })
dit(vole.status === 404, 'et on ne lit pas le paiement d’un autre', String(vole.status))

const ref = refDe(amorce.id)
const corps = JSON.stringify({ reference: ref, reussi: true, montantXaf: 1000 })
const sig = createHmac('sha256', SECRET).update(corps).digest('hex')

const nu = await fetch(`${BASE}/api/pay/rappel`, { method:'POST', headers:{'content-type':'application/json'}, body: corps })
dit(nu.status === 401, 'un rappel non signé est refusé', String(nu.status))
const fausse = await fetch(`${BASE}/api/pay/rappel`, { method:'POST', headers:{'content-type':'application/json','x-signature-a237':'0'.repeat(64)}, body: corps })
dit(fausse.status === 401, 'une signature inventée aussi')

const r1 = await fetch(`${BASE}/api/pay/rappel`, { method:'POST', headers:{'content-type':'application/json','x-signature-a237':sig}, body: corps })
dit(r1.status === 200 && (await r1.json()).applique === true, 'un rappel signé applique')

const apres = await (await fetch(`${BASE}/api/compte`, { headers: A() })).json()
dit(apres.plan === 'atelier' && apres.credits === 40, 'le compte est abonné', JSON.stringify(apres))

for (let i = 0; i < 3; i++) await fetch(`${BASE}/api/pay/rappel`, { method:'POST', headers:{'content-type':'application/json','x-signature-a237':sig}, body: corps })
const rejeu = await (await fetch(`${BASE}/api/compte`, { headers: A() })).json()
dit(rejeu.expire === apres.expire && rejeu.credits === 40, 'rejoué trois fois, rien ne bouge', JSON.stringify(rejeu))

// la récupération
const { code } = await (await fetch(`${BASE}/api/compte/code`, { method:'POST', headers: A() })).json()
dit(/^[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/.test(code), 'un code de récupération est donné', code)
const repris = await fetch(`${BASE}/api/compte/reprendre`, { method:'POST', headers: A(AUTRE), body: JSON.stringify({ code }) })
const vu = await repris.json()
dit(repris.status === 200 && vu.plan === 'atelier', 'un autre appareil retrouve l’abonnement', JSON.stringify(vu))
const faux = await fetch(`${BASE}/api/compte/reprendre`, { method:'POST', headers: A(AUTRE), body: JSON.stringify({ code: 'A2B3-C4D5-E6F7-G8H9' }) })
dit(faux.status === 404, 'un code inconnu ne mène nulle part')

console.log(ko === 0 ? 'FIN — tout passe' : `FIN — ${ko} échec(s)`)
process.exit(ko === 0 ? 0 : 1)
