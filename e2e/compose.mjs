/**
 * Un registre composé par le modèle, ouvert dans un vrai navigateur.
 *
 * C'est le seul maillon que les tests unitaires ne voient pas : la
 * configuration vient du réseau, traverse le stockage, et c'est
 * `RegistreListe` — écrit à la main — qui la dessine. Si le pont casse
 * quelque part, il casse ici.
 *
 * La réponse est **une vraie sortie de production**, capturée telle quelle.
 * Une réponse inventée testerait ce que j'imagine que le modèle produit ; sa
 * première colonne est de type `nombre`, ce qui a longtemps été interdit et
 * faisait échouer deux générations sur dix.
 *
 *   PLAYWRIGHT=/chemin/vers/playwright-core/index.mjs node e2e/compose.mjs
 */
import { readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
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

/** Capturé en production le 9 septembre 2026, sur « un carnet pour mes poules ». */
const REPONSE = {
  registre: {
    titre: 'Poules',
    kicker: 'POULES',
    titreNom: 'Nom de la poule',
    colonnes: [
      { clef: 'oeufsParJour', titre: 'Oeufs pondus', type: 'nombre' },
      { clef: 'oeufsVendus', titre: 'Oeufs vendus', type: 'nombre' },
    ],
    libelleVide: 'Tu n’as pas encore de poules enregistrées.',
    libelleAjout: 'Ajouter une poule',
    relancesVides: 'Ce carnet ne se relance pas. Il sert juste à suivre tes poules.',
    total: {
      type: 'difference',
      plus: 'oeufsParJour',
      moins: 'oeufsVendus',
      libelle: 'Oeufs restants',
      unite: '',
    },
  },
  fcfa: 0.12,
}

const serveur = createServer((req, res) => {
  const chemin = decodeURIComponent((req.url ?? '/').split('?')[0])
  let f = join(DIST, normalize(chemin))
  try {
    if (statSync(f).isDirectory()) f = join(f, 'index.html')
  } catch {
    f = join(DIST, 'index.html')
  }
  let corps
  try {
    corps = readFileSync(f)
  } catch {
    res.writeHead(404).end('non')
    return
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(f)] ?? 'application/octet-stream' })
  res.end(corps)
})
await new Promise((r) => serveur.listen(5200, '127.0.0.1', r))
const BASE = 'http://127.0.0.1:5200'

const navigateur = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] })
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 } })

/** Un refus, capturé en production sur « je veux un site internet ». */
const REFUS = {
  impossible:
    'Je ne peux pas créer un site internet. Je suis un outil de gestion de registres.',
  fcfa: 0.08,
}

/*
 * Le proxy est côté serveur : on le remplace ici par ses vraies réponses. La
 * demande décide laquelle — c'est ce qui permet d'éprouver le refus dans le
 * même parcours que la composition.
 */
let appels = 0
await contexte.route('**/api/ai', async (route) => {
  appels++
  const { demande } = JSON.parse(route.request().postData() ?? '{}')
  const corps = String(demande).includes('site internet') ? REFUS : REPONSE
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corps) })
})

const page = await contexte.newPage()
page.setDefaultTimeout(15000)
const erreurs = []
page.on('pageerror', (e) => erreurs.push(String(e)))

let echecs = 0
const dit = (bon, quoi, detail = '') => {
  console.log(`${bon ? 'OK ' : 'KO '} ${quoi}${detail === '' ? '' : ` — ${detail}`}`)
  if (!bon) echecs++
}

await page.goto(BASE, { waitUntil: 'networkidle' })

// L'étage 1 ne connaît pas ce registre : il doit proposer de composer.
await page.fill('#demande', 'un carnet pour mes poules, oeufs pondus et vendus')
await page.waitForTimeout(150)
dit(appels === 0, 'la composition ne part pas toute seule')
dit(
  await page.getByText('Compose-le pour moi').isVisible(),
  'l’étage 1 admet qu’il ne sait pas, et propose',
)

await page.getByText('Compose-le pour moi').click()
await page.waitForSelector('text=Tu n’as pas encore de poules', { timeout: 10000 })
dit(appels === 1, 'un seul appel au proxy', `${appels}`)
dit(true, 'le registre composé s’ouvre')

// La première colonne est de type `nombre` : elle doit quand même nommer la ligne.
await page.getByText('Ajouter une poule', { exact: true }).first().click()
await page.fill('[aria-label="Oeufs pondus"]', '12')
await page.fill('[aria-label="Oeufs vendus"]', '8')
await page.getByText('Ajouter une poule', { exact: true }).first().click()
await page.waitForTimeout(250)

const rangee = await page.locator('.outil-rangee').first().innerText()
dit(rangee.includes('12'), 'une colonne nombre nomme sa ligne', rangee.replace(/\n/g, ' '))
dit(
  (await page.locator('.outil-kpi').allInnerTexts()).join(' ').includes('4'),
  'le total composé calcule la différence — 12 pondus moins 8 vendus',
)

// La carte se dessine : c'est ce qui part dans WhatsApp. C'est un canvas, pas
// une image — elle est peinte sur le téléphone du propriétaire (§ 3.1).
await page.getByText('Diffuser', { exact: true }).first().click()
await page.waitForSelector('canvas', { timeout: 10000 })
await page.waitForTimeout(400)
const carte = await page.evaluate(() => {
  const c = document.querySelector('canvas')
  if (c === null) return null
  const pixels = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
  const teintes = new Set()
  for (let i = 0; i < pixels.length; i += 4000) {
    teintes.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`)
  }
  return { largeur: c.width, hauteur: c.height, teintes: teintes.size }
})
dit(carte?.largeur === 1080, 'sa carte se dessine', `${carte?.largeur}×${carte?.hauteur}`)
dit((carte?.teintes ?? 0) > 3, 'et elle est vraiment peinte', `${carte?.teintes} teintes`)

// Et il survit au rechargement : la configuration vit sur le téléphone.
await page.reload({ waitUntil: 'networkidle' })
await page.locator('.lien-outil').first().click()
await page.waitForTimeout(400)
dit(
  (await page.textContent('body')).includes('Poules'),
  'il se rouvre après rechargement, sans rappeler le modèle',
)
dit(appels === 1, 'et sans repayer une génération', `${appels} appel(s)`)

/*
 * Le refus, qui est l'autre moitié du contrat.
 *
 * « Je veux un site internet » créait un registre « Ventes » inventé de bout
 * en bout : le modèle n'avait aucune sortie et faisait ce qu'on lui demandait.
 */
await page.goto(BASE, { waitUntil: 'networkidle' })
const avant = appels
await page.fill('#demande', 'je veux un site internet')
await page.waitForTimeout(150)
await page.getByText('Compose-le pour moi').click()
await page.waitForTimeout(800)

const texte = await page.textContent('body')
dit(texte.includes('Je ne peux pas créer un site internet'), 'le refus du modèle est rapporté tel quel')
dit(!texte.includes('Ventes'), 'et aucun outil n’est inventé')
dit(!texte.includes('Réessaie'), 'sans proposer de recommencer : la réponse ne changera pas')
dit(appels === avant + 1, 'un seul appel payé pour le refus', `${appels - avant}`)

dit(erreurs.length === 0, 'aucune erreur de page', erreurs.join(' | '))

await navigateur.close()
serveur.close()
console.log(echecs === 0 ? 'FIN — tout passe' : `FIN — ${echecs} échec(s)`)
process.exit(echecs === 0 ? 0 : 1)
