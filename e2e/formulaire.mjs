/**
 * Un formulaire composé, du premier mot tapé jusqu'à la réponse d'un inconnu.
 *
 * C'est le seul parcours du produit où **deux personnes** interviennent : celle
 * qui fabrique le formulaire et le partage, et celle qui le remplit sans avoir
 * jamais ouvert l'application, sans compte, et — c'est le point — **sans un
 * octet de JavaScript**. Le navigateur poste un `<form>` tout seul ; c'est la
 * seule façon que ça marche dans le navigateur intégré de WhatsApp, sur un
 * téléphone d'entrée de gamme, sur une connexion qui hoquette.
 *
 * Aucun test unitaire ne peut voir ce parcours : il traverse le navigateur, le
 * Worker, KV, D1, et revient dans l'application par une adresse différente.
 *
 *   pnpm build
 *   wrangler d1 execute COMPTES --local --file=packages/comptes/migrations/0001-comptes.sql
 *   wrangler d1 execute COMPTES --local --file=packages/comptes/migrations/0002-reponses.sql
 *   wrangler pages dev --port 8798 --ip 127.0.0.1
 *   PLAYWRIGHT=/chemin/vers/playwright-core/index.mjs node e2e/formulaire.mjs
 */
const BASE = process.env.BASE ?? 'http://127.0.0.1:8798'
const CHROME = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright-core')

try {
  await fetch(BASE, { method: 'HEAD' })
} catch {
  console.log(`KO  aucun serveur sur ${BASE} — lancer \`wrangler pages dev --port 8798\``)
  process.exit(1)
}

/** Ce qu'un modèle rend sur « savoir qui vient à la fête et ce qu'il apporte ». */
const FORMULAIRE = {
  formulaire: {
    titre: 'Qui vient samedi ?',
    kicker: 'FÊTE DES VOISINS',
    accroche: 'Dis-moi si tu viens et ce que tu apportes, avant vendredi soir.',
    champs: [
      { clef: 'nom', titre: 'Ton nom', sorte: 'texte', obligatoire: true },
      { clef: 'telephone', titre: 'Ton numéro', sorte: 'telephone' },
      {
        clef: 'plat', titre: 'Tu apportes quoi ?', sorte: 'choix',
        options: ['Du ndolè', 'Des boissons', 'Du riz', 'Rien, je viens manger'],
      },
      { clef: 'combien', titre: 'Vous êtes combien ?', sorte: 'nombre' },
      { clef: 'chaises', titre: 'Tu peux prêter des chaises ?', sorte: 'oui-non' },
      { clef: 'mot', titre: 'Un mot ?', sorte: 'paragraphe', aide: 'Facultatif.' },
    ],
    bouton: 'Je viens !',
    merci: 'C’est noté, à samedi. Je t’écris sur WhatsApp s’il y a du changement.',
  },
  fcfa: 0.17,
}

/*
 * Le navigateur ne lit pas `HTTPS_PROXY` : on le lui passe. Sans ça, viser une
 * adresse publique depuis une machine qui sort par un mandataire échoue sur un
 * « connexion réinitialisée » qui ressemble à une panne du serveur.
 */
const navigateur = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox'],
  ...(process.env.HTTPS_PROXY !== undefined ? { proxy: { server: process.env.HTTPS_PROXY } } : {}),
})
const proprietaire = await navigateur.newContext({ viewport: { width: 390, height: 844 } })
await proprietaire.route('**/api/ai', (r) =>
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FORMULAIRE) }),
)

let echecs = 0
const dit = (bon, quoi, detail = '') => {
  console.log(`${bon ? 'OK ' : 'KO '} ${quoi}${detail === '' ? '' : ` — ${detail}`}`)
  if (!bon) echecs++
}

const page = await proprietaire.newPage()
page.setDefaultTimeout(15000)
const erreurs = []
page.on('pageerror', (e) => erreurs.push(String(e)))

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.fill('#demande', 'savoir qui vient a la fete et ce qu il apporte')
await page.waitForTimeout(150)
await page.getByText('Compose-le pour moi').click()
await page.waitForSelector('text=Qui vient samedi', { timeout: 10000 })
dit(true, 'le formulaire composé s’ouvre')

dit(
  (await page.textContent('body')).includes('n’est pas encore publié'),
  'et son onglet des réponses dit quoi faire avant d’être publié',
)

await page.getByRole('tab', { name: 'Aperçu' }).click()
await page.waitForTimeout(300)
dit(
  (await page.locator('.page-apercu form').getAttribute('action')) === '',
  'l’aperçu ne poste nulle part',
)
dit(
  await page.locator('.page-apercu .form-champ input').first().isDisabled(),
  'et ses champs sont inertes : on n’ajoute pas sa propre réponse',
)

await page.getByText('Publier et partager', { exact: true }).first().click()
await page.waitForSelector('canvas', { timeout: 10000 })
await page.waitForTimeout(600)

const lien = await page.evaluate(
  () =>
    new Promise((res) => {
      const q = indexedDB.open('atelier237-outils')
      q.onsuccess = () => {
        const t = q.result.transaction('outils', 'readonly').objectStore('outils').getAll()
        t.onsuccess = () =>
          res(t.result.find((o) => o.skeleton === 'compose-formulaire')?.lien ?? null)
        t.onerror = () => res(null)
      }
      q.onerror = () => res(null)
    }),
)
dit(lien !== null, 'le formulaire est publié', String(lien))
if (lien === null) {
  await navigateur.close()
  process.exit(1)
}

