import { renameSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'vite'

/** `GET /p/:lien`. Voir `vite.lire.config.ts` pour l'histoire des crochets. */
const SORTIE = '../../functions/p'

export default defineConfig({
  ssr: { noExternal: true, target: 'webworker' },
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  build: {
    ssr: 'src/worker-pdf.ts',
    target: 'es2022',
    emptyOutDir: false,
    outDir: SORTIE,
    minify: false,
    rollupOptions: {
      preserveEntrySignatures: 'exports-only',
      output: { entryFileNames: 'pdf.js', format: 'es', inlineDynamicImports: true },
    },
  },
  plugins: [
    {
      name: 'a237-crochets',
      closeBundle() {
        const dossier = join(import.meta.dirname, SORTIE)
        renameSync(join(dossier, 'pdf.js'), join(dossier, '[lien].js'))
      },
    },
  ],
})
