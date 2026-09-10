/**
 * L'agent, du premier mot tapé jusqu'à l'outil ouvert — et jusqu'au lien reçu.
 *
 * C'est le maillon que les tests unitaires ne voient pas : le flux traverse le
 * réseau, l'aperçu se redessine à chaque morceau, la configuration traverse le
 * stockage, c'est du code écrit à la main qui la dessine, et elle repart au
 * serveur pour devenir une page.
 *
 * Le flux est **coupé à des endroits quelconques**, comme le réseau le fait, et
 * avec du délai entre les morceaux. Un aperçu qui ne tiendrait qu'avec des
 * morceaux bien découpés ne tiendrait pas une minute en production.
 *
 * La fin du parcours est celle qui a failli manquer. L'outil composé est
 * l'outil **payé**, et c'était le seul qu'on ne pouvait pas partager : sa
 * configuration voyage avec lui au lieu de vivre dans un squelette, le serveur
 * ne trouvait donc rien à dessiner derrière le lien, et la page répondait 200
 * avec « Ce lien ne mène à rien ».
 *
 *   pnpm build && wrangler pages dev --port 8798 --ip 127.0.0.1
 *   PLAYWRIGHT=/chemin/vers/playwright-core/index.mjs node e2e/agent.mjs
 *
 * Il lui faut le Worker et son KV. Le modèle, lui, est intercepté dans le
 * navigateur — la clef reste chez son propriétaire (§ 2.8).
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

/** Capturé en production le 10 septembre 2026, sur « suivre mes livraisons de gaz ». */
const REGISTRE = {
  titre: 'Suivi des livraisons',
  kicker: 'SUIVI DES LIVRAISONS',
  titreNom: 'Nom du client',
  colonnes: [
    { clef: 'nomClient', titre: 'Client', type: 'texte' },
    { clef: 'bouteilles', titre: 'Nombre de bouteilles', type: 'nombre' },
    { clef: 'montantGaz', titre: 'Montant livré (F CFA)', type: 'montant' },
    { clef: 'montantPaye', titre: 'Montant payé (F CFA)', type: 'montant' },
  ],
  libelleVide: 'Aucune livraison enregistrée pour l’instant.',
  libelleAjout: 'Ajouter une livraison',
  relancesVides: 'Ce registre ne se relance pas.',
  personnes: true,
  total: {
    type: 'difference',
    plus: 'montantGaz',
    moins: 'montantPaye',
    libelle: 'Reste à payer',
    unite: 'F',
  },
}

/** La même, une fois qu'on a demandé une modification. */
const AFFINE = {
  ...REGISTRE,
  colonnes: [...REGISTRE.colonnes, { clef: 'paye', titre: 'Payé ?', type: 'bascule' }],
}

const MOT_1 = 'Je te fais un suivi de tes livraisons, avec ce qui reste à payer.'
const MOT_2 = 'C’est ajouté : une case à cocher quand c’est payé.'

/**
 * Le flux d'un tour, tel que le Worker l'envoie.
 *
 * On le fabrique ici plutôt que d'appeler le modèle : ce qu'on éprouve est le
 * chemin, pas le modèle. Les ébauches sont celles que le serveur calculerait.
 */
function tour(mot, registre, credits, conversation) {
  const ev = []
  for (let i = 8; i <= mot.length; i += 8) {
    ev.push({ sorte: 'ebauche', ebauche: { mot: mot.slice(0, i), famille: null, titre: '', pieces: [] } })
  }
  for (let n = 0; n <= registre.colonnes.length; n++) {
    ev.push({
      sorte: 'ebauche',
      ebauche: {
        mot,
        famille: 'registre',
        titre: registre.titre,
        pieces: registre.colonnes.slice(0, n).map((c) => c.titre),
      },
    })
  }
  ev.push({
    sorte: 'fin',
    tour: { sorte: 'outil', mot, outil: { sorte: 'registre', registre } },
    fcfa: 0.21,
    conversation,
    plan: 'essai',
    credits,
  })
  return ev.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('')
}

