import { defineConfig } from 'vite'

/**
 * `GET /api/reponses/:lien`, assemblé en un fichier.
 *
 * Nom de sortie `[lien].js` : Pages route par nom de fichier, et les crochets
 * y déclarent le paramètre. C'est ce qui donne son `contexte.params.lien` à la
 * fonction, sans table de routage à tenir à jour.
 */
export default defineConfig({
  ssr: { noExternal: true, target: 'webworker' },
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  build: {
    ssr: 'src/worker-reponses.ts',
    target: 'es2022',
    emptyOutDir: false,
    outDir: '../../functions/api/reponses',
    minify: false,
    rollupOptions: {
      preserveEntrySignatures: 'exports-only',
      output: { entryFileNames: '[lien].js', format: 'es', inlineDynamicImports: true },
    },
  },
})
