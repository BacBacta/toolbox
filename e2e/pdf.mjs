/**
 * Le PDF, éprouvé sur sa structure et non sur son existence.
 *
 * Le critère du § 7 est « un même devis produit un PDF identique ouvert sur
 * Windows, macOS et Android, et un imprimeur de quartier l'imprime sans
 * surprise ». Les deux moitiés se vérifient différemment.
 *
 * **L'identique** se prouve ici : un PDF dont la page fait 210 × 297 mm et qui
 * **porte ses polices** n'a plus rien à décider au moment de l'ouverture. Il
 * n'y a pas de « selon la machine » possible. C'est ce que ce script mesure,
 * en lisant le fichier lui-même.
 *
 * **L'imprimeur de quartier** ne se vérifie pas d'ici : il faut du papier, une
 * machine, et quelqu'un qui regarde la feuille sortir.
 *
 *   node e2e/pdf.mjs                                  # la production
 *   BASE=http://127.0.0.1:8798 node e2e/pdf.mjs       # un serveur local
 *
 * Attention : `quickAction` n'existe pas en développement local — il faut
 * `wrangler pages dev --remote`, ou la production.
 */
import { writeFileSync } from 'node:fs'

const BASE = process.env.BASE ?? 'https://atelier237.pages.dev'
/** Douze caractères de l'alphabet des liens, tirés pour ne rien écraser. */
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTVWXYZ'
const LIEN = Array.from({ length: 12 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('')

let echecs = 0
const dit = (bon, quoi, detail = '') => {
  console.log(`${bon ? 'OK ' : 'KO '} ${quoi}${detail === '' ? '' : ` — ${detail}`}`)
  if (!bon) echecs++
}

const DEVIS = {
  skeleton: 'devis',
  nom: 'Devis',
  version: 0,
  publieLe: new Date().toISOString(),
  etat: {
    nom: 'Devis — Ets Mbarga & Fils',
    encre: 'encre',
    numero: 'DV-2026-0118',
    emisLe: '2026-09-09T07:45:00.000Z',
    validite: '15 jours',
    acompte: 50,
    emetteur: {
      nom: 'QUINCAILLERIE BÉPANDA',
      forme: 'Ets — Établissement individuel',
      activite: 'Quincaillerie · matériaux · outillage',
      adresse: 'Rue Bépanda-Omnisport, BP 4127 Douala',
      tel: '+237 6 99 41 27 08',
      mail: 'contact@quincaillerie-bepanda.cm',
      rccm: 'RC/DLA/2022/A/1487',
      niu: 'M022114873829Y',
      centre: 'CDI Douala 3ᵉ',
    },
    client: { nom: 'Ets Mbarga & Fils', niu: 'M019887641203K', estEntreprise: true },
    lignes: [
      { designation: 'Fourniture de tôles bac 30/100', quantite: 24, prixUnitaire: 12_500 },
      { designation: 'Pointes et accessoires de pose', quantite: 1, prixUnitaire: 38_000 },
    ],
  },
}

const depot = await fetch(`${BASE}/api/publier`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ lien: LIEN, instantane: DEVIS }),
})
dit(depot.status === 200, 'le devis se dépose', String(depot.status))

const debut = Date.now()
const reponse = await fetch(`${BASE}/p/${LIEN}`)
dit(reponse.status === 200, 'le PDF se rend', `${reponse.status} · ${Date.now() - debut} ms`)
dit(reponse.headers.get('content-type') === 'application/pdf', 'et s’annonce comme un PDF')
dit(
  (reponse.headers.get('content-disposition') ?? '').includes('devis-DV-2026-0118.pdf'),
  'sous un nom qui porte le numéro',
  reponse.headers.get('content-disposition') ?? '',
)

const octets = Buffer.from(await reponse.arrayBuffer())
dit(octets.subarray(0, 5).toString() === '%PDF-', 'c’est bien un PDF', `${octets.length} octets`)

/*
 * La taille de page, en points PostScript — 72 par pouce.
 *
 * A4 fait 210 × 297 mm, soit 595,3 × 841,9 points. Sans `@page` et
 * `preferCSSPageSize`, le moteur prend le format par défaut de sa locale : la
 * même feuille sortirait en Letter, recadrée, chez qui l'imprime.
 */
const boite = /\/MediaBox\s*\[([^\]]*)\]/.exec(octets.toString('latin1'))
const [, , largeur, hauteur] = (boite?.[1] ?? '').trim().split(/\s+/).map(Number)
const mm = (points) => (points * 25.4) / 72
dit(
  Math.abs(mm(largeur) - 210) < 1 && Math.abs(mm(hauteur) - 297) < 1,
  'la page fait A4',
  `${mm(largeur).toFixed(1)} × ${mm(hauteur).toFixed(1)} mm`,
)

/*
 * Les polices, embarquées. C'est la moitié du critère : un fichier qui porte
 * ses glyphes n'a plus rien à décider au moment de l'ouverture.
 */
const texte = octets.toString('latin1')
const embarquees = (texte.match(/\/FontFile\d?/g) ?? []).length
const nommees = [...new Set(texte.match(/\/BaseFont\s*\/([A-Za-z0-9+#-]+)/g) ?? [])]
dit(embarquees > 0, 'les polices sont embarquées', `${embarquees} fichier(s)`)
dit(
  nommees.some((n) => n.includes('DejaVu')),
  'et ce sont celles qu’on a nommées',
  nommees.join(' ').slice(0, 90),
)

// Un registre n'a pas de feuille : son lien mène à une carte.
const REGISTRE = {
  ...DEVIS,
  skeleton: 'njangi',
  etat: { nom: 'Njangi', cotisation: 5000, periode: 'semaine', tour: 1, historique: [], membres: [] },
}
const lienRegistre = Array.from({ length: 12 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('')
const depotRegistre = await fetch(`${BASE}/api/publier`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ lien: lienRegistre, instantane: REGISTRE }),
})
/*
 * On vérifie le dépôt avant d'en tirer une conclusion.
 *
 * Sans ce contrôle, un état d'essai mal formé se faisait refuser, rien n'était
 * rangé, et la lecture rendait 404 — que l'essai lisait comme « le registre
 * n'a pas de feuille ». La bonne réponse, pour la mauvaise raison, est ce
 * qu'un essai peut faire de pire.
 */
dit(depotRegistre.status === 200, 'le registre se dépose', String(depotRegistre.status))
const carte = await fetch(`${BASE}/p/${lienRegistre}`)
dit(carte.status === 415, 'un registre n’a pas de version imprimable, et le dit', String(carte.status))

const inconnu = await fetch(`${BASE}/p/AAAA22223333`)
dit(inconnu.status === 404, 'un lien inconnu ne rend pas de PDF', String(inconnu.status))
const malforme = await fetch(`${BASE}/p/trop-court`)
dit(malforme.status === 404, 'un lien mal formé non plus, avant de toucher au stockage', String(malforme.status))

if (process.env.GARDER === '1') {
  writeFileSync('devis.pdf', octets)
  console.log('     devis.pdf écrit')
}

console.log(echecs === 0 ? 'FIN — tout passe' : `FIN — ${echecs} échec(s)`)
process.exit(echecs === 0 ? 0 : 1)
