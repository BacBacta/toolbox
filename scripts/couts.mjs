/**
 * Ce que les générations ont coûté, en francs.
 *
 * Le § 8 plafonne le coût moyen d'une génération à **un franc**, et range cette
 * mesure parmi celles « à faire échouer en CI, pas à surveiller à l'œil ». Elle
 * ne peut pas tourner en CI — elle interroge la production — mais elle peut
 * échouer, et c'est ce que fait ce script : il sort en code 1 si la moyenne
 * dépasse le plafond.
 *
 * Sans lui, la promesse était dans la base et nulle part ailleurs : il fallait
 * se connecter à D1 et écrire une requête pour savoir si elle tenait. Une
 * promesse qu'on ne consulte pas est une croyance.
 *
 *   node scripts/couts.mjs              # la production
 *   node scripts/couts.mjs --local      # la base locale de `wrangler pages dev`
 *
 * `WRANGLER` donne le chemin de l'exécutable si `wrangler` n'est pas au PATH.
 */
import { execFileSync } from 'node:child_process'

const PLAFOND_XAF = 1
const WRANGLER = process.env.WRANGLER ?? 'wrangler'
const OU = process.argv.includes('--local') ? '--local' : '--remote'

const REQUETE = `
  SELECT
    COUNT(*)                                   AS appels,
    SUM(ok)                                    AS reussis,
    ROUND(AVG(cout_xaf), 4)                    AS moyenne,
    ROUND(MAX(cout_xaf), 4)                    AS pire,
    ROUND(SUM(cout_xaf), 2)                    AS total,
    ROUND(AVG(jetons_entree), 0)               AS jetons_entree,
    ROUND(AVG(jetons_sortie), 0)               AS jetons_sortie
  FROM appels_ia WHERE cout_xaf IS NOT NULL
`.replace(/\s+/g, ' ').trim()

function interroger(sql) {
  const sortie = execFileSync(WRANGLER, ['d1', 'execute', 'COMPTES', OU, '--json', '--command', sql], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  // `--json` peut être précédé d'une bannière : on repart du premier crochet.
  const debut = sortie.indexOf('[')
  const lu = JSON.parse(sortie.slice(debut))
  return lu[0]?.results ?? []
}

const [r] = interroger(REQUETE)
if (r === undefined || r.appels === 0) {
  console.log('Aucune génération journalisée.')
  process.exit(0)
}

const f = (n) => (n === null ? '—' : `${n} F`)
console.log(`Générations journalisées : ${r.appels} (${r.reussis} utilisables)`)
console.log(`  coût moyen  : ${f(r.moyenne)} / ${PLAFOND_XAF} F`)
console.log(`  la plus chère : ${f(r.pire)}`)
console.log(`  dépensé en tout : ${f(r.total)}`)
console.log(`  jetons : ${r.jetons_entree} en entrée · ${r.jetons_sortie} en sortie`)

// Le détail par étage : l'étage 3 coûte deux fois l'étage 2, et c'est lui que
// l'abonnement doit payer.
const parEtage = interroger(
  'SELECT etage, COUNT(*) AS n, ROUND(AVG(cout_xaf),4) AS moyenne FROM appels_ia' +
    ' WHERE cout_xaf IS NOT NULL GROUP BY etage ORDER BY etage',
)
for (const e of parEtage) console.log(`  étage ${e.etage} : ${e.n} · ${f(e.moyenne)} en moyenne`)

if (r.moyenne > PLAFOND_XAF) {
  console.log(`\n✗ Le coût moyen dépasse le plafond du § 8 : ${f(r.moyenne)} > ${PLAFOND_XAF} F.`)
  process.exit(1)
}
console.log(`\n✓ Sous le plafond du § 8.`)
