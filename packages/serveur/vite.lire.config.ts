import { renameSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'vite'

const SORTIE = '../../functions/d'

/**
 * `GET /d/:lien`, assemblé en un fichier.
 *
 * Pages tire ses routes du **nom des fichiers** : `d/[lien].js` répond à
 * `/d/n'importe quoi` et donne le segment dans `params.lien`. Or Rollup
 * assainit les crochets d'un nom de sortie — le fichier serait sorti
 * `_lien_.js`, qui ne répond qu'à `/d/_lien_`. La page de lecture aurait
 * alors rendu 404 partout, et la construction, elle, aurait réussi.
 *
 * On sort donc sous un nom neutre et on le remet en place après coup.
 */
export default defineConfig({
  ssr: { noExternal: true, target: 'webworker' },
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  build: {
    ssr: 'src/worker-lire.ts',
    target: 'es2022',
    emptyOutDir: false,
    outDir: SORTIE,
    minify: false,
    rollupOptions: {
      preserveEntrySignatures: 'exports-only',
      output: { entryFileNames: 'lire.js', format: 'es', inlineDynamicImports: true },
    },
  },
  plugins: [
    {
      name: 'a237-nom-de-route',
      closeBundle() {
        const dossier = join(import.meta.dirname, SORTIE)
        renameSync(join(dossier, 'lire.js'), join(dossier, '[lien].js'))
      },
    },
  ],
})
