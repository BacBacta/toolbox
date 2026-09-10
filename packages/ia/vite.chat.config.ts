import { defineConfig } from 'vite'

/**
 * `POST /api/chat`, assemblé en un fichier.
 *
 * Une construction par point d'entrée : avec plusieurs entrées, Rollup sort le
 * code commun dans un fragment partagé, et un fragment déposé dans
 * `functions/assets/` **devient une route** `/assets/…` servie par Pages.
 */
export default defineConfig({
  ssr: { noExternal: true, target: 'webworker' },
  build: {
    ssr: 'src/worker-chat.ts',
    target: 'es2022',
    emptyOutDir: false,
    outDir: '../../functions/api',
    minify: false,
    rollupOptions: {
      preserveEntrySignatures: 'exports-only',
      output: { entryFileNames: 'chat.js', format: 'es', inlineDynamicImports: true },
    },
  },
})
