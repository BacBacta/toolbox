import { defineConfig } from 'vite'

/**
 * `POST /api/publier`, assemblé en un fichier.
 *
 * Une construction par point d'entrée, et non deux entrées dans la même : avec
 * plusieurs entrées, Rollup sort le code commun dans un fragment partagé, et
 * un fragment déposé dans `functions/assets/` **devient une route** `/assets/…`
 * servie par Pages. Chaque fonction porte donc tout ce dont elle a besoin.
 */
export default defineConfig({
  ssr: { noExternal: true, target: 'webworker' },
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  build: {
    ssr: 'src/worker-publier.ts',
    target: 'es2022',
    emptyOutDir: false,
    outDir: '../../functions/api',
    minify: false,
    rollupOptions: {
      preserveEntrySignatures: 'exports-only',
      output: { entryFileNames: 'publier.js', format: 'es', inlineDynamicImports: true },
    },
  },
})