/*
 * Le visiteur : un autre contexte, donc un autre appareil. Pas de compte, pas
 * d'application installée, et le JavaScript coupé — c'est la moitié du
 * parcours qui compte.
 */
const inconnu = await navigateur.newContext({
  viewport: { width: 360, height: 740 },
  javaScriptEnabled: false,
})
const chezLInconnu = await inconnu.newPage()
await chezLInconnu.goto(`${BASE}/d/${lien}`, { waitUntil: 'domcontentloaded' })

const html = await chezLInconnu.content()
dit(html.includes('Qui vient samedi'), 'l’inconnu voit le formulaire')
dit(!html.includes('<script'), 'sans un seul script sur la page')
dit(
  (await chezLInconnu.locator('form').getAttribute('action')).endsWith(`/d/${lien}`),
  'et le formulaire poste sur sa propre adresse',
)

await chezLInconnu.fill('#f-nom', 'Awa Ngo')
await chezLInconnu.fill('#f-telephone', '699412708')
await chezLInconnu.selectOption('#f-plat', 'Du ndolè')
await chezLInconnu.fill('#f-combien', '4')
await chezLInconnu.check('#f-chaises')
await chezLInconnu.fill('#f-mot', 'On arrive vers 15 h.')
await chezLInconnu.getByRole('button', { name: 'Je viens !' }).click()
await chezLInconnu.waitForLoadState('domcontentloaded')

const apres = await chezLInconnu.content()
dit(
  chezLInconnu.url().includes('merci=1'),
  'l’envoi redirige : rafraîchir ne renvoie pas la réponse deux fois',
  chezLInconnu.url(),
)
dit(apres.includes('à samedi'), 'et le remerciement dit ce qui va se passer')

// Un second envoi coup sur coup depuis la même adresse ne double pas la réponse.
await chezLInconnu.goto(`${BASE}/d/${lien}`, { waitUntil: 'domcontentloaded' })
await chezLInconnu.fill('#f-nom', 'Awa Ngo (encore)')
await chezLInconnu.getByRole('button', { name: 'Je viens !' }).click()
await chezLInconnu.waitForLoadState('domcontentloaded')

// Une réponse à qui il manque l'obligatoire revient sur la page, en le nommant.
await chezLInconnu.goto(`${BASE}/d/${lien}`, { waitUntil: 'domcontentloaded' })
await chezLInconnu.evaluate(() => {
  // Sans script chez le visiteur, on retire `required` côté serveur en postant
  // à la main : c'est exactement ce que fait quelqu'un avec `curl`.
})
const sansNom = await inconnu.request.post(`${BASE}/d/${lien}`, {
  form: { plat: 'Du riz' },
})
dit(
  (await sansNom.text()).includes('Il manque Ton nom'),
  'ce qui manque est nommé, plutôt que « formulaire incomplet »',
)

// Un robot qui remplit le champ piège repart content, et sans rien laisser.
await inconnu.request.post(`${BASE}/d/${lien}`, {
  form: { nom: 'Robot', ne_rien_ecrire_ici: 'x' },
})

/*
 * Et le propriétaire relit, dans son application. C'est la moitié qui
 * n'existait pas : aujourd'hui, ça se recopie à la main depuis WhatsApp.
 */
await page.locator('.feuille-fermer').click()
await page.waitForTimeout(300)
await page.getByRole('tab', { name: 'Réponses' }).click()
await page.waitForTimeout(1200)
const lues = await page.textContent('.outil-corps')
dit(lues.includes('Awa Ngo'), 'le propriétaire relit la réponse dans son application')
dit(lues.includes('Du ndolè'), 'avec ce qui a été choisi')
dit(lues.includes('Tu peux prêter des chaises ?'), 'et les questions telles qu’elles étaient posées')
dit(!lues.includes('Robot'), 'le robot n’y est pas')
dit(!lues.includes('encore'), 'ni le doublon envoyé coup sur coup')

// Puis hors ligne : ce qui a été rapporté une fois se relit sans réseau.
await proprietaire.setOffline(true)
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(400)
await page.locator('.lien-outil').first().click()
await page.waitForTimeout(1200)
const horsLigne = await page.textContent('.outil-corps')
dit(horsLigne.includes('Awa Ngo'), 'et il les relit hors ligne, dans son taxi')
dit(horsLigne.includes('Pas de réseau'), 'en sachant qu’il en manque peut-être')
await proprietaire.setOffline(false)

// Un autre appareil ne lit pas les réponses de celui-ci.
const voleur = await navigateur.newContext()
const vol = await voleur.request.get(`${BASE}/api/reponses/${lien}`, {
  headers: { authorization: `Appareil ${'f'.repeat(64)}` },
})
dit(vol.status() === 404, 'un autre appareil ne lit rien, et n’apprend pas que le lien existe', String(vol.status()))

dit(erreurs.length === 0, 'aucune erreur de page', erreurs.join(' | '))

await navigateur.close()
console.log(echecs === 0 ? 'FIN — tout passe' : `FIN — ${echecs} échec(s)`)
process.exit(echecs === 0 ? 0 : 1)
