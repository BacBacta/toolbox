import { mkdirSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'vite'

/**
 * `/api/compte/*`, assemblé en un fichier.
 *
 * Une construction par point d'entrée : avec plusieurs entrées, Rollup sort le
 * code commun dans un fragment partagé, et un fragment déposé sous
 * `functions/` **devient une route**.
 *
 * Le nom de sortie porte des crochets — c'est ainsi que Pages nomme un chemin
 * attrape-tout — et Rollup les remplace par des tirets bas. On renomme après
 * coup : sans ça la construction réussit et **chaque route rend 404**.
 */
const SORTIE = '../../functions/api/compte'

export default defineConfig({
  ssr: { noExternal: true, target: 'webworker' },
  build: {
    ssr: 'src/worker-compte.ts',
    target: 'es2022',
    emptyOutDir: false,
    outDir: SORTIE,
    minify: false,
    rollupOptions: {
      preserveEntrySignatures: 'exports-only',
      output: { entryFileNames: 'compte.js', format: 'es', inlineDynamicImports: true },
    },
  },
  plugins: [
    {
      name: 'a237-crochets',
      closeBundle() {
        const dossier = join(import.meta.dirname, SORTIE)
        mkdirSync(dossier, { recursive: true })
        renameSync(join(dossier, 'compte.js'), join(dossier, '[[chemin]].js'))
      },
    },
  ],
})
