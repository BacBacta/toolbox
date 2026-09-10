/**
 * Un outil composé par le modèle, du premier mot tapé jusqu'au lien reçu.
 *
 * C'est le maillon que les tests unitaires ne voient pas : la configuration
 * vient du réseau, traverse le stockage, c'est `RegistreListe` — écrit à la
 * main — qui la dessine, et elle repart au serveur pour devenir une page. Si
 * le pont casse quelque part, il casse ici.
 *
 * La réponse est **une vraie sortie de production**, capturée telle quelle.
 * Une réponse inventée testerait ce que j'imagine que le modèle produit ; sa
 * première colonne est de type `nombre`, ce qui a longtemps été interdit et
 * faisait échouer deux générations sur dix.
 *
 * La fin du parcours est celle qui a failli manquer. L'outil composé est
 * l'outil **payé**, et c'était le seul qu'on ne pouvait pas partager : sa
 * configuration voyage avec lui au lieu de vivre dans un squelette, le serveur
 * ne trouvait donc rien à dessiner derrière le lien, et la page répondait 200
 * avec « Ce lien ne mène à rien ». L'envoyeur n'en savait rien.
 *
 *   pnpm build && wrangler pages dev --port 8798 --ip 127.0.0.1
 *   PLAYWRIGHT=/chemin/vers/playwright-core/index.mjs node e2e/compose.mjs
 *
 * Il lui faut le Worker et son KV : `BASE` change l'adresse si le port est
 * déjà pris. L'appel au modèle, lui, est intercepté dans le navigateur — la
 * clef reste chez son propriétaire (§ 2.8).
 */
const BASE = process.env.BASE ?? 'http://127.0.0.1:8798'
const CHROME = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright-core')

// Un serveur absent doit se dire, pas se deviner : sans ce mot, l'échec arrive
// sous la forme d'une capture d'écran vide et d'un sélecteur introuvable.
try {
  await fetch(BASE, { method: 'HEAD' })
} catch {
  console.log(`KO  aucun serveur sur ${BASE} — lancer \`wrangler pages dev --port 8798\``)
  process.exit(1)
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

const navigateur = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] })
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 } })

/** Une calculatrice, capturée en production sur « ma marge sur chaque vente ». */
const CALCUL = {
  calcul: {
    titre: 'Marge',
    kicker: 'MARGE',
    titreNom: 'Nom du produit',
    entrees: [
      { clef: 'prixAchat', titre: 'Prix d’achat', defaut: 0, unite: 'F' },
      { clef: 'prixVente', titre: 'Prix de vente', defaut: 0, unite: 'F' },
    ],
    sortie: {
      libelle: 'Marge',
      unite: 'F',
      formule: { op: 'moins', gauche: { ref: 'prixVente' }, droite: { ref: 'prixAchat' } },
    },
  },
  fcfa: 0.16,
}

/**
 * Une page, sur « je veux un site internet pour ma quincaillerie ».
 *
 * C'était le refus, jusqu'ici : « Je ne peux pas créer un site internet. Je
 * suis un outil de gestion de registres. » Le refus était juste tant que rien
 * derrière ne savait faire une page — c'est ce qu'il refusait qui manquait.
 */
const PAGE = {
  page: {
    titre: 'Quincaillerie Bépanda',
    kicker: 'QUINCAILLERIE',
    accroche: 'Tôles, ciment et outillage, à Bépanda depuis 2012.',
    sommaire: true,
    sections: [
      {
        titre: 'Ce que je vends',
        sorte: 'liste',
        lignes: [
          { nom: 'Tôles bac 30/100', detail: 'toutes longueurs' },
          { nom: 'Ciment CIMENCAM', valeur: 'en stock' },
        ],
      },
      {
        titre: 'Quelques prix',
        sorte: 'prix',
        lignes: [
          { nom: 'Tôle bac 30/100', valeur: '12 500 F', detail: 'la feuille' },
          { nom: 'Sac de ciment 50 kg', valeur: '5 800 F' },
        ],
      },
      {
        titre: 'La livraison',
        sorte: 'texte',
        texte: 'Nous livrons sur tout Douala, du lundi au samedi.',
      },
    ],
    telephone: '699412708',
    adresse: 'Rue Bépanda-Omnisport, en face du marché',
    horaires: 'Lundi à samedi, 7 h – 19 h',
  },
  fcfa: 0.19,
}

