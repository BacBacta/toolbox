import { createServer } from 'node:http'
import { readFileSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { entetesDe } from './entetes.mjs'

// playwright-core est installé à part : voir README.md. Son chemin se passe
// par PLAYWRIGHT, comme pour les trois autres scripts.
const CHROME = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright-core')

// Le dépôt se trouve tout seul : un chemin écrit en dur ne marchait que sur
// la machine où ce script a été écrit.
const DIST = join(new URL('..', import.meta.url).pathname, 'apps/web/dist')
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
}

const serveur = createServer((req, res) => {
  const chemin = decodeURIComponent((req.url ?? '/').split('?')[0])
  /*
   * Cloudflare Pages redirige `/index.html` vers `/` en 308, et ce détail
   * décide du mode avion : `cache.addAll` suit la redirection, obtient une
   * réponse marquée `redirected`, et `Cache.put` la refuse. L'installation du
   * service worker échoue alors en entier — plus de hors-ligne, sans un mot.
   *
   * Le serveur d'ici le reproduit, sinon la garde ne garde rien : servir le
   * fichier directement laissait passer exactement ce qui casse en production.
   */
  if (chemin === '/index.html') {
    res.writeHead(308, { Location: '/' })
    res.end()
    return
  }
  let fichier = join(DIST, normalize(chemin))
  try {
    if (statSync(fichier).isDirectory()) fichier = join(fichier, 'index.html')
  } catch {
    fichier = join(DIST, 'index.html')
  }
  try {
    const corps = readFileSync(fichier)
    // Les en-têtes viennent de `_headers`, le fichier que Pages servira : les
    // recopier ici en ferait une seconde source, et c'est celle du serveur qui
    // décide.
    res.writeHead(200, {
      'Content-Type': TYPES[extname(fichier)] ?? 'application/octet-stream',
      ...entetesDe(DIST, chemin),
    })
    res.end(corps)
  } catch {
    res.writeHead(404).end('non trouvé')
  }
})

await new Promise((r) => serveur.listen(5199, '127.0.0.1', r))
const BASE = 'http://127.0.0.1:5199'