const navigateur = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox'],
  /*
   * Le navigateur ne lit pas `HTTPS_PROXY` : on le lui passe, **avec sa
   * dérogation pour la machine locale**. Sans elle, un serveur de
   * développement sur 127.0.0.1 part lui aussi dans le mandataire, qui le
   * réinitialise — et l'échec ressemble à une application qui ne démarre pas.
   */
  ...(process.env.HTTPS_PROXY !== undefined
    ? { proxy: { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } }
    : {}),
})
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 } })

/*
 * Le proxy est côté serveur : on le remplace ici par ses vraies réponses. Le
 * corps de la requête décide du tour — c'est ce qui permet d'éprouver
 * l'affinage dans le même parcours que la première composition.
 */
const envois = []
await contexte.route('**/api/chat', async (route) => {
  const recu = JSON.parse(route.request().postData() ?? '{}')
  envois.push(recu)
  const premier = recu.conversation === undefined
  await route.fulfill({
    status: 200,
    contentType: 'text/event-stream',
    body: premier
      ? tour(MOT_1, REGISTRE, 4, 'c.1.9999999999999.sig')
      : tour(MOT_2, AFFINE, 4, 'c.2.9999999999999.sig'),
  })
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

// L'étage 1 ne connaît pas ce registre : il doit proposer d'en parler.
await page.fill('#demande', 'un carnet pour mes livraisons de gaz avec ce qui reste a payer')
await page.waitForTimeout(150)
dit(envois.length === 0, 'la conversation ne part pas toute seule')
dit(
  await page.getByText('En parler à l’atelier').isVisible(),
  'l’étage 1 admet qu’il ne sait pas, et propose',
)

await page.getByText('En parler à l’atelier').click()
await page.waitForSelector('text=Ouvrir cet outil', { timeout: 10000 })
dit(envois.length === 1, 'un seul tour est parti', String(envois.length))
dit(
  envois[0]?.messages?.at(-1)?.texte?.includes('livraisons de gaz'),
  'la phrase tapée dans l’atelier est reprise, sans la faire retaper',
)
dit(envois[0]?.conversation === undefined, 'le premier tour n’a pas de laissez-passer : il paie')

// La fenêtre montre ce qui a été fabriqué.
const fenetre = await page.textContent('.fenetre')
dit(fenetre.includes('un registre'), 'la fenêtre nomme la sorte d’outil')
dit(fenetre.includes('Suivi des livraisons'), 'et son titre')
dit(
  (await page.locator('.fenetre-pieces li').allInnerTexts()).length === 4,
  'et ses colonnes, une par une',
)
dit((await page.textContent('.dit-agent')).includes('reste à payer'), 'l’agent a dit ce qu’il fait')

/*
 * Le deuxième tour : la raison d'être de tout cet écran. Un bouton ne laisse
 * aucune place à la deuxième phrase, et personne ne décrit du premier coup
 * l'outil qu'il veut.
 */
await page.fill('.agent-saisie input', 'ajoute une case a cocher quand c est paye')
await page.getByRole('button', { name: 'Envoyer' }).click()
await page.waitForSelector('text=Payé ?', { timeout: 10000 })
dit(envois.length === 2, 'le deuxième tour est parti')
dit(
  envois[1]?.conversation === 'c.1.9999999999999.sig',
  'avec le laissez-passer : il ne repaie pas un crédit',
)
dit(
  envois[1]?.outil?.titre === 'Suivi des livraisons',
  'et avec l’outil en cours, pour que l’affinage porte sur quelque chose',
)
dit(
  (await page.locator('.fenetre-pieces li').allInnerTexts()).includes('Payé ?'),
  'la fenêtre montre la colonne ajoutée',
)

await page.getByText('Ouvrir cet outil', { exact: true }).click()
await page.waitForSelector('text=Aucune livraison', { timeout: 10000 })
dit(true, 'l’outil composé s’ouvre')

// La colonne ajoutée au deuxième tour est bien celle qui a été retenue.
await page.getByText('Ajouter une livraison', { exact: true }).first().click()
await page.fill('[aria-label="Nombre de bouteilles"]', '12')
await page.fill('[aria-label="Montant livré (F CFA)"]', '84000')
await page.fill('[aria-label="Montant payé (F CFA)"]', '50000')
await page.getByText('Ajouter une livraison', { exact: true }).first().click()
await page.waitForTimeout(250)
dit(
  (await page.locator('.outil-kpi').allInnerTexts()).join(' ').includes('34'),
  'le total composé calcule — 84 000 livrés moins 50 000 payés',
)

// La carte, puis le lien : la moitié du geste qui n'existait pas.
await page.getByText('Diffuser', { exact: true }).first().click()
await page.waitForSelector('canvas', { timeout: 10000 })
await page.waitForTimeout(500)

const lien = await page.evaluate(
  () =>
    new Promise((res) => {
      const q = indexedDB.open('atelier237-outils')
      q.onsuccess = () => {
        const t = q.result.transaction('outils', 'readonly').objectStore('outils').getAll()
        t.onsuccess = () => res(t.result.find((o) => o.skeleton === 'compose')?.lien ?? null)
        t.onerror = () => res(null)
      }
      q.onerror = () => res(null)
    }),
)
dit(lien !== null, 'la diffusion a déposé l’instantané et gardé son adresse', String(lien))

if (lien !== null) {
  const lecture = await contexte.newPage()
  const reponse = await lecture.goto(`${BASE}/d/${lien}`, { waitUntil: 'domcontentloaded' })
  const lu = await lecture.textContent('body')
  dit(reponse.status() === 200, 'la page publiée répond', String(reponse.status()))
  dit(lu.includes('Suivi des livraisons'), 'le registre payé se lit derrière son lien')
  // 200 avec « Ce lien ne mène à rien » est le défaut exact qui a existé : le
  // statut ne suffit pas à le voir.
  dit(!lu.includes('ne mène à rien'), 'et ce n’est pas la page « lien introuvable »')
  await lecture.close()
}

// Et il survit au rechargement : la configuration vit sur le téléphone.
await page.reload({ waitUntil: 'networkidle' })
await page.locator('.lien-outil').first().click()
await page.waitForTimeout(400)
dit(
  (await page.textContent('body')).includes('Suivi des livraisons'),
  'il se rouvre après rechargement, sans rappeler le modèle',
)
dit(envois.length === 2, 'et sans repayer une génération', `${envois.length} tour(s)`)

/*
 * Le refus, qui est l'autre moitié du contrat. Il ne disparaît pas parce qu'il
 * y a une conversation : il se dit dedans, et rien ne s'ouvre.
 */
await contexte.unroute('**/api/chat')
await contexte.route('**/api/chat', (route) =>
  route.fulfill({
    status: 200,
    contentType: 'text/event-stream',
    body:
      'data: {"sorte":"fin","tour":{"sorte":"outil","mot":"Un logo se dessine, ' +
      'il ne se tient ni en lignes ni en pages.","outil":{"sorte":"refus",' +
      '"pourquoi":"Un logo se dessine."}},"fcfa":0.08,' +
      '"conversation":"c.1.9999999999999.sig","plan":"essai","credits":3}\n\n',
  }),
)
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.fill('#demande', 'fais-moi un logo')
await page.waitForTimeout(150)
await page.getByText('En parler à l’atelier').click()
await page.waitForSelector('text=Un logo se dessine', { timeout: 10000 })
const apresRefus = await page.textContent('body')
dit(apresRefus.includes('pas un outil que je sais fabriquer'), 'le refus se voit dans la fenêtre')
dit(
  !apresRefus.includes('Ouvrir cet outil'),
  'et rien ne propose d’ouvrir : un bouton mort est pire qu’un bouton absent',
)

dit(erreurs.length === 0, 'aucune erreur de page', erreurs.join(' | '))

await navigateur.close()
console.log(echecs === 0 ? 'FIN — tout passe' : `FIN — ${echecs} échec(s)`)
process.exit(echecs === 0 ? 0 : 1)
