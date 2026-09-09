import { defineConfig } from 'vite'

/**
 * Le proxy IA, assemblé en un seul fichier JavaScript pour `functions/api/ai.js`.
 *
 * Cloudflare Pages compile lui-même ce qu'il trouve dans `functions/`, avec sa
 * propre résolution de modules : comme Vercel avant lui, elle ne suit pas les
 * liens d'un espace de travail pnpm. On ne lui donne donc que du JavaScript,
 * tout inclus, sans un seul import à résoudre — la même solution que pour le
 * service worker, et pour la même raison.
 *
 * La cible est `webworker` et non `node` : un Worker n'a ni `process`, ni
 * `Buffer`, ni les modules de Node. Viser Node ferait entrer des adaptations
 * qui plantent au premier appel, et le déploiement, lui, réussirait.
 *
 * `noExternal: true` fait entrer les paquets de l'espace de travail dans le
 * fichier ; `preserveEntrySignatures` garde l'export nommé `onRequest`, que
 * Rollup élaguait — un fichier de quarante octets s'était déployé sans que
 * personne ne s'en aperçoive.
 */
export default defineConfig({
  ssr: { noExternal: true, target: 'webworker' },
  build: {
    ssr: 'src/worker.ts',
    target: 'es2022',
    emptyOutDir: false,
    outDir: '../../functions/api',
    minify: false,
    rollupOptions: {
      preserveEntrySignatures: 'exports-only',
      output: { entryFileNames: 'ai.js', format: 'es' },
    },
  },
})
