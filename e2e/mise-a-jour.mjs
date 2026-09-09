/**
 * Le scénario qu'aucun test unitaire ne voit : une version déjà installée,
 * puis une nouvelle mise en ligne.
 *
 * Il a échoué en production. Le service worker portait une version écrite en
 * dur, donc `sw.js` était identique d'une construction à l'autre ; le
 * navigateur ne le réinstallait jamais, ne purgeait jamais son cache, et
 * servait indéfiniment la coquille d'une version précédente — celle qui nomme
 * tous les autres fichiers. L'application ne pouvait plus se mettre à jour
 * chez quiconque l'avait ouverte une fois. Neuf cent trente-neuf tests
 * passaient, et un utilisateur a dit « je ne vois pas les changements ».
 *
 * Le seul moyen de le vérifier est de le jouer : deux constructions, un vrai
 * navigateur, un vrai service worker.
 *
 *   node e2e/mise-a-jour.mjs
 *
 * Playwright n'est pas une dépendance du dépôt (§ 8, plafond de dépendances) :
 * ce script se lance à la main, depuis un dossier où `playwright-core` est
 * installé, en lui passant son chemin par PLAYWRIGHT.
 */
import { execSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { extname, join, normalize } from 'node:path'

const RACINE = new URL('..', import.meta.url).pathname
const DIST = join(RACINE, 'apps/web/dist')
const CHROME = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright-core')

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
}

/** Un témoin qu'on ne peut pas confondre avec autre chose. */
const TEMOIN = '.temoin-de-mise-a-jour { color: rgb(1, 2, 3) }'
const CSS = join(RACINE, 'apps/web/src/app.css')

function construire() {
  execSync('pnpm -s build', { cwd: RACINE, stdio: 'ignore' })
}

function publier(dossier) {
  if (dossier !== null) rmSync(dossier, { recursive: true, force: true })
  const neuf = mkdtempSync(join(tmpdir(), 'a237-'))
  cpSync(DIST, neuf, { recursive: true })
  return neuf
}

// Une base propre : un `dist` laissé par un essai précédent ferait croire que
// la version d'avant contenait déjà la nouveauté.
execSync(`git checkout -- ${CSS}`, { cwd: RACINE })
construire()
let servi = publier(null)

const serveur = createServer((req, res) => {
  const chemin = decodeURIComponent((req.url ?? '/').split('?')[0])
  let f = join(servi, normalize(chemin))
  try {
    if (statSync(f).isDirectory()) f = join(f, 'index.html')
  } catch {
    f = join(servi, 'index.html')
  }
  // Lire avant d'écrire l'entête : sinon un fichier absent laisse une réponse
  // 200 déjà commencée, et le serveur meurt au lieu de répondre 404.
  let corps
  try {
    corps = readFileSync(f)
  } catch {
    res.writeHead(404).end('non')
    return
  }
  res.writeHead(200, {
    'Content-Type': TYPES[extname(f)] ?? 'application/octet-stream',
    // Les en-têtes de `vercel.json` : ce sont elles qui décident si le
    // navigateur relit `sw.js`.
    'Cache-Control': chemin.startsWith('/assets/')
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=0, must-revalidate',
  })
  res.end(corps)
})
await new Promise((r) => serveur.listen(5198, '127.0.0.1', r))
const BASE = 'http://127.0.0.1:5198'

const navigateur = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] })
const page = await (await navigateur.newContext({ viewport: { width: 390, height: 844 } })).newPage()
page.setDefaultTimeout(20000)

let echecs = 0
const verifier = (bon, quoi) => {
  console.log(`${bon ? 'OK ' : 'ÉCHEC'}  ${quoi}`)
  if (!bon) echecs++
}

// ── la visite qui installe la version d'avant ──────────────────────────────
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
const avant = await page.evaluate(() => caches.keys())
verifier(avant.length === 1, `la version d’avant est installée — ${avant.join(', ')}`)

// ── on met en ligne une version modifiée ───────────────────────────────────
execSync(`printf '\\n${TEMOIN}\\n' >> ${CSS}`, { cwd: RACINE })
construire()
servi = publier(servi)
execSync(`git checkout -- ${CSS}`, { cwd: RACINE })

// ── l'utilisateur rouvre l'application ─────────────────────────────────────
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(6000)

const apres = await page.evaluate(() => caches.keys())
verifier(apres.length === 1, `un seul cache subsiste — ${apres.join(', ')}`)
verifier(avant[0] !== apres[0], 'le cache a changé de nom : celui d’avant est purgé')

const aLaNouveaute = await page.evaluate(() =>
  [...document.styleSheets].some((f) => {
    try {
      return [...f.cssRules].some((r) => r.cssText.includes('temoin-de-mise-a-jour'))
    } catch {
      return false
    }
  }),
)
verifier(aLaNouveaute, 'la page sert la nouvelle version, sans qu’on ait rien fait')

// ── et le mode avion marche toujours ───────────────────────────────────────
await page.context().setOffline(true)
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
verifier((await page.textContent('body')).includes('Atelier 237'), 'l’application s’ouvre encore en mode avion')
await page.context().setOffline(false)

// On laisse le dépôt et `dist` dans l'état d'avant l'essai.
execSync(`git checkout -- ${CSS}`, { cwd: RACINE })
construire()
rmSync(servi, { recursive: true, force: true })

await navigateur.close()
serveur.close()
console.log(echecs === 0 ? 'FIN — tout passe' : `FIN — ${echecs} échec(s)`)
process.exit(echecs === 0 ? 0 : 1)
