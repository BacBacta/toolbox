import preact from '@preact/preset-vite'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import { fichiersAPrecacher } from './src/sw-strategie.js'

/**
 * Liste ce que le service worker doit mettre en cache pour que l'app tienne en
 * mode avion.
 *
 * Vite sait déjà émettre un manifeste, mais il le place sous `.vite/`, un
 * dossier caché que plusieurs hébergeurs refusent de servir. Douze lignes
 * valent mieux qu'un pari là-dessus.
 */
function listePrecache(): Plugin {
  return {
    name: 'atelier-precache',
    apply: 'build',
    writeBundle(options, bundle) {
      const dossier = options.dir ?? 'dist'
      writeFileSync(
        join(dossier, 'precache.json'),
        JSON.stringify(fichiersAPrecacher(Object.keys(bundle))),
      )
    },
  }
}

export default defineConfig({
  plugins: [preact(), listePrecache()],
  build: {
    // Chrome sur Android d'entrée de gamme. Viser plus haut coûterait des
    // transpilations que ces téléphones ne savent pas lire.
    target: 'es2020',
    // Deux kilo-octets rendus au budget : les navigateurs visés savent tous
    // précharger les modules.
    modulePreload: { polyfill: false },
    cssCodeSplit: true,
    assetsInlineLimit: 2048,
    reportCompressedSize: true,
  },
})
