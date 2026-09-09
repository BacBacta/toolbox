#!/usr/bin/env node
import { readFileSync } from 'node:fs'

/**
 * Cinq dépendances de production au maximum dans `apps/web` (BRIEF.md § 8).
 *
 * Les paquets de l'espace de travail ne comptent pas : ils sont notre propre
 * code, empaqueté dans le fragment, et déjà pesé par `budget.mjs`. Ce que ce
 * plafond protège, c'est l'entrée de code tiers.
 */
const PLAFOND = 5

const manifeste = JSON.parse(readFileSync('apps/web/package.json', 'utf8'))
const toutes = Object.entries(manifeste.dependencies ?? {})
const tierces = toutes.filter(([, version]) => !version.startsWith('workspace:'))

console.log(`Dépendances de production dans apps/web : ${tierces.length} tierces / ${PLAFOND}`)
for (const [nom, version] of toutes) {
  console.log(`  ${nom}@${version}${version.startsWith('workspace:') ? ' (interne)' : ''}`)
}

if (tierces.length > PLAFOND) {
  console.error(
    `\n✗ ${tierces.length} dépendances tierces, plafond ${PLAFOND}.\n` +
      '  Toute nouvelle dépendance doit être justifiée par écrit dans le message\n' +
      '  de commit : poids gzip, ce qu’elle remplace, pourquoi ça ne s’écrit pas\n' +
      '  en quarante lignes (§ 8).',
  )
  process.exit(1)
}
console.log('\n✓ Plafond de dépendances tenu.')