const navigateur = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] })
// Un Android d'entrée de gamme : petit écran, doigt.
const contexte = await navigateur.newContext({
  viewport: { width: 360, height: 740 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
})
const page = await contexte.newPage()
page.setDefaultTimeout(8000)
const erreurs = []
page.on('pageerror', (e) => erreurs.push(String(e)))
page.on('console', (m) => {
  if (m.type() === 'error') erreurs.push(`console: ${m.text()}`)
})

function dit(quoi, ok, detail = '') {
  process.stdout.write(`${ok ? 'OK ' : 'KO '} ${quoi}${detail ? ` — ${detail}` : ''}\n`)
  if (!ok) process.exitCode = 1
}

/** Un contrôle qui échoue ne doit pas bloquer les suivants. */
async function essaie(quoi, travail, detail = () => '') {
  try {
    const resultat = await travail()
    dit(quoi, resultat === true || resultat === undefined, detail(resultat))
    return resultat
  } catch (cause) {
    dit(quoi, false, String(cause).split('\n')[0])
    return null
  }
}

await page.goto(BASE, { waitUntil: 'networkidle' })
dit('la page s’ouvre', (await page.title()) === 'Atelier 237')
dit("l'accueil s'affiche", await page.getByText('De quoi as-tu besoin ?').isVisible())

/*
 * L'étage 1 de bout en bout : la phrase est lue, l'outil s'ouvre, et ce que la
 * phrase disait y est déjà écrit. Zéro jeton, aucun réseau — c'est le chemin
 * que sept demandes sur dix doivent prendre (§ 4).
 */
await page.fill('#demande', 'njangi du quartier, 20 000 F par mois')
await page.waitForTimeout(120)
dit(
  'la demande est comprise',
  (await page.locator('.atelier-option.principale').count()) === 1,
)
dit(
  'ce qui a été compris est montré avant d’ouvrir',
  (await page.locator('.atelier-option.principale').innerText())
    .replace(/\s/g, ' ')
    .includes('20 000 F'),
)

await page.locator('.atelier-option.principale').click()
await page.waitForSelector('text=Aucun membre pour l’instant', { timeout: 5000 })
dit('l’outil s’ouvre', true)

// La cotisation et la période viennent de la phrase, pas des valeurs par défaut.
// Les espaces des montants sont insécables (U+00A0) : on compare sur du texte
// aplati, sinon on teste la mise en forme au lieu du contenu.
const soustitre = (await page.locator('.outil-titre span').innerText()).replace(/\s/g, ' ')
dit(
  'l’outil est garni de ce que la phrase disait',
  soustitre.includes('20 000 F') && soustitre.includes('mois'),
  soustitre,
)

// Ajouter deux membres.
await page.locator('[role="tab"]', { hasText: 'Membres' }).click()
for (const [nom, tel] of [['Adèle', '699445566'], ['Serge', '699112233']]) {
  await page.fill('[aria-label="Nom du membre"]', nom)
  if (tel) await page.fill('[aria-label="Téléphone du membre, facultatif"]', tel)
  await page.getByText('Ajouter au carnet').click()
  await page.waitForTimeout(120)
}
await page.locator('[role="tab"]', { hasText: 'Cagnotte' }).click()
dit('les membres sont là', (await page.locator('.outil-rangee').count()) === 2)

// Marquer un versement.
await page.locator('[aria-label="Adèle : doit sa part"]').click()
await page.waitForTimeout(120)
dit('le versement est enregistré', await page.locator('[aria-label="Adèle : a versé"]').isVisible())
dit('la barre avance', (await page.locator('[role="progressbar"]').getAttribute('aria-valuenow')) === '50')

// Diffuser : la carte doit être dessinée pour de vrai.
await page.getByText('Diffuser', { exact: true }).click()
await page.waitForSelector('canvas', { timeout: 5000 })
await page.waitForTimeout(400)
const carte = await page.evaluate(() => {
  const c = document.querySelector('canvas')
  if (!c) return null
  const ctx = c.getContext('2d')
  const pixels = ctx.getImageData(0, 0, c.width, c.height).data
  const couleurs = new Set()
  for (let i = 0; i < pixels.length; i += 4000) {
    couleurs.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`)
  }
  return { largeur: c.width, hauteur: c.height, couleurs: couleurs.size, url: c.toDataURL().length }
})
dit('la carte fait 1080 de large', carte?.largeur === 1080, `${carte?.largeur}×${carte?.hauteur}`)
dit('la carte est vraiment dessinée', (carte?.couleurs ?? 0) > 3, `${carte?.couleurs} teintes échantillonnées`)
dit('le PNG pèse moins de 200 Ko', (carte?.url ?? 0) * 0.75 < 200 * 1024,
  `${Math.round(((carte?.url ?? 0) * 0.75) / 1024)} Ko`)
// Adèle a versé : elle n'est plus relancée. Serge, si.
const relances = await page.locator('a.outil-bascule').count()
dit('une seule relance, celle du retardataire', relances === 1, relances + ' relance(s)')
const href = relances > 0 ? await page.locator('a.outil-bascule').first().getAttribute('href') : ''
dit('la relance ouvre wa.me sur le bon numero', (href ?? '').startsWith('https://wa.me/237699112233?text='))
dit('le message est deja ecrit', decodeURIComponent(href ?? '').includes('Serge'))

// Le service worker, puis le mode avion.
await essaie('le service worker est actif', async () => {
  const etat = await page.evaluate(async () => {
    const attente = new Promise((r) => setTimeout(() => r('trop lent'), 6000))
    const pret = navigator.serviceWorker.ready.then((reg) => reg.active?.state ?? 'absent')
    return Promise.race([pret, attente])
  })
  return etat === 'activated' ? true : etat
}, (r) => (r === true ? '' : String(r)))

await essaie('le cache est rempli', async () => {
  const n = await page.evaluate(async () => {
    const noms = await caches.keys()
    if (noms.length === 0) return 0
    const cache = await caches.open(noms[0])
    return (await cache.keys()).length
  })
  return n > 3 ? true : n
}, (r) => (r === true ? '' : `${r} entrées`))

await essaie("l'app s'ouvre en mode avion", async () => {
  await contexte.setOffline(true)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#demande', { timeout: 8000 })
  return true
})

await essaie('les outils sont toujours là hors ligne', async () => {
  const n = await page.locator('.outil-rangee').count()
  return n === 1 ? true : n
}, (r) => (r === true ? '' : `${r} outil(s)`))

await essaie("un outil s'ouvre hors ligne", async () => {
  await page.locator('.lien-outil').first().click()
  await page.waitForSelector('text=Adèle', { timeout: 8000 })
  return true
})

// ── un registre décrit par ses colonnes, pour éprouver l'autre moteur ──
await contexte.setOffline(false)
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.fill('#demande', 'liste de prix de la boutique')
await page.waitForTimeout(120)
// La grille ne filtre plus : c'est la proposition de l'atelier qui ouvre.
await page.locator('.atelier-option.principale').click()
await page.waitForSelector('text=Aucun article', { timeout: 20000 })
dit('un registre de liste s’ouvre', true)

await page.getByText('Ajouter un article', { exact: true }).first().click()
await page.fill('[aria-label="Article"]', 'Sac de riz 25 kg')
await page.fill('[aria-label="Prix (F CFA)"]', '18 500')
await page.locator('[aria-label="Disponible"]').check()
await page.getByText('Ajouter un article', { exact: true }).first().click()
await page.waitForTimeout(200)
dit('la ligne est enregistrée', await page.getByText('Sac de riz 25 kg').isVisible())
dit('le montant est mis en forme', (await page.locator('.n2').first().textContent())?.includes('18'))
dit('la barre suit la disponibilité',
  (await page.locator('[role="progressbar"]').getAttribute('aria-valuenow')) === '100')

await page.locator('[aria-label="Sac de riz 25 kg : disponible"]').click()
await page.waitForTimeout(200)
dit('la bascule répond',
  (await page.locator('[role="progressbar"]').getAttribute('aria-valuenow')) === '0')

await page.getByText('Diffuser', { exact: true }).click()
await page.waitForSelector('canvas', { timeout: 20000 })
await page.waitForTimeout(400)
const carteListe = await page.evaluate(() => {
  const c = document.querySelector('canvas')
  return c ? { l: c.width, h: c.height } : null
})
dit('sa carte se dessine aussi', carteListe?.l === 1080, `${carteListe?.l}×${carteListe?.h}`)

/*
 * Rien ne déborde de sa boîte, à la largeur que le brief vise.
 *
 * Trois cent soixante pixels : c'est écrit dans le brief, répété dans les
 * commentaires, et personne ne l'avait mesuré. Une capture d'un vrai téléphone
 * a montré « Reconnaissance de dette » coupé net au bord de sa carte — et à
 * 360, « Attestation » débordait aussi, un seul mot sur une carte d'outil.
 *
 * Un essai unitaire ne peut pas voir ça : happy-dom ne fait pas de mise en
 * page. Il n'y a que le vrai navigateur, à la vraie largeur, et c'est le seul
 * endroit du dépôt où poser cette garde.
 */
await page.goto(BASE, { waitUntil: 'networkidle' })
const deborde = await page.evaluate(() =>
  [...document.querySelectorAll('.app *')]
    .filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'auto')
    .map((e) => `${e.className || e.tagName} « ${(e.textContent || '').trim().slice(0, 30)} »`))
dit('rien ne déborde de sa boîte à 360 px', deborde.length === 0, deborde.slice(0, 4).join(' | '))

dit('aucune erreur de page', erreurs.length === 0, erreurs.slice(0, 3).join(' | '))

await navigateur.close()
serveur.close()
process.stdout.write('FIN\n')
