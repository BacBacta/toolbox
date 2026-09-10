/**
 * Le scénario que le brief décrit en une phrase (§ 2.7) et qu'aucun test
 * unitaire ne joue : on travaille sans réseau, on demande à diffuser, et la
 * diffusion part toute seule quand le réseau revient.
 *
 * Il a échoué. `creerOutil` pose `version: 0`, et le serveur exigeait une
 * version supérieure ou égale à 1 : publier un outil **qu'on vient de créer**
 * — c'est-à-dire le cas normal — recevait un 409, la file abandonnait
 * l'entrée, et l'utilisateur n'apprenait rien. Les tests unitaires passaient :
 * ils composent leurs propres états, où la version n'est jamais zéro.
 *
 * Le second piège est invisible autrement : le service worker servait la
 * coquille de l'application pour `/d/…`. Le destinataire d'un lien, s'il avait
 * l'application installée, voyait l'accueil au lieu du document — et l'envoyeur
 * n'en savait rien. D'où la vérification de la page lue, sur une chaîne que
 * seule la page publiée porte.
 *
 *   node e2e/hors-ligne.mjs
 *
 * Il lui faut le Worker et son KV, donc un serveur déjà lancé :
 *
 *   pnpm build && wrangler pages dev --port 8798 --ip 127.0.0.1
 *
 * Playwright n'est pas une dépendance du dépôt (§ 8, plafond de dépendances) :
 * son chemin se passe par PLAYWRIGHT.
 */
const BASE = process.env.BASE ?? 'http://127.0.0.1:8798'
const CHROME = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright-core')

let echecs = 0
const verifier = (bon, quoi) => {
  console.log(`${bon ? 'OK ' : 'ÉCHEC'}  ${quoi}`)
  if (!bon) echecs++
}

const navigateur = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] })
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 } })
const page = await contexte.newPage()
page.setDefaultTimeout(20000)

const envois = []
page.on('request', (r) => {
  if (r.url().includes('/api/publier')) envois.push('→')
})
page.on('response', (r) => {
  if (r.url().includes('/api/publier')) envois.push(String(r.status()))
})

/** Ce que le navigateur a vraiment gardé : les outils et la file. */
const lire = () =>
  page.evaluate(async () => {
    const tout = (base, magasin) =>
      new Promise((res) => {
        const q = indexedDB.open(base)
        q.onsuccess = () => {
          const d = q.result.transaction(magasin, 'readonly').objectStore(magasin).getAll()
          d.onsuccess = () => res(d.result)
          d.onerror = () => res([])
        }
        q.onerror = () => res([])
      })
    return {
      outils: (await tout('atelier237-outils', 'outils')).map((o) => ({ version: o.version, lien: o.lien ?? null })),
      file: (await tout('atelier237-file', 'file')).length,
    }
  })

// ── on installe l'application pendant qu'il y a du réseau ──────────────────
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
await page.waitForTimeout(1500)

// ── plus de réseau : on crée un outil et on demande à le diffuser ──────────
await contexte.setOffline(true)
await page.reload({ waitUntil: 'domcontentloaded' })
verifier((await page.textContent('body')).includes('Atelier 237'), 'l’application s’ouvre sans réseau')

await page.fill('#demande', 'un carnet de njangi')
await page.waitForTimeout(500)
await page.locator('.atelier-option.principale').click()
await page.waitForTimeout(1500)
await page.locator('.outil-action.principale', { hasText: 'Diffuser' }).first().click()
await page.waitForTimeout(2500)

const coupe = await lire()
verifier(coupe.file === 1, 'la diffusion demandée sans réseau entre en file')
verifier(coupe.outils[0]?.lien === null, 'aucune adresse n’est écrite tant que rien n’est publié')
verifier(coupe.outils[0]?.version === 0, 'l’outil qu’on vient de créer est bien en version zéro')

// ── le réseau revient : on ne touche à rien, on regarde ────────────────────
// Pas de rechargement ici : il annulerait l'envoi en cours et on croirait à un
// échec de la file alors que c'est la vérification qui l'a interrompue.
envois.length = 0
await contexte.setOffline(false)
let etat = coupe
for (let i = 0; i < 20 && !(etat.file === 0 && etat.outils[0]?.lien); i++) {
  await page.waitForTimeout(1000)
  etat = await lire()
}
const lien = etat.outils[0]?.lien ?? null
verifier(lien !== null, `la file part seule au retour du réseau — ${lien ?? 'rien'}`)
verifier(etat.file === 0, 'la file est vidée')
verifier(envois.includes('200'), `le serveur a accepté — ${envois.join(' ') || 'aucun envoi'}`)

// ── le lien mène-t-il au document, ou à l'accueil de l'application ? ───────
if (lien !== null) {
  const lecture = await contexte.newPage()
  const reponse = await lecture.goto(`${BASE}/d/${lien}`, { waitUntil: 'domcontentloaded' })
  const corps = await lecture.textContent('body')
  verifier(reponse.status() === 200, `la page publiée répond — ${reponse.status()}`)
  verifier(corps.includes('Document en lecture seule'), 'le lien sert le document, pas la coquille de l’application')
}

// ── et la file ne recommence pas toute seule ───────────────────────────────
envois.length = 0
await page.evaluate(() => window.dispatchEvent(new Event('online')))
await page.waitForTimeout(3000)
verifier(envois.length === 0, `une file vide ne republie rien — ${envois.join(' ') || 'aucun envoi'}`)

await navigateur.close()
console.log(echecs === 0 ? 'FIN — tout passe' : `FIN — ${echecs} échec(s)`)
process.exit(echecs === 0 ? 0 : 1)