/** Un refus, sur une demande qu'aucune des trois formes ne porte. */
const REFUS = {
  impossible: 'Un logo se dessine, il ne se tient ni en lignes ni en pages.',
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
  const d = String(demande)
  const corps = d.includes('logo')
    ? REFUS
    : d.includes('site internet')
      ? PAGE
      : d.includes('marge')
        ? CALCUL
        : REPONSE
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

/*
 * Et le lien : la moitié du geste qui n'existait pas.
 *
 * « Diffuser » dépose l'instantané avant de bâtir le partage, donc l'outil
 * porte maintenant son adresse. Ce que le serveur en fait est le vrai enjeu :
 * il ne connaît pas ce registre, il ne peut le dessiner qu'avec la
 * configuration reçue.
 */
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
  dit(lu.includes('Poules'), 'le registre payé se lit derrière son lien')
  // 200 avec « Ce lien ne mène à rien » est le défaut exact qui a existé : le
  // statut ne suffit pas à le voir.
  dit(!lu.includes('ne mène à rien'), 'et ce n’est pas la page « lien introuvable »')
  dit(!lu.includes('ne peut pas être affiché'), 'ni celle du document illisible')
  await lecture.close()
}

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
 * L'autre forme composable : une calculatrice.
 *
 * Sa formule est un arbre déclaré, interprété par du code écrit à la main. Le
 * modèle décrit le calcul ; il n'obtient jamais le droit d'en exécuter un.
 */
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.fill('#demande', 'ma marge sur chaque vente')
await page.waitForTimeout(150)
await page.getByText('Compose-le pour moi').click()
await page.waitForSelector('text=Prix d’achat', { timeout: 10000 })
dit(true, 'la calculatrice composée s’ouvre')

await page.fill('#calc-prixAchat', '18000')
await page.fill('#calc-prixVente', '25000')
await page.waitForTimeout(250)
const resultat = await page.textContent('body')
dit(
  resultat.replace(/\s/g, ' ').includes('7 000 F'),
  'la formule déclarée calcule — 25 000 moins 18 000',
)

/*
 * La troisième forme : une page — et c'est la demande qu'on refusait.
 *
 * Le parcours entier compte ici, parce qu'il ne se ressemble à aucun autre :
 * ce qu'on modifie **est** ce qui se publie, l'aperçu est le composant de la
 * page publiée, et la page publiée n'est pas une carte mais la vitrine
 * elle-même.
 */
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.fill('#demande', 'je veux un site internet pour ma quincaillerie')
await page.waitForTimeout(150)
dit(
  (await page.textContent('body')).includes('une page à envoyer sur'),
  'les trois formes sont annoncées avant qu’on paie',
)
await page.getByText('Compose-le pour moi').click()
await page.waitForSelector('text=Quincaillerie Bépanda', { timeout: 10000 })
dit(true, 'la page composée s’ouvre')

const vitrine = await page.textContent('.page-apercu')
dit(vitrine.includes('12 500 F'), 'l’aperçu montre les prix, pas un résumé')
dit(
  (await page.locator('.vitrine-appel').getAttribute('href')).includes('wa.me/237699412708'),
  'et le bouton qui rapporte pointe sur WhatsApp',
)
dit(
  (await page.locator('.vitrine-sommaire a').count()) === 3,
  'le sommaire saute d’une section à l’autre — c’est tout ce qu’« un site » ajoute',
)

/*
 * On corrige un prix : c'est la configuration elle-même qu'on modifie.
 *
 * Le champ se cherche par sa valeur vivante et non par son attribut : Preact
 * pose `value` comme propriété, et un sélecteur d'attribut ne voit rien.
 */
await page.getByRole('tab', { name: 'Modifier' }).click()
await page.waitForTimeout(200)

const champs = page.locator('.champ input')
let corrige = false
for (let i = 0; i < (await champs.count()); i++) {
  if ((await champs.nth(i).inputValue()) === '12 500 F') {
    await champs.nth(i).fill('13 000 F')
    corrige = true
    break
  }
}
dit(corrige, 'le prix composé s’édite dans le formulaire')
await page.waitForTimeout(300)
await page.getByRole('tab', { name: 'Aperçu' }).click()
await page.waitForTimeout(200)
dit(
  (await page.textContent('.page-apercu')).includes('13 000 F'),
  'ce qu’on modifie est ce qui se publie',
)

await page.getByText('Publier et partager', { exact: true }).first().click()
await page.waitForSelector('canvas', { timeout: 10000 })
await page.waitForTimeout(400)

const lienPage = await page.evaluate(
  () =>
    new Promise((res) => {
      const q = indexedDB.open('atelier237-outils')
      q.onsuccess = () => {
        const t = q.result.transaction('outils', 'readonly').objectStore('outils').getAll()
        t.onsuccess = () => res(t.result.find((o) => o.skeleton === 'compose-page')?.lien ?? null)
        t.onerror = () => res(null)
      }
      q.onerror = () => res(null)
    }),
)
dit(lienPage !== null, 'la page est publiée et garde son adresse', String(lienPage))

if (lienPage !== null) {
  const lue = await contexte.newPage()
  const reponse = await lue.goto(`${BASE}/d/${lienPage}`, { waitUntil: 'domcontentloaded' })
  const html = await reponse.text()
  const lu = await lue.textContent('body')
  dit(reponse.status() === 200, 'la page publiée répond', String(reponse.status()))
  dit(lu.includes('Quincaillerie Bépanda'), 'la vitrine se lit derrière son lien')
  dit(lu.includes('13 000 F'), 'avec la correction, pas la version du modèle')
  dit(!lu.includes('ne mène à rien'), 'et ce n’est pas la page « lien introuvable »')
  dit(!html.includes('<script'), 'sans un seul script — c’est ce qui la rend fiable')
  dit(html.length <= 25 * 1024, 'sous les 25 Ko du § 8', `${(html.length / 1024).toFixed(1)} Ko`)
  // Le sommaire saute dans le document, sans recharger : la cible doit exister.
  dit(html.includes('id="quelques-prix"'), 'le sommaire a bien où sauter')
  await lue.close()
}

/*
 * Le refus, qui est l'autre moitié du contrat.
 *
 * Il ne disparaît pas parce qu'une forme de plus existe : il se resserre. Un
 * outil qui ne sait pas dire non finit par mentir, et « fais-moi un logo »
 * n'est ni un registre, ni un calcul, ni une page.
 */
await page.goto(BASE, { waitUntil: 'networkidle' })
const avant = appels
await page.fill('#demande', 'fais-moi un logo')
await page.waitForTimeout(150)
await page.getByText('Compose-le pour moi').click()
await page.waitForTimeout(800)

const texte = await page.textContent('body')
dit(texte.includes('Un logo se dessine'), 'le refus du modèle est rapporté tel quel')
dit(!texte.includes('Ventes'), 'et aucun outil n’est inventé')
dit(!texte.includes('Réessaie'), 'sans proposer de recommencer : la réponse ne changera pas')
dit(appels === avant + 1, 'un seul appel payé pour le refus', `${appels - avant}`)

dit(erreurs.length === 0, 'aucune erreur de page', erreurs.join(' | '))

await navigateur.close()
console.log(echecs === 0 ? 'FIN — tout passe' : `FIN — ${echecs} échec(s)`)
process.exit(echecs === 0 ? 0 : 1)
